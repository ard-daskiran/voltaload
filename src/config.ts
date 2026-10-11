// Volta'nın ayarları tek bir yerden yönetilir.

// Volta'nın arayüzünün çalıştığı adres ve port.
// 127.0.0.1: sadece bu bilgisayardan erişilebilir, aynı ağdaki başkaları erişemez.
export const VOLTA_HOST = "127.0.0.1";
export const VOLTA_PORT = Number(process.env.PORT ?? 4400);

// Test sınırları
export const MAX_TARGET_RPS = 1000;
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
export const LIVE_WINDOW_MS = 200;
export const DB_FLUSH_INTERVAL_MS = 500;

// Worker'ın kendi gecikmesi bu değeri aşarsa "Volta zorlanıyor" uyarısı verilir
export const WORKER_LAG_WARNING_MS = 50;