# Kullanım

[English](usage.md) | **Türkçe**

Bu rehber Volta'daki her ekranı anlatır. Sayıların ve analizin ne anlama geldiği için bkz. [Sonuçları okumak](reading-results.tr.md).

- [Test kurmak](#test-kurmak)
- [Değişkenler](#değişkenler)
- [Test çalışırken](#test-çalışırken)
- [Kayıtlı hedefler](#kayıtlı-hedefler)
- [Test geçmişi](#test-geçmişi)
- [Test detayı](#test-detayı)
- [Rapor](#rapor)
- [CSV dışa aktarma](#csv-dışa-aktarma)
- [Dil](#dil)

## Test kurmak

**DASHBOARD** sayfasının solundaki form.

### Hedef URL

Test etmek istediğin adres, örneğin `localhost:3000/api/products`. Başına `http://` yazmazsan Volta, tarayıcının adres çubuğu gibi kendisi ekler. `https://` de çalışır; kendinden imzalı sertifika kullanan yerel sunucular dahil.

Sadece kendi bilgisayarındaki ya da yerel ağındaki adresler test edilebilir (bkz. [Güvenlik](../README.tr.md#güvenlik)). Kutudaki rehber simgesi [kayıtlı hedeflerini](#kayıtlı-hedefler) açar.

### Yöntem ve JSON gövdesi

- **GET** ya da **POST**.
- **JSON Body** isteğe bağlıdır ve sadece POST isteklerinde gönderilir. Geçerli bir JSON olmalı; Volta başlamadan önce kontrol eder. [Değişken](#değişkenler) kullanmadıkça testteki her istek aynı gövdeyi gönderir.
- **JSON Body kutusundaki tuşlar:** `Tab` ve `Shift+Tab` satırı (ya da seçili bütün satırları) içeri ve dışarı kaydırır, `Enter` mevcut girintiyi korur. Kutudan klavyeyle çıkmak için önce `Esc`, sonra `Tab`'a bas.

**JSON Body** ve **Başlıklar**, tıklayınca açılan bölümlerdir. Kapalıyken sağ tarafta kısa bir özet gösterirler (_48 bayt_, _2 başlık · 1 gizli_). GET seçiliyken JSON Body kilitlidir. Testi başlattığında bir bölümde hata varsa bölüm kendiliğinden açılır ve sorunu gösterir.

### Başlıklar

İsteğe bağlıdır. Token, çerez ya da API anahtarı isteyen adresleri test etmek için kullan. **Başlıklar**'ı aç ve **+ Başlık ekle**'ye bas. Her satırda bir ad ve bir değer var, örneğin:

| Ad                | Değer                  |
| ----------------- | ---------------------- |
| `Authorization`   | `Bearer eyJhbGciOi...` |
| `Accept-Language` | `tr`                   |

- Başlıklar her istekle gönderilir; POST'ta olduğu gibi GET'te de.
- **Yapıştırma:** `Authorization: Bearer ...` gibi satırları bir ad kutusuna yapıştırırsan Volta onları her satıra bir başlık olacak şekilde böler. Tarayıcının geliştirici araçlarından ya da bir curl komutundan (`-H "Ad: değer"`) kopyalanan satırlar da çalışır.
- Volta'nın kendisinin gönderdiği bir başlıkla aynı adı taşıyan başlık onun yerine geçer; örneğin kendi `Content-Type` ya da `Accept-Encoding` değerin.
- Varsayılan olarak en fazla 20 başlık ve toplam 8 KB (bkz. [Ayarlar](configuration.tr.md)).
- **Adlar:** İngilizce harf, rakam ve `-`, `_` gibi işaretler; boşluk olmadan. **Değerler:** `ş`, `ğ` gibi harfler olamaz; HTTP başlıkları bunları desteklemez.
- Bazı başlıkları Volta kendisi yönetir ve değiştirilemez: `Host`, `Content-Length`, `Transfer-Encoding`, `Connection`, `Keep-Alive`, `Upgrade`, `TE`, `Trailer` ve `Expect`. Yapıştırırken bunlar bir notla atlanır.

**Değerleri gizlemek.** Bir satırdaki kilit simgesi, değerini test detayında ve raporda gizler; örneğin `Authorization: Bearer ••••••Oi3x`. Adı `Authorization`, `Proxy-Authorization` ya da `Cookie` olan, ya da adında `token`, `key`, `secret` veya `password` geçen satırlar kendiliğinden kilitlenir. Kilitlemek onay istemez; kilidi açarken Volta önce sorar, çünkü değer o zaman raporda açıkça görünür.

Gizlemek sadece görüntüyü değiştirir. Test yine gerçek değeri gönderir, **YENİDEN ÇALIŞTIR** formu gerçek değerle doldurur ve değer yerel veritabanı dosyasında (`prisma/dev.db`) düz metin olarak saklanır. Bu dosyayı paylaşma; mümkünse gerçek token'lar yerine test token'ları kullan.

### Test türü

**Sabit Yük:** Test boyunca her saniye aynı sayıda istek.

| Alan           | Anlamı                                                  |
| -------------- | ------------------------------------------------------- |
| Saniyede İstek | Her saniye kaç istek gönderileceği (varsayılan 10–1000) |
| Süre (s)       | Testin ne kadar süreceği (varsayılan 1–60 saniye)       |

Sunucunun belirli bir yükü kaldırıp kaldırmadığını görmek için kullan; örneğin en yoğun saatte beklediğin trafik.

**Kademeli Artış:** Yük eşit kademelerle artar; böylece sunucunun nerede zorlanmaya başladığını görürsün.

| Alan          | Anlamı                                             |
| ------------- | -------------------------------------------------- |
| Maks. RPS     | Son kademedeki saniyede istek sayısı               |
| Süre (s)      | Toplam süre, kademeler arasında eşit paylaştırılır |
| Kademe Sayısı | Kademe sayısı (varsayılan 2–10)                    |

Form, sen yazarken planı gösterir. Örneğin:

> 4 kademe: 100 → 200 → 300 → 400 RPS · her biri 5 sn

Her kademe en az 2 saniye sürmeli ve Maks. RPS kademe sayısından az olamaz. Kademelerin hızları tam sayıya yuvarlanır.

**Önce hangisi?** Sunucunun sınırlarını henüz bilmiyorsan kademeli bir testle başla. Kabaca nerede bozulduğunu öğrendikten sonra, o yükte sabit bir test sunucunun orada tutulunca nasıl davrandığını gösterir.

### Başlatmak

**TESTİ BAŞLAT**'a bas. Volta ilk isteği göndermeden önce hedefe ulaşılabildiğini kontrol eder. Projen çalışmıyorsa ya da port yanlışsa test başlamaz ve form nedenini söyler.

Aynı anda sadece bir test çalışabilir.

## Değişkenler

Değişkenler her isteğin farklı değerler göndermesini sağlar. Örneğin bir kayıt adresini her seferinde aynı e-postayla değil, her istekte yeni bir kullanıcıyla test etmek için. Adı çift süslü parantez içinde yaz:

| Değişken       | Örnek (1. istek)                       | Değer                                                                                                     |
| -------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `{{email}}`    | `volta-a1b2c3-1@volta.test`            | `volta-`, test kimliğinin ilk 6 karakteri ve isteğin numarası. Benzersiz.                                 |
| `{{username}}` | `volta_a1b2c3_1`                       | E-posta gibi, `_` ile. Benzersiz.                                                                         |
| `{{name}}`     | `Alex Morgan`                          | Uluslararası bir listeden bir ad ve bir soyad. Benzersiz değil.                                           |
| `{{password}}` | `Kp7#mQ2xWv9L`                         | 12 karakter. Harfle başlar; büyük ve küçük harf, rakam ve sembol içerir.                                  |
| `{{n}}`        | `1`                                    | İsteğin sıra numarası: isteklerin gönderildiği sırayla 1, 2, 3…                                           |
| `{{uuid}}`     | `3f2b8c1e-9a4d-4e7b-8c2a-5d6f7e8a9b0c` | Standart (sürüm 4) biçiminde bir UUID.                                                                    |

**Nerede kullanılır**

- **URL'nin yol ya da sorgu kısmı:** `localhost:3000/api/users/{{n}}`, `localhost:3000/api/check?email={{email}}`. Değerler URL'ye uygun kodlanır (`@`, `%40` olur).
- **JSON gövdesindeki metin değerleri,** tırnak içinde: `"email": "{{email}}"`.
- **Başlık değerleri,** örneğin `X-Request-Id: {{uuid}}`.

Değişkenler adresin sunucu kısmında kullanılamaz (`http://{{n}}.localhost`): Volta adresin yerel olduğunu test öncesinde bir kez kontrol eder, bu yüzden adres aynı kalmalı. `{{emial}}` gibi bilinmeyen bir ad testin başlamasını engeller.

**Neden `.test`?** `.test` alan adı test için ayrılmıştır ve hiçbir zaman gerçek bir siteye ait olamaz. Test ettiğin uygulama her yeni hesaba doğrulama e-postası gönderse bile e-postalar kimseye ulaşmaz.

Her isteğin hangi değerleri gönderdiğini görmek için [CSV](#csv-dışa-aktarma)'yi indir.

### Rastgele kullanıcı

JSON Body bölümünün üstündeki **Rastgele kullanıcı** butonu senin için bir gövde oluşturur. GET seçiliyken ve test çalışırken kilitlidir.

- Her satır bir alan adı ve bir türdür: E-posta, Kullanıcı adı, Ad Soyad, Şifre, Sıra no, UUID ya da **Sabit değer** (değeri sen yazarsın; her istekte aynıdır).
- E-posta, kullanıcı adı ve şifreyle açılır. **Alan ekle** bir satır ekler (en fazla 20), çöp kutusu simgesi bir satırı siler.
- Satırların sırasını değiştirmek için bir satırı tutamağından sürükle. Tutamak seçiliyken `Alt+↑` / `Alt+↓` da onu taşır.
- **Önizleme** gövdeyi örnek değerlerle gösterir; gerçek değerler her istekte farklıdır.
- **GÖVDEYE YAZ** gövdeyi değişkenleriyle (`"email": "{{email}}"`) JSON Body kutusuna yazar. Kutu boş değilse, değiştirmeden önce sorar.

## Test çalışırken

### Canlı grafik

Grafik, cevaplar geldikçe dolar:

- **Ortalama**, **p95** ve **p99** gecikme (sol eksen)
- **Başarılı RPS** ve **Gönderilen RPS** (sağ eksen; sabit testlerde varsayılan olarak gizli)
- Hata olan yerlerde **kırmızı bölgeler**: zaman aşımları, bağlantı hataları ya da 5xx cevaplar

O anın ayrıntılarını görmek için bir noktanın üzerine gel: gecikme değerleri ve o saniyede kaç isteğin gönderildiği, cevaplandığı ve başarılı olduğu.

- Fare tekerleğiyle **yakınlaştır**, sürükleyerek **kaydır**, geri dönmek için **SIFIRLA**'ya bas.
- Grafiğin üstündeki **bir çizgi adına tıklayarak** onu gizle ya da göster.
- Başlığın yanındaki **?** grafiğin nasıl okunacağını anlatır.

### Grafiğin üstündeki göstergeler

- **Volta gecikmesi:** Volta'nın kendi zamanlayıcısının ne kadar geç kaldığı. Birkaç milisaniye normaldir (Windows'ta 10–15 ms civarı). 50 ms'yi geçerse bir uyarı çıkar: Volta'nın kendisi zorlanıyor ve sonuçlar güvenilir olmayabilir.
- **MB/s:** Sunucunun ne kadar veri gönderdiği.

### Kartlar, durum kodları ve istek günlüğü

- **ORTALAMA, İSTEK, EN DÜŞÜK, EN YÜKSEK:** Bütün testin toplamları. Her birinin altındaki küçük _Anlık_ değeri son biten saniyeyi gösterir.
- **Durum Kodu Dağılımı:** Her durum kodu ve hata türü, sayısı ve oranıyla. Açıklama için bir satırın üzerine gel.
- **İstek Günlüğü:** Saniye başına bir satır. Örneğin `[5. sn] 200 req avg 52 ms max 61 ms 200×200`.

Kartlarda, grafik başlıklarında ve özet satırlarında soluk bir **?** simgesi var. Değerin ne anlama geldiğini görmek için üzerine gel.

### Durdurmak

Testi erken bitirmek için **TESTİ DURDUR**'a bas. O ana kadarki sonuçlar kaydedilir ve analiz edilir.

### Sayfayı yenilemek ya da bağlantının kopması

- **Test sırasında sayfayı yenilemek** güvenlidir. Sayfa yeniden bağlanır, formu (başlıklar dahil) doldurur ve grafiği baştan çizer.
- **Sayfa açıkken Volta kapanırsa** bağlantının koptuğunu söyleyen bir kutu çıkar ve yeniden bağlanmayı denemeye devam eder. Volta geri gelince sayfayı yenile.
- **Volta test sırasında kapanırsa** test, Volta bir sonraki açılışında _Yarıda kaldı_ olarak işaretlenir ve çalışan kısmı yine analiz edilir.

### Test bittikten sonra

- Form _Test tamamlandı._ gösterir ve grafik yeni bir test başlatana kadar ekranda kalır.
- Analizini görmek için testi **TEST HISTORY** sayfasından aç.
- Kayıtlı hedeflerinde olmayan bir adresi en az iki kez test ettiysen Volta onu kaydetmeyi önerir. **HAYIR** dersen o adres için bir daha sormaz.

## Kayıtlı hedefler

Sık test ettiğin adresler, senin seçtiğin bir isimle.

**Hedef URL** kutusundaki rehber simgesiyle aç:

- İsme ya da adrese göre **ara**.
- Adresini forma koymak için **bir kayda tıkla**.
- **+** yeni bir kayıt ekler: bir isim (en fazla 40 karakter) ve bir adres. İsimler ve adresler benzersiz olmalı.
- **Çöp kutusu simgesi** bir kaydı siler. Geçmişteki testler silinmez; isim yerine adresle görünürler.

Bir testin adresi kayıtlıysa Volta ismini adresin üstünde gösterir: geçmiş listesinde, test detayında ve raporda. Geçmişte bir isimle arama yapmak o adresin testlerini de bulur.

## Test geçmişi

**TEST HISTORY** sayfası bütün testleri en yeniden başlayarak listeler.

| Sütun           | Anlamı                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------- |
| Tarih / Saat    | Testin başladığı an                                                                         |
| Hedef URL       | İsim (kayıtlıysa) ve adres. Kopyalama simgesi adresi kopyalar.                              |
| Yöntem          | GET ya da POST                                                                              |
| Ort. Gecikme    | Ortalama cevap süresi, altında p95. 500 ms'den itibaren sarı, 1 saniyeden itibaren kırmızı. |
| Gerçekleşen RPS | Saniyede sonuçlanan istek sayısı                                                            |
| Süre            | Gerçek süre                                                                                 |
| Durum           | Çalışıyor, Tamamlandı, Durduruldu, Başarısız ya da Yarıda kaldı                             |

- **Arama** testleri adrese ya da kayıtlı isme göre bulur.
- **Tümü / GET / POST** yönteme göre süzer.
- **Sıralama** en yeni ve en eski arasında geçiş yapar.
- Testi açmak için **bir satıra tıkla**. Yeni sekmede açmak için `Ctrl`'ye (macOS'te `Cmd`) basılı tut.

Bir testten **← Geçmiş** ile döndüğünde liste aynı sayfada açılır ve açtığın testi kısa bir süre vurgular.

### Silmek

- **Tek bir test:** Testi aç ve üstteki çöp kutusu simgesine bas.
- **Hepsi:** Geçmiş sayfasındaki **Veritabanını Temizle** bütün testleri ve sonuçlarını siler. Onaylamak için pencerede gösterilen kelimeyi yaz. Kayıtlı hedefler korunur.

Çalışan bir test silinemez.

## Test detayı

Geçmiş listesinde bir teste tıklayınca açılır.

**Sol sütun**

- **Test Ayarları:** Adres, yöntem, test türü, RPS, süre, durum, tarih; varsa JSON gövdesi ve başlıklar. Gizli başlık değerleri `••••` ve kilit simgesiyle görünür. **YENİDEN ÇALIŞTIR** bu ayarlarla (başlıklar gerçek değerleriyle) DASHBOARD'daki formu doldurur; kontrol edip aynı testi başlatabilirsin.
- **Analiz:** Sonuç, tahmini kapasite, özet bir cümle, uyarılar, olayların zaman çizelgesi ve bir **ÖNERİLER** butonu. Öneriler hazır bir takip testi içerebilir: **BU TESTİ ÇALIŞTIR** formu onunla doldurur. Bkz. [Sonuçları okumak](reading-results.tr.md).

**Sağ sütun**

- **Test Grafiği:** Canlı gördüğün grafiğin, nokta nokta aynısı.
- **Kartlar:** Ortalama, toplam istek, en düşük ve en yüksek.
- **Durum Kodu Dağılımı**
- **Özet:** p95, p99, standart sapma, gerçekleşen RPS, hata oranı, toplam veri ve gerçek süre.
- **Kademeler** (sadece kademeli testlerde): Her kademe için hedef RPS, başarılı RPS, ortalama, p95, hata oranı ve durum.

Cevapların çoğu yönlendirmeyse üstte bir uyarı şeridi çıkar: Volta yönlendirmeleri takip etmez, yani ölçtüğün şey yönlendirmenin kendisiydi.

## Rapor

Test detayındaki **RAPOR AL**, yeni bir sekmede yazdırılabilir bir rapor açar: sonuç, ana ölçümler, grafik, olaylar, kademeler, öneriler, durum kodları, test ayarları ve kısa bir terimler sözlüğü. Gizli başlık değerleri raporda da `••••` olarak görünür.

**PDF OLARAK KAYDET**'e bas ve tarayıcının yazdırma penceresinde hedef olarak _PDF olarak kaydet_'i seç.

Raporun kendi dil seçimi var; Volta'yı hangi dilde kullanırsan kullan raporu Türkçe ya da İngilizce alabilirsin.

## CSV dışa aktarma

Bir testin sonuçlarını, her istek bir satır olacak şekilde CSV dosyası olarak indirir.

- **Test detayı:** Test bittikten sonra **CSV** butonu.
- **DASHBOARD:** Değişken kullanan bir test bitince **Test Kur**'un yanında bir **CSV** butonu çıkar. Bütün sonuçlar kaydedilene kadar soluk kalır.

| Sütun                       | Anlamı                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `n`                         | İsteğin sıra numarası (sadece değişken kullanan testlerde)                                |
| `email`, `password`, …      | İsteğin gönderdiği değerler, kullanılan her değişken için bir sütun (sadece değişken kullanan testlerde) |
| `status`                    | Durum kodu. Cevap gelmediyse boştur; sebebi `error` sütunundadır.                         |
| `error`                     | `TIMEOUT`, `CONNECTION_REFUSED`, `CONNECTION_RESET` ya da `NETWORK_ERROR`                 |
| `response_ms`               | Milisaniye olarak cevap süresi                                                            |
| `sent_at`                   | İsteğin gönderildiği an (ISO 8601, UTC)                                                   |

- Ayırıcı arayüz diline göre seçilir: Türkçede `;`, İngilizcede `,`. Dosya UTF-8 BOM ile başlar; böylece Excel onu doğru okur.
- **Değerler saklanmaz.** CSV'yi indirdiğinde Volta onları testin anahtarından yeniden hesaplar. Aynı test her seferinde aynı değerleri verir.
- **Durdurulan testler:** Testi durdurduğunda hâlâ cevap bekleyen istekler hiç kaydedilmez. Satırları yoktur, bu yüzden numaraları `n` sütununda eksiktir. Sunucu onları yine de işlemiş olabilir (örneğin hesabı oluşturmuş olabilir).

> **⚠️** Şifreler CSV'de açıkça yazılır. Dosyayı paylaşırken dikkatli ol.

## Dil

Sağ üstteki **TR / EN**'i kullan. İlk ziyaretinde Volta tarayıcının dilini kullanır, sonra seçimini hatırlar.
