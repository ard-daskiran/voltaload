// variables.ts
// Variables in a test's URL, JSON body and header values: {{email}}, {{username}}, {{password}}, {{n}}, {{uuid}}.
// Every request gets its own values. The values aren't saved: only each request's sequence number (n) is, and the
// values are computed again from it and the test's seed when the CSV is exported. Same seed + same n → same values.
// The worker (while sending) and the CSV export both use this file, so they always produce the same values.

import { createHmac } from "node:crypto";

export const VARIABLE_NAMES = ["email", "username", "password", "n", "uuid"] as const;
export type VariableName = (typeof VARIABLE_NAMES)[number];
export type VariableValues = Record<VariableName, string>;

// {{name}}; spaces inside the braces are allowed ({{ email }})
const VARIABLE_PATTERN = /\{\{\s*([^{}\s]*)\s*\}\}/g;

// .test is reserved for testing and never belongs to a real site: if the tested app sends a confirmation email
// to every new account, those emails can't reach anyone
const EMAIL_DOMAIN = "volta.test";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
// No quote or backslash: the value goes inside a JSON string, and either would break the body
const SYMBOLS = "!#$%*+-=?@^_";
const PASSWORD_LENGTH = 12;

export interface VariableContext {
  testRunId: string;
  seed: string;
}

// --- Finding and checking ---

export function isVariableName(name: string): name is VariableName {
  return (VARIABLE_NAMES as readonly string[]).includes(name);
}

// Names used in a text, in order ("{{emial}}" too: checking them is the caller's job)
export function findVariables(text: string): string[] {
  return [...text.matchAll(VARIABLE_PATTERN)].map((match) => match[1]);
}

// The first name that isn't a known variable, or null
export function unknownVariable(texts: string[]): string | null {
  for (const text of texts) {
    for (const name of findVariables(text)) {
      if (!isVariableName(name)) return name;
    }
  }
  return null;
}

export function usesVariables(texts: string[]): boolean {
  return texts.some((text) => findVariables(text).length > 0);
}

// Is there a variable in the server part of the address ("http://{{n}}.localhost/...")?
// Not allowed: the "local addresses only" check runs once before the test, so the server must stay the same.
export function variableInHost(url: string): boolean {
  const schemeEnd = url.indexOf("://");
  const start = schemeEnd === -1 ? 0 : schemeEnd + 3;
  const ends = ["/", "?", "#"].map((char) => url.indexOf(char, start)).filter((index) => index !== -1);
  const end = ends.length > 0 ? Math.min(...ends) : url.length;
  return url.slice(start, end).includes("{{");
}

// --- Values ---

// 6 characters of the test's ID: the same email doesn't repeat across tests either
function testPrefix(testRunId: string): string {
  return testRunId.replace(/-/g, "").slice(0, 6);
}

// Bytes that look random but are the same every time for the same seed, label and n
function derive(seed: string, label: string, n: number): Buffer {
  return createHmac("sha256", seed).update(`${label}:${n}`).digest();
}

// "Kp7#mQ2xWv9L": 12 characters with at least one uppercase letter, lowercase letter, digit and symbol.
// Always starts with a letter: in Excel a cell starting with =, +, - or @ would run as a formula.
function password(seed: string, n: number): string {
  const bytes = derive(seed, "password", n);
  const pick = (set: string, byte: number) => set[byte % set.length];
  const all = UPPER + LOWER + DIGITS + SYMBOLS;

  const chars = [pick(UPPER + LOWER, bytes[0]), pick(UPPER, bytes[1]), pick(LOWER, bytes[2]), pick(DIGITS, bytes[3]), pick(SYMBOLS, bytes[4])];
  for (let i = chars.length; i < PASSWORD_LENGTH; i++) chars.push(pick(all, bytes[i]));

  // Shuffle everything after the first character, so the digit and the symbol aren't always in the same place
  for (let i = chars.length - 1; i > 1; i--) {
    const j = 1 + (bytes[12 + i] % i);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// A UUID in the standard (version 4) format, from the same kind of bytes
function uuid(seed: string, n: number): string {
  const bytes = Buffer.from(derive(seed, "uuid", n).subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Computes the values of request n. Only the names in "needed" are computed (password and uuid cost a little).
export function createValueGenerator(context: VariableContext, needed: Iterable<VariableName>) {
  const names = new Set(needed);
  const prefix = testPrefix(context.testRunId);

  return (n: number): VariableValues => {
    const values = { email: "", username: "", password: "", n: String(n), uuid: "" };
    if (names.has("email")) values.email = `volta-${prefix}-${n}@${EMAIL_DOMAIN}`;
    if (names.has("username")) values.username = `volta_${prefix}_${n}`;
    if (names.has("password")) values.password = password(context.seed, n);
    if (names.has("uuid")) values.uuid = uuid(context.seed, n);
    return values;
  };
}

// --- Templates ---

type Encode = (value: string) => string;

// Each value is written the way its place needs it
const encodeForUrl: Encode = encodeURIComponent; // "@" → "%40"
const encodeForJson: Encode = (value) => JSON.stringify(value).slice(1, -1); // inside a JSON string
const encodeAsIs: Encode = (value) => value; // header values

// Splits a text into fixed pieces and variables once, so filling it for each request is quick.
// null if the text has no variables (it's then used as it is).
function compileTemplate(text: string, encode: Encode): ((values: VariableValues) => string) | null {
  const pieces: string[] = [];
  const names: VariableName[] = [];
  let last = 0;

  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    pieces.push(text.slice(last, match.index));
    names.push(match[1] as VariableName);
    last = (match.index ?? 0) + match[0].length;
  }
  if (names.length === 0) return null;
  pieces.push(text.slice(last));

  return (values) => {
    let out = pieces[0];
    for (let i = 0; i < names.length; i++) out += encode(values[names[i]]) + pieces[i + 1];
    return out;
  };
}

export interface PreparedRequest {
  url: string;
  body: string | undefined;
  headers: Record<string, string>;
}

// The worker calls this once at the start of the test. Returns a function that builds request n,
// or null if the test has no variables (then every request is the same, as before).
export function createRequestBuilder(context: VariableContext, request: PreparedRequest) {
  const url = compileTemplate(request.url, encodeForUrl);
  const body = request.body !== undefined ? compileTemplate(request.body, encodeForJson) : null;
  const headers = Object.entries(request.headers)
    .map(([name, value]) => ({ name, fill: compileTemplate(value, encodeAsIs) }))
    .filter((header) => header.fill !== null);

  if (!url && !body && headers.length === 0) return null;

  const texts = [request.url, request.body ?? "", ...Object.values(request.headers)];
  const needed = texts.flatMap(findVariables).filter(isVariableName);
  const valuesFor = createValueGenerator(context, needed);

  return (n: number): PreparedRequest => {
    const values = valuesFor(n);
    const filledHeaders = headers.length > 0 ? { ...request.headers } : request.headers;
    for (const header of headers) filledHeaders[header.name] = header.fill!(values);
    return {
      url: url ? url(values) : request.url,
      body: body ? body(values) : request.body,
      headers: filledHeaders,
    };
  };
}