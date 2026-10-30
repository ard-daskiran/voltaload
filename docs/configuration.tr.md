# Ayarlar

[English](configuration.md) | **Türkçe**

Volta hiçbir ayar yapmadan çalışır. Bu sayfa bir sınırı, portu ya da verilerin saklandığı yeri değiştirmek istediğinde işine yarar.

Ayarlar iki yerde durur:

| Dosya           | İçinde ne var                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `.env`          | Kendi bilgisayarına ait ayarlar: port ve veritabanı dosyası                                              |
| `src/config.ts` | Test sınırları ve Volta'nın nasıl davrandığı: en yüksek RPS, test süresi, istek zaman aşımı ve diğerleri |

İkisinden birini değiştirdikten sonra **Volta'yı yeniden başlat** (`Ctrl+C`, sonra `npm start`). Arayüz yeni sınırları kendiliğinden alır: formdaki ipuçları, kontrolleri ve zaman aşımından bahseden metinler ayarları takip eder.

## Geçersiz ayarlar

Volta açılırken her ayarı kontrol eder. Bir değer geçersizse açılmaz ve yanlış olan her şeyi listeler:

```
Volta could not start: invalid settings (src/config.ts or .env).
  - MAX_TARGET_RPS cannot be higher than 4000 (current: 5000)
  - VOLTA_PORT cannot be 80 (browsers leave the default port out of the address). Use another port, e.g. 4400
Fix them and restart Volta.
```

Böylece bir yazım hatası bir testi sessizce bozamaz.

## `.env`

`npm install` sırasında `.env.example`'dan oluşturulur. Bütün değerler isteğe bağlıdır; `.env` yoksa Volta varsayılanları kullanır.

| Ayar           | Varsayılan             | Açıklama                                                                                                                                                  |
| -------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VOLTA_PORT`   | `4400`                 | Volta'nın arayüzünün çalıştığı port: `http://localhost:4400`. 4400 başka bir program tarafından kullanılıyorsa değiştir. İzin verilen: 1–65535, 80 hariç. |
| `DATABASE_URL` | `file:./prisma/dev.db` | Testlerin saklandığı SQLite dosyası. Göreli bir yol proje klasörüne göre çözülür, yani Volta'yı hangi klasörden başlattığın fark etmez.                   |

Örnek:

```dotenv
VOLTA_PORT=5500
DATABASE_URL="file:./prisma/dev.db"
```

**Neden `PORT` değil?** Birçok geliştirici kendi projesi için terminalinde `PORT` ayarlar. Volta kendi adını kullanır; böylece onu yanlışlıkla alıp test ettiğin sunucuyla çakışmaz.

**Adres değiştirilemez.** Volta her zaman `127.0.0.1` üzerinde çalışır, yani sadece kendi bilgisayarından erişilebilir. Bu bilinçli bir karar: Bir yük testi aracı yanlışlıkla bütün ağa açılmamalı.

## `src/config.ts`

### Test sınırları

| Ayar                        | Varsayılan | İzin verilen | Açıklama                                                                                                                                |
| --------------------------- | ---------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `MIN_TARGET_RPS`            | `10`       | ≥ 1          | Bir testin kullanabileceği en düşük saniyede istek sayısı. 10'un altında yüzdelikler (p95, p99) çok az isteğe dayanır.                  |
| `MAX_TARGET_RPS`            | `1000`     | ≤ 4000       | En yüksek saniyede istek sayısı. Volta 3000'e kadar rahat çalışacak şekilde test edildi; bkz. [Performans](../README.tr.md#performans). |
| `MIN_DURATION_SECONDS`      | `1`        | ≥ 1          | En kısa test, saniye.                                                                                                                   |
| `MAX_DURATION_SECONDS`      | `60`       | ≥ 1          | En uzun test, saniye.                                                                                                                   |
| `MIN_STEP_COUNT`            | `2`        | ≥ 2          | Kademeli testte en az kademe sayısı.                                                                                                    |
| `MAX_STEP_COUNT`            | `10`       | ≥ 2          | Kademeli testte en fazla kademe sayısı.                                                                                                 |
| `MIN_STEP_DURATION_SECONDS` | `2`        | > 0          | Her kademe en az bu kadar sürmeli; böylece büyüyen bir kuyruğun görünmeye vakti olur.                                                   |

Üst sınırlar alt sınırlardan küçük olamaz.

### İstekler

| Ayar                       | Varsayılan | İzin verilen | Açıklama                                                                                                                                                                             |
| -------------------------- | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REQUEST_TIMEOUT_MS`       | `2500`     | 1000–30000   | Volta'nın bir isteği zaman aşımı saymadan önce cevabı ne kadar beklediği. Yapay zeka çağrıları gibi yavaş adresleri test etmek için yükselt.                                         |
| `MAX_BODY_KB`              | `100`      | 1–1024       | Bir testin gönderebileceği en büyük JSON gövdesi. Gövde her istekle gönderilir ve testle birlikte kaydedilir.                                                                        |
| `MAX_HEADERS`              | `20`       | ≥ 1          | Bir testin en fazla kaç özel başlığı olabileceği.                                                                                                                                    |
| `MAX_HEADER_BYTES`         | `8192`     | 1–16384      | Bir testin özel başlıklarının (adlar ve değerler) bayt olarak en büyük toplam boyutu. Sunucuların çoğu 8–16 KB'ı aşan başlıkları `431 Request Header Fields Too Large` ile reddeder. |
| `CONNECT_CHECK_TIMEOUT_MS` | `2000`     | > 0          | Test başlamadan önce Volta hedefe ulaşılabildiğini kontrol eder. Bu süre içinde bağlanamazsa test başlamaz.                                                                          |
| `MAX_URL_LENGTH`           | `2000`     | ≥ 1          | En uzun hedef URL, karakter.                                                                                                                                                         |
| `MAX_SEARCH_LENGTH`        | `200`      | ≥ 1          | Arama kutularındaki en uzun metin (geçmiş ve kayıtlı hedefler).                                                                                                                      |

**Zaman aşımının üst sınırı hakkında:** Yavaş bir sunucuda her istek zaman aşımına kadar bekler. 1000 RPS ve 30 saniyelik zaman aşımıyla aynı anda 30.000'e kadar istek yolda olabilir. Zaman aşımını sadece ihtiyacın kadar yükselt.

### Uyarılar

| Ayar                    | Varsayılan | Açıklama                                                                                                                                                                                                           |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WORKER_LAG_WARNING_MS` | `50`       | Volta'nın kendi zamanlaması bundan fazla gecikirse _"Volta zorlanıyor"_ uyarısı gösterilir ve test, sonuçları güvenilir olmayabilir diye işaretlenir. Testin ilk saniyesi hesaba katılmaz (bağlantılar kuruluyor). |

### İleri düzey

Bunlar canlı grafiği ve sonuçların nasıl kaydedildiğini belirler. Varsayılanlar iyi çalışır; sadece nedenini biliyorsan değiştir.

| Ayar                       | Varsayılan | Kural                                    | Açıklama                                                                                                                   |
| -------------------------- | ---------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `LIVE_WINDOW_MS`           | `200`      | 1000'i tam bölmeli (100, 200, 250, 500…) | Canlı grafikteki bir noktanın süresi. Canlı grafik, yenilenen sayfa ve test detayı aynı dilimleri kullanır.                |
| `DB_FLUSH_INTERVAL_MS`     | `500`      | > 0                                      | Test sırasında sonuçların veritabanına ne sıklıkla yazıldığı.                                                              |
| `WORKER_BATCH_INTERVAL_MS` | `100`      | > 0                                      | Test motorunun sonuçlarını ne sıklıkla teslim ettiği.                                                                      |
| `LIVE_EMIT_DELAY_MS`       | `150`      | `WORKER_BATCH_INTERVAL_MS`'ten büyük     | Canlı yayının bir dilim bittikten sonra onu göndermeden önce ne kadar beklediği; böylece dilimin son sonuçları da yetişir. |

## Sık yapılan değişiklikler

**Daha yüksek yük:** `MAX_TARGET_RPS = 3000`. Volta ile sunucunun genelde aynı işlemciyi paylaştığını unutma; test sırasında _Volta gecikmesi_ göstergesine bak.

**Yavaş bir adres:** Her istek 4 saniye sürüyorsa, varsayılan 2,5 saniyeyle hepsi zaman aşımına uğrar. `REQUEST_TIMEOUT_MS = 10000` yap, Volta onları ölçsün.

**Daha uzun testler:** `MAX_DURATION_SECONDS = 300`. Her istek bir satır olarak kaydedilir; 1000 RPS'te 5 dakikalık bir test veritabanına 300.000 satır ekler ve detay sayfası daha geç açılır. Eski testleri **TEST HISTORY** sayfasından istediğin zaman silebilirsin.

**Başka bir port:** `.env`'de `VOLTA_PORT=5500`.

## Analiz eşikleri

Analizin arkasındaki kurallar (bir kademenin ne zaman _Sınırda_ ya da _Zorlandı_ sayıldığı, neyin kuyruk birikmesi sayıldığı, bir önerinin ne zaman çıktığı) `src/analysis/thresholds.ts`'te. Bunlar ayar olarak düşünülmedi: Değiştirmek, Volta'nın sunucun hakkında vardığı sonucu değiştirir. Nasıl çalıştıklarını [Sonuçları okumak](reading-results.tr.md) anlatıyor.

## Güncelleme

`src/config.ts` Volta'nın kodunun bir parçası. Onu değiştirirsen ve yeni bir sürüm de aynı dosyayı değiştirirse, `git pull` önce senin yerel değişikliğini halletmeni isteyebilir. Değişikliklerini not al ki tekrar uygulayabilesin; `.env` güncellemelerden hiç etkilenmez.
