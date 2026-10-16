// setup.mjs
// Volta's setup. It runs by itself:
//   after `npm install` (postinstall): Node.js check, .env, Prisma client, database
//   before `npm start`  (prestart):    Node.js check, database update, build
// Only Node's built-in modules are used: it has to work before anything else is ready.

import { existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN_NODE = { major: 22, minor: 19 };
const FOR_START = process.argv.includes("--start");

function ok(text) {
    console.log(`  ✓ ${text}`);
}

// Prints what went wrong (with the tool's own output, if any) and stops install / start
function fail(text, output = "") {
    console.error(`\n  ✗ ${text}`);
    if (output.trim()) console.error(`\n${output.trim()}\n`);
    process.exit(1);
}

// Runs a tool from node_modules/.bin (npm puts it on the PATH while running scripts).
// Output is kept and only shown if the tool fails.
function run(commandLine) {
    const result = spawnSync(commandLine, { cwd: ROOT, encoding: "utf8", shell: true });
    return { success: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function checkNode() {
    const [major, minor] = process.versions.node.split(".").map(Number);
    const required = `${MIN_NODE.major}.${MIN_NODE.minor}`;
    if (major < MIN_NODE.major || (major === MIN_NODE.major && minor < MIN_NODE.minor)) {
        fail(`Node.js ${required} or newer is required, you have ${process.versions.node}. Get it from https://nodejs.org`);
    }
    ok(`Node.js ${process.versions.node} (${required} or newer required)`);
}

// .env is optional (Volta has defaults); creating it shows where the settings are
function createEnv() {
    const envFile = path.join(ROOT, ".env");
    const example = path.join(ROOT, ".env.example");
    if (existsSync(envFile)) return ok(".env found");
    if (!existsSync(example)) return ok("No .env, using defaults");
    copyFileSync(example, envFile);
    ok(".env created from .env.example");
}

function generateClient() {
    const { success, output } = run("prisma generate");
    if (!success) fail("Could not generate the Prisma client.", output);
    ok("Prisma client generated");
}

// Creates the database on first run, applies new migrations after an update, otherwise does nothing
function prepareDatabase() {
    const { success, output } = run("prisma migrate deploy");
    if (!success) fail("Could not create or update the database.", output);
    ok("Database ready");
}

function build() {
    const { success, output } = run("tsc");
    if (!success) fail("Build failed.", output);
    ok("Build complete");
}

if (FOR_START) {
    console.log("\nStarting Volta");
    checkNode();
    prepareDatabase();
    build();
    console.log("");
} else {
    console.log("\nVolta setup");
    checkNode();
    createEnv();
    generateClient();
    prepareDatabase();
    console.log("\nDone. Start Volta with: npm start\n");
}