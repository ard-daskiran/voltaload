// .env her şeyden önce yüklenir (server.ts'te ilk içeri alma). Proje kökünden okunur
// (src/ ya da derlenmiş dist/'in bir üstü): Volta başka bir klasörden başlatılsa da projenin .env'i kullanılır,
// o klasörde başka bir .env varsa (örneğin test edilen projenin) karışmaz.
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });