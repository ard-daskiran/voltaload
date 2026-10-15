// .env is loaded before everything else (first import in server.ts). It's read from the project root
// (one level above src/ or the compiled dist/): even if Volta is started from another folder, the project's .env is used,
// and another .env in that folder (e.g. the tested project's) doesn't interfere.
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });