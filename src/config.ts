// Volta'nın ayarları tek bir yerden yönetilir.
// Değerleri değiştirebilirsin; Volta açılırken dosyanın sonundaki kurallara göre kontrol edilir,
// geçersiz bir değer varsa Volta açılmaz ve ne yanlış olduğunu terminale yazar.

// Volta'nın arayüzünün çalıştığı adres ve port.
// 127.0.0.1: sadece bu bilgisayardan erişilebilir, aynı ağdaki başkaları erişemez.
export const VOLTA_HOST = "127.0.0.1";
// Port .env'deki VOLTA_PORT'tan (yoksa 4400). Adı bilerek "PORT" değil: birçok geliştirici kendi projesi için
// terminalinde PORT=3000 ayarlar, Volta da oradan açılmaya çalışıp test edilen projeyle çakışmasın.
// Adres (VOLTA_HOST) .env'den değiştirilemez: Volta yanlışlıkla bütün ağa açılmasın.
export const VOLTA_PORT = Number(process.env.VOLTA_PORT ?? 4400);

// Volta'ya tarayıcıdan sadece bu adlarla ulaşılabilir (port VOLTA_PORT). Başka bir adla gelen istekler reddedilir:
// kötü niyetli bir sitenin kendi alan adını 127.0.0.1'e çevirip tarayıcı üzerinden Volta'yı kullanmasını
// (DNS rebinding) engeller.
export const ALLOWED_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

// Test sınırları (arayüz de bunları /api/limits'ten alır)
export const MIN_TARGET_RPS = 10;
export const MAX_TARGET_RPS = 1000;
export const MIN_DURATION_SECONDS = 1;
export const MAX_DURATION_SECONDS = 60;

// Kademeli test sınırları
export const MIN_STEP_COUNT = 2;
export const MAX_STEP_COUNT = 10;
// Her kademe en az bu kadar sürmeli (kuyruğun büyüdüğünü görebilmek için)
export const MIN_STEP_DURATION_SECONDS = 2;

// Ön kontrolde bağlantı denemesi için bekleme süresi
export const CONNECT_CHECK_TIMEOUT_MS = 2000;

// Canlı akış ve veritabanı yazma aralıkları.
// LIVE_WINDOW_MS grafiğin dilim süresi: canlı grafik, sayfa yenileme ve detay sayfası aynı değeri kullanır.
// 1000'i tam bölmeli (100, 200, 250, 500...): grafik saniyeleri bu dilimlerden toplar.
export const LIVE_WINDOW_MS = 200;
export const DB_FLUSH_INTERVAL_MS = 500;

// Worker'ın kendi gecikmesi bu değeri aşarsa "Volta zorlanıyor" uyarısı verilir
export const WORKER_LAG_WARNING_MS = 50;

// Hedef URL'nin en fazla uzunluğu (test başlatma ve URL rehberi)
export const MAX_URL_LENGTH = 2000;

// --- Ayarların kontrolü ---
// Volta açılırken çalışır (server.ts). Buradaki kurallar kodun doğru çalışması için şart:
// ayarlar değiştirilebilir, kurallar değiştirilemez. Bütün sorunlar tek seferde listelenir.
// Mesajlar İngilizce (terminalde görünür).

// MAX_TARGET_RPS en fazla bu kadar yükseltilebilir. Üstünde zamanlayıcı ve worker yetişemez,
// ölçümler güvenilmez olur (1000 RPS'te Volta gecikmesi ~14 ms ölçüldü).
const RPS_CEILING = 4000;

export function validateConfig(): string[] {
  const problems: string[] = [];

  // En az "min" olan bir tam sayı mı?
  const wholeAtLeast = (name: string, value: number, min: number) => {
    if (!Number.isInteger(value) || value < min) {
      problems.push(`${name} must be a whole number of at least ${min} (current: ${value})`);
    }
  };

  // 0'dan büyük bir sayı mı?
  const positive = (name: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      problems.push(`${name} must be greater than 0 (current: ${value})`);
    }
  };

  // Üst sınır alt sınırdan küçük olmasın
  const notBelow = (maxName: string, max: number, minName: string, min: number) => {
    if (max < min) {
      problems.push(`${maxName} (${max}) cannot be lower than ${minName} (${min})`);
    }
  };

  // Port: ortam değişkeninden geliyor, "abc" ya da boş olabilir
  if (!Number.isInteger(VOLTA_PORT) || VOLTA_PORT < 1 || VOLTA_PORT > 65535) {
    problems.push(`VOLTA_PORT must be a whole number between 1 and 65535 (current: "${process.env.VOLTA_PORT}")`);
  }

  // Tarayıcı varsayılan portu (80) adrese yazmaz; Volta'nın güvenlik kontrolleri portu adreste bekliyor
  if (VOLTA_PORT === 80) {
    problems.push("VOLTA_PORT cannot be 80 (browsers leave the default port out of the address). Use another port, e.g. 4400");
  }

  // Test sınırları: 0 saniyelik ya da saniyede 0 istek gönderen test anlamsız
  wholeAtLeast("MIN_TARGET_RPS", MIN_TARGET_RPS, 1);
  wholeAtLeast("MAX_TARGET_RPS", MAX_TARGET_RPS, 1);
  notBelow("MAX_TARGET_RPS", MAX_TARGET_RPS, "MIN_TARGET_RPS", MIN_TARGET_RPS);
  if (MAX_TARGET_RPS > RPS_CEILING) {
    problems.push(`MAX_TARGET_RPS cannot be higher than ${RPS_CEILING} (current: ${MAX_TARGET_RPS})`);
  }

  wholeAtLeast("MIN_DURATION_SECONDS", MIN_DURATION_SECONDS, 1);
  wholeAtLeast("MAX_DURATION_SECONDS", MAX_DURATION_SECONDS, 1);
  notBelow("MAX_DURATION_SECONDS", MAX_DURATION_SECONDS, "MIN_DURATION_SECONDS", MIN_DURATION_SECONDS);

  // Kademeli test: tek kademe, sabit testin aynısı olur
  wholeAtLeast("MIN_STEP_COUNT", MIN_STEP_COUNT, 2);
  wholeAtLeast("MAX_STEP_COUNT", MAX_STEP_COUNT, 2);
  notBelow("MAX_STEP_COUNT", MAX_STEP_COUNT, "MIN_STEP_COUNT", MIN_STEP_COUNT);
  positive("MIN_STEP_DURATION_SECONDS", MIN_STEP_DURATION_SECONDS);

  // Zaman aralıkları
  positive("CONNECT_CHECK_TIMEOUT_MS", CONNECT_CHECK_TIMEOUT_MS);
  positive("DB_FLUSH_INTERVAL_MS", DB_FLUSH_INTERVAL_MS);
  positive("WORKER_LAG_WARNING_MS", WORKER_LAG_WARNING_MS);

  // Grafik saniyeleri dilimlerden toplar: bir saniye tam sayıda dilim olmalı
  wholeAtLeast("LIVE_WINDOW_MS", LIVE_WINDOW_MS, 1);
  if (Number.isInteger(LIVE_WINDOW_MS) && LIVE_WINDOW_MS > 0 && 1000 % LIVE_WINDOW_MS !== 0) {
    problems.push(`LIVE_WINDOW_MS must divide 1000 evenly, e.g. 100, 200, 250, 500 (current: ${LIVE_WINDOW_MS})`);
  }

  wholeAtLeast("MAX_URL_LENGTH", MAX_URL_LENGTH, 1);

  return problems;
}