// thresholds.ts
// Analizin bütün eşikleri tek yerde. Gerçek testlerde sonuçları gördükçe buradan ayarlanır.
// Karşılaştırmalar: "en az bu değer → en az bu durum" (eşik dahil). Throughput tersine: "bu oranın altı".

export const THRESHOLDS = {
  // İlk saniye atlanır: bağlantılar kurulurken gecikme hep biraz yüksektir
  warmupSeconds: 1,

  // Sağlıklı seviye: ısınmadan sonraki en fazla bu kadar saniyeye bakılır
  baselineSeconds: 3,

  // Hata oranı (5xx + cevapsız) en az bu değerse → en az bu durum
  errorRate: { borderline: 0.01, strained: 0.05, collapsed: 0.25 },

  // Bağlantı hatası (reddedildi, koptu) en az bu orandaysa → çöktü
  connectionErrorRate: 0.01,

  // Başarılı istek / hedeflenen istek. Bu oranın ALTINA düşerse → en az bu durum
  throughput: { borderline: 0.9, strained: 0.75, collapsed: 0.5 },

  // p95, sağlıklı seviyeye göre: "N katı ya da +X ms, hangisi büyükse" (en az bu değer → bu durum)
  // (çok hızlı adreslerde 3 ms → 7 ms gibi önemsiz farklar alarm vermesin)
  relative: {
    borderlineRatio: 2,
    borderlineMinExtraMs: 50,
    strainedRatio: 5,
    strainedMinExtraMs: 200,
  },

  // p95 için sabit sınırlar (sağlıklı seviye ne olursa olsun)
  absolute: { borderlineMs: 500, strainedMs: 1000 },

  // Aynı yük altında gecikmenin sürekli artması (kuyruk birikmesi)
  trend: { ratio: 1.5, minExtraMs: 100, minSeconds: 4 },

  // Bir olayın sayılması için üst üste kaç saniye sürmesi gerekir
  sustainedSeconds: 2,

  // Öneriler için eşikler
  recommend: {
    codeShare: 0.01, // Bir hata türü cevapların en az %1'iyse öneri çıkar
    timeoutDominantShare: 0.9, // İsteklerin %90'ı zaman aşımıysa sorun yük değil, isteğin kendisi
    clientErrorShare: 0.5, // Cevapların yarısı 4xx ise (429 hariç) "test ayarları yanlış olabilir"
    redirectShare: 0.5, // Cevapların yarısı yönlendirmeyse uyarı
    rateLimitedShare: 0.5, // Cevapların yarısı 429 ise ölçülen, hız sınırlayıcı
    connectionDominantShare: 0.5, // İsteklerin yarısı bağlantı hatasıysa kapasite hakkında bir şey söylenemez
    tailRatio: 3, // p99, p95'in en az bu katı...
    tailMinExtraMs: 100, // ...ve en az bu kadar fazlaysa "arada çok yavaş istekler" (hızlı adreslerde 0 → 1 ms alarm olmasın)
    lowRps: 10, // Ortalama hedef RPS bunun altındaysa yüzdelikler güvenilir değil
  },

  // Önerilen takip testinin ayarları
  followUp: {
    stepCount: 10,
    durationSeconds: 30,
    nearLimitFactor: 1.5, // "Sınıra yakın" önerisinde test edilen yükün kaç katına çıkılır
  },
} as const;