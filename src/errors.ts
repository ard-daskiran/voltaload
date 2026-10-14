// API hataları: bir kod (arayüz bunu kullanıcının dilinde gösterir), gerekirse değişkenler
// ve İngilizce yedek metin (kodu tanımayanlar için, örneğin terminalden curl ile deneyenler).
// Cevap gövdesi: { error: "İngilizce metin", code: "KOD", params: { ... } }

export type ErrorCode =
  // Test başlatma doğrulaması
  | "INVALID_URL"
  | "INVALID_METHOD"
  | "INVALID_RPS"
  | "INVALID_DURATION"
  | "INVALID_PROFILE"
  | "INVALID_STEP_COUNT"
  | "STEP_TOO_SHORT"
  | "STEP_RPS_TOO_LOW"
  // Hedef adres
  | "URL_MALFORMED"
  | "URL_PROTOCOL"
  | "URL_UNSPECIFIED"
  | "DNS_FAILED"
  | "NOT_LOCAL"
  | "SELF_TARGET"
  | "TARGET_UNREACHABLE"
  // Test yönetimi
  | "TEST_ALREADY_RUNNING"
  | "START_FAILED"
  | "NO_ACTIVE_TEST"
  | "TEST_NOT_FOUND"
  | "TEST_RUNNING"
  | "TEST_UNEXPECTED_ERROR"
  | "WORKER_EXITED"
  // URL rehberi
  | "TARGET_NAME_LENGTH"
  | "TARGET_URL_EXISTS"
  | "TARGET_NAME_EXISTS"
  | "TARGET_EXISTS"
  | "URL_REQUIRED"
  | "INVALID_ID"
  | "TARGET_NOT_FOUND"
  // Genel (gövde okunamadı, adres yok, beklenmeyen hata)
  | "BODY_TOO_LARGE"
  | "INVALID_JSON"
  | "API_NOT_FOUND"
  | "INTERNAL_ERROR"
  // Güvenlik (istek Volta'nın kendi adresinden gelmiyor)
  | "FORBIDDEN_HOST"
  | "FORBIDDEN_ORIGIN";

type Params = Record<string, string | number>;

// İngilizce yedek metinler (arayüzdeki Türkçe ve İngilizce metinler sözlükte: public/js/core/i18n.js)
const MESSAGES: Record<ErrorCode, (p: Params) => string> = {
  INVALID_URL: () => "A valid URL is required.",
  INVALID_METHOD: () => "Method must be GET or POST.",
  INVALID_RPS: (p) => `Requests per second must be a whole number between ${p.min} and ${p.max}.`,
  INVALID_DURATION: (p) => `Duration must be a whole number between ${p.min} and ${p.max} seconds.`,
  INVALID_PROFILE: () => "Test type must be CONSTANT or STEPPED.",
  INVALID_STEP_COUNT: (p) => `Steps must be between ${p.min} and ${p.max}.`,
  STEP_TOO_SHORT: (p) => `Each step must last at least ${p.min}s. Increase the duration or reduce the steps.`,
  STEP_RPS_TOO_LOW: (p) => `Max RPS cannot be lower than the number of steps (${p.min}).`,
  
  URL_MALFORMED: () => "Invalid URL format.",
  URL_PROTOCOL: () => "Only http and https addresses can be tested.",
  URL_UNSPECIFIED: () => "0.0.0.0 is not a target address. Use localhost instead.",
  DNS_FAILED: () => "Could not resolve the address. Check the URL.",
  NOT_LOCAL: () => "For security, only local addresses (localhost and private networks) can be tested.",
  SELF_TARGET: () => "Volta's own address cannot be tested. Enter the address of the project you want to test.",
  TARGET_UNREACHABLE: () => "Cannot reach the target. Make sure your project is running and the port is correct.",

  TEST_ALREADY_RUNNING: () => "A test is already running. Wait for it to finish or stop it.",
  START_FAILED: () => "The test could not be started.",
  NO_ACTIVE_TEST: () => "No running test was found.",
  TEST_NOT_FOUND: () => "Test not found.",
  TEST_RUNNING: () => "A running test cannot be deleted.",
  TEST_UNEXPECTED_ERROR: () => "An unexpected error occurred during the test.",
  WORKER_EXITED: () => "The test engine stopped unexpectedly.",

  TARGET_NAME_LENGTH: (p) => `Name must be between 1 and ${p.max} characters.`,
  TARGET_URL_EXISTS: (p) => `This URL is already saved as "${p.name}".`,
  TARGET_NAME_EXISTS: (p) => `The name "${p.name}" is already in use.`,
  TARGET_EXISTS: () => "This name or URL is already saved.",
  URL_REQUIRED: () => "URL is required.",
  INVALID_ID: () => "Invalid entry.",
  TARGET_NOT_FOUND: () => "Entry not found.",

  BODY_TOO_LARGE: (p) => `The request body is too large (max ${p.max}).`,
  INVALID_JSON: () => "The request body is not valid JSON.",
  API_NOT_FOUND: () => "No such API endpoint.",
  INTERNAL_ERROR: () => "An unexpected server error occurred.",

  FORBIDDEN_HOST: (p) => `Volta can only be opened at http://localhost:${p.port} or http://127.0.0.1:${p.port}.`,
  FORBIDDEN_ORIGIN: () => "Requests from other websites are not allowed.",
};

export interface ApiError {
  code: ErrorCode;
  params: Params;
  message: string;
}

export function apiError(code: ErrorCode, params: Params = {}): ApiError {
  return { code, params, message: MESSAGES[code](params) };
}

// Cevap gövdesi (HTTP cevapları ve Socket.io "error" mesajı aynı biçimi kullanır)
export function errorBody(error: ApiError) {
  return { error: error.message, code: error.code, params: error.params };
}