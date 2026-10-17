# Sonuçları okumak

[English](reading-results.md) | **Türkçe**

Volta'nın neyi ölçtüğü, grafiğin neyi gösterdiği ve otomatik analizin sonuçlarına nasıl vardığı.

- [Ölçümler](#ölçümler)
- [Grafik](#grafik)
- [Analiz](#analiz)
  - [Sonuç](#sonuç)
  - [Tahmini kapasite](#tahmini-kapasite)
  - [Olaylar](#olaylar)
  - [Kademeler tablosu](#kademeler-tablosu)
  - [Öneriler](#öneriler)
  - [Uyarılar](#uyarılar)
- [Özel durumlar](#özel-durumlar)
- [Analizin sınırları](#analizin-sınırları)

## Ölçümler

| Ölçüm | Anlamı |
|---|---|
| **Ortalama** | Cevap gelen ya da zaman aşımına uğrayan isteklerin ortalama süresi. Bağlantı hataları dahil değil: Anında döndükleri için sunucuyu olduğundan hızlı gösterirlerdi. |
| **p95** | İsteklerin %95'i bu süreden hızlı cevaplandı. En yavaş %5'i dışarıda bırakır, kullanıcıların çoğunun yaşadığı en kötü durumu gösterir. |
| **p99** | İsteklerin %99'u bu süreden hızlı cevaplandı. p95'ten çok yüksekse bazı istekler arada bir çok yavaş demektir. |
| **En düşük / En yüksek** | En hızlı ve en yavaş cevap. En yüksek değer zaman aşımına eşitse (varsayılan 2,5 sn) en az bir istek zaman aşımına uğramış demektir. |
| **Standart sapma** | Cevap sürelerinin ne kadar değiştiği. Küçükse tutarlı; büyükse bazen hızlı, bazen yavaş. |
| **Gerçekleşen RPS** | Bütün test boyunca saniyede sonuçlanan istek sayısı (toplam istek ÷ gerçek süre), hatalar dahil. |
| **Hata oranı** | Sunucu hatası (5xx) ya da cevap alınamayan (zaman aşımı, bağlantı hatası) isteklerin oranı. |
| **Gerçek süre** | İlk istekten son cevaba kadar. Ayarlanan süreden biraz uzun olabilir, çünkü Volta hâlâ yolda olan isteklerin cevabını bekler. |

**4xx cevaplar neden hata değil?** 401, 404 ya da 429 bilinçli bir cevaptır: Sunucu çalışıyor ve isteği reddetmeyi seçti. Volta bunları hata oranına katmaz; ama cevapların çoğu 4xx ise analiz seni uyarır, çünkü o durumda test ayarların büyük ihtimalle yanlıştır (bkz. [Öneriler](#öneriler)).

**Yüzdelikler** en yakın sıra yöntemiyle hesaplanır; Volta'nın her yerinde (canlı grafik, özet ve analiz) aynı şekilde.

**Gecikme renkleri.** Geçmiş listesinde, kademeler tablosunda ve raporda **500 ms** ve üstü gecikmeler sarı, **1 saniye** ve üstü kırmızı gösterilir.

## Grafik

| Çizgi | Eksen |
|---|---|
| Ortalama (sarı), p95 (cyan), p99 (lavanta) | Gecikme, sol |
| Başarılı RPS (düz) ve Gönderilen RPS (kesikli) | Saniyede istek, sağ |
| Kırmızı bölgeler | O anda oluşan hatalar |

Nasıl okunur:

- **Ortalama ve p95 düz ve birbirine yakın:** Sunucu sağlıklı.
- **Ortalama düzken p95 ve p99 yükseliyor:** Kuyruk oluşmaya başlıyor. Bu genelde zorlanmanın ilk işaretidir.
- **Başarılı RPS, Gönderilen RPS'in altına düşüyor:** Sunucu gelen isteklere yetişemiyor.
- **Kırmızı bölgeler:** Zaman aşımları, bağlantı hataları ya da 5xx cevaplar.
- **İlk anlarda kısa bir yükselme:** Bağlantılar kuruluyor. Normaldir ve analiz ilk saniyeyi hesaba katmaz.

Grafik her sonucu **cevabının geldiği** ana yerleştirir: O anda sunucunun ne gönderdiğini gösterir. Yavaş bir sunucuda (diyelim her istek 2 saniye) grafik 2. saniyeden başlar, çünkü ondan önce hiçbir cevap gelmemiştir.

## Analiz

Analiz, bitmiş bir testi açtığında çalışır. Ham sonuçlar üzerinde saniye saniye çalışır ve her sonucu isteğin **gönderildiği** saniyeye yerleştirir. Cevapladığı soru şu: *Sunucu o saniyede gönderilen yükü kaldırabildi mi?*

Bu yüzden bir olay, grafikte gördüğünden birkaç saniye önce görünebilir. 17. saniyede gönderilen istekler 2,5 saniye sonra zaman aşımına uğrarsa, analiz *"Hatalar başladı"* olayını 17'de yazar, grafik ise 19,5'te kırmızıya döner.

İlk saniye ısınmadır ve sonuç için kullanılmaz (kademe onu dışarıda bırakamayacak kadar kısa değilse).

### Sonuç

Her kademe (sabit testte bütün test) dört durumdan birini alır: **Sağlıklı**, **Sınırda**, **Zorlandı** ya da **Çöktü**. Beş ölçüm kontrol edilir ve **en kötüsü belirler**:

| Ölçüm | Sınırda | Zorlandı | Çöktü |
|---|---|---|---|
| **Hata oranı** (5xx ve cevap alınamayan istekler) | ≥ %1 | ≥ %5 | ≥ %25 |
| **Bağlantı hataları** (reddedilen ya da kopan bağlantılar) | | | ≥ %1 |
| **Başarılı istek ÷ hedef istek** | %90'ın altı | %75'in altı | %50'nin altı |
| **p95, başlangıç seviyesine göre** | Başlangıç seviyesinin ≥ 2 katı ve en az +50 ms | Başlangıç seviyesinin ≥ 5 katı ve en az +200 ms | |
| **p95, sabit sınırlar** | ≥ 500 ms | ≥ 1000 ms | |
| **Yükselme eğilimi** (kuyruk birikmesi) | Kademenin sonundaki p95, başındakinin ≥ 1,5 katı ve en az +100 ms | | |

İstekler gönderildiği hâlde hiç cevap gelmediyse durum **Çöktü**'dür.

**Başlangıç seviyesi**, sunucunun sağlıklı gecikmesidir: İlk kademede, ısınmadan sonraki ilk 3 saniyenin p95'lerinin ortancası; bağlantı hatası olan saniyeler hariç. "En az +50 / +200 ms" kısmı çok hızlı adreslerde yanlış alarmı önler: 3 ms'den 7 ms'ye çıkmak iki kattan fazla yavaşlamaktır, ama bir önemi yoktur.

İlk saniyeden itibaren zaten yavaş olan bir sunucunun sağlıklı bir başlangıç seviyesi yoktur. Analiz bunu söyler (*"Sunucu ilk saniyeden itibaren zorlandı"*) ve sabit sınırlara dayanır.

**Yükselme eğilimi**, bir kademenin ilk birkaç saniyesindeki p95 ortancasını son birkaç saniyesiyle karşılaştırır. Cevap gelen en az 4 saniyeye ihtiyaç duyar; bu yüzden çok kısa kademelerde görülemez.

Üstte gösterilen sonuç, test edilen **en yüksek yükteki** durumdur. Altındaki cümle bütün hikâyeyi anlatır. Örneğin:

> Sunucu 100 RPS'e kadar sağlıklı çalıştı, 200 RPS'te zorlanmaya başladı, 300 RPS'te zorlandı, 400 RPS'te çöktü.

Bütün eşikler `src/analysis/thresholds.ts`'te.

### Tahmini kapasite

| Gösterim | Anlamı |
|---|---|
| **200–300 RPS** | 200'ü karşıladı, 300'de bozuldu. Gerçek sınır ikisinin arasında bir yerde. |
| **≥ 400 RPS** | Test edilen her şeyi karşıladı. Sınır bulunmadı; daha yüksek bir yük dene. |
| **< 100 RPS** | İlk kademeyi (ya da sabit yükü) bile karşılayamadı. |

Bir kademe Sağlıklı'ysa ya da **sadece** gecikme arttığı için Sınırda'ysa karşılanmış sayılır. Hatası ya da eksik cevabı olan bir Sınırda kademe sayılmaz.

Kapasite tek bir testten çıkan bir tahmindir. Testi tekrarla: Tam sınırdaki sonuçlar, çalıştırmadan çalıştırmaya bir kademe değişebilir.

### Olaylar

Sonucun altındaki zaman çizelgesi. Saniyeler testin başından, isteklerin gönderildiği ana göre sayılır.

Bir sorun ancak **en az 2 saniye üst üste** sürerse olay olur; böylece tek bir yavaş saniye alarm vermez.

| Olay | Ne zaman çıkar |
|---|---|
| Test başladı · 100 RPS | İlk istek gönderildi |
| Kademe 2 · 200 RPS | Yeni bir kademe başladı |
| Gecikme arttı: p95 52 → 547 ms | p95, başlangıç seviyesine göre Sınırda düzeyine ulaştı (≥ 2 kat ve en az +50 ms) |
| Kuyruk birikiyor: p95 sürekli artıyor | Bir kademede yükselme eğilimi vardı (o kademenin ortasında gösterilir) |
| Hatalar başladı: TIMEOUT | 5xx cevaplar ve zaman aşımları isteklerin %1'ine ulaştı. O saniyedeki kodlar listelenir. |
| Hata oranı zirvede: %100 | Hata oranının en yüksek olduğu saniye, en az %5'e ulaştıysa |
| Sunucuya bağlanılamıyor | Bağlantıların en az %1'i reddedildi ya da koptu, ya da hiç cevap gelmedi |
| Sunucu yeniden cevap veriyor | Bağlantı hatası yok ve hata oranı yine %1'in altında |
| Sunucu ilk saniyeden itibaren zorlandı | Sağlıklı bir başlangıç seviyesi ölçülemedi |
| Test bitti / durduruldu / yarıda kaldı / hatayla bitti | Testin nasıl bittiği |

Bağlantı hatalarının kendi olayı olduğu için *"Hatalar başladı"*ya ayrıca sayılmazlar.

### Kademeler tablosu

Sadece kademeli testlerde. Her kademe için bir satır:

| Sütun | Anlamı |
|---|---|
| Hedef | Kademenin saniyede istek sayısı |
| Başarılı RPS | Bu kademede gönderilen isteklerden saniyede kaçının başarılı olduğu |
| Ortalama, p95 | O isteklerin gecikmesi |
| Hata | Onların hata oranı |
| Durum | Sağlıklı, Sınırda, Zorlandı ya da Çöktü |

Sonuçlar gönderildikleri ana göre sayıldığı için, sunucunun çoktan yavaşladığı bir kademede Başarılı RPS yüksek kalabilir: İstekler başarılı oldu, sadece geç. Durum sütunu yine de sorunu gecikme üzerinden gösterir.

### Öneriler

Olup biteni inceleyip bir sonraki adımda neye bakılacağını öneren kurallar.

**Sunucu hakkında**

| Öneri | Ne zaman çıkar |
|---|---|
| **Sunucu aşırı yükte istekleri reddediyor** | Cevapların en az %1'i 503 ya da 429 ise. (Cevapların çoğu 429 ise burada sadece 503 sayılır; 429'un kendi önerisi var.) |
| **Uygulama hata veriyor** | Başka herhangi bir 5xx kodu cevapların en az %1'iyse |
| **İstekler zaman aşımına uğruyor** | İsteklerin en az %1'i zaman aşımına uğradıysa |
| **Tek bir istek bile zamanında tamamlanmıyor olabilir** | İsteklerin %90'ı ya da fazlası zaman aşımına uğradıysa: Sorun büyük ihtimalle yük değil, isteğin kendisi |
| **Sunucuyla bağlantı koptu** | Bağlantıların en az %1'i reddedildiyse ya da koptuysa |
| **Arada çok yavaş istekler var** | p99, p95'in en az 3 katı **ve** en az 100 ms fazlaysa, hata oranı da %1'in altındaysa |
| **Gecikme yükten değil, isteğin kendisinden** | Sunucu kararlı ama yavaşsa (bkz. [Özel durumlar](#özel-durumlar)) |

**Test hakkında**

| Öneri | Ne zaman çıkar |
|---|---|
| **Cevapların çoğu 4xx** | Cevapların yarısı ya da fazlası 4xx ise (429 hariç): URL, yöntem, gövde ya da kimlik bilgisi yanlış olabilir |
| **Cevapların çoğu yönlendirme** | Cevapların yarısı ya da fazlası 301, 302, 303, 307 ya da 308 ise |
| **Hız sınırlayıcı devrede** | Cevapların yarısı ya da fazlası 429 ise |
| **Az istek: yüzdelikler güvenilir değil** | Ortalama olarak saniyede 10'dan az istek gönderildiyse |

**Sonraki test.** Bunlar hazır bir takip testiyle gelir: **30 saniyede 10 kademeli** bir test. **BU TESTİ ÇALIŞTIR** formu onunla doldurur.

| Öneri | Ne zaman | Takip testi şuna kadar çıkar |
|---|---|---|
| **Kesin sınırı bul** | Kapasite bir aralıksa, örneğin 200–300 | Üst uca (300), daha ince kademelerle |
| **Kapasiteyi bul** | İlk yükü bile karşılayamadıysa, örneğin < 100 | Aynı yüke (100), onun onda birinden başlayarak |
| **Sınıra yakın olabilir** | Yükü karşıladı ama gecikme arttıysa (Sınırda) | Yükün 1,5 katına |
| **Daha yüksek yükle dene** | Yükü rahat karşıladıysa | Yükün 2 katına (Volta'nın üst sınırı zaten kullanıldıysa test önerilmez) |

Takip testleri Volta'nın `MAX_TARGET_RPS` değerini hiçbir zaman aşmaz.

Sonuçlar kapasite hakkında bir şey söyleyemediğinde kapasite önerileri bilerek gösterilmez: Cevapların çoğu 4xx, yönlendirme ya da 429 ise, isteklerin %90'ı zaman aşımına uğradıysa, isteklerin yarısı bağlanamadıysa ya da sunucu kararlı ama yavaşsa.

### Uyarılar

Olayların üstünde gösterilir:

- **Bu testte Volta zorlandı:** Test sırasında Volta'nın kendi gecikmesi 50 ms'yi geçti (ilk saniye hariç). Ölçümler sapmış olabilir. Yükü azalt ya da diğer programları kapat.
- **Test durduruldu / yarıda kaldı / hatayla bitti:** Analiz sadece çalışan kısmı kapsar. Cevabı kaydedilen son istekte biter.
- **Yönlendirmeler, 4xx ya da 429:** Sonuçlar sunucunun gerçek performansını yansıtmıyor.

## Özel durumlar

**Kararlı ama yavaş.** Her istek yaklaşık 2 saniye sürüyor, ama hata yok, sunucu yetişiyor ve gecikme yükle artmıyor: Tek sorun sabit gecikme sınırı. Sonuç yine *Sınırda* (p95 ≥ 500 ms) ya da *Zorlandı* (p95 ≥ 1 sn) olur, ama kapasite *≥ test edilen yük* olarak gösterilir ve cümle *"Sunucu yük altında kararlı ama yavaş"* der. Yükü azaltmak onu hızlandırmaz; bu yüzden Volta kapasite testleri yerine isteğin kendisine bakmayı önerir.

**Hız sınırlayıcı.** Cevapların çoğu 429 ise sunucuyu değil, hız sınırlayıcının ayarını ölçmüşsündür. Test için sınırlayıcıyı kapat ya da Volta'nın isteklerini muaf tut.

**Yönlendirmeler.** Volta yönlendirmeleri takip etmez. Adresin yönlendiriyorsa (örneğin bir giriş sayfasına), doğrudan son adresi gir.

**Çok kısa.** 1 saniyeden kısa süren bir test (örneğin hemen durdurulan) analiz edilmez: Yeterli veri yoktur.

**Durdurulan testler.** Bir testi durdurduğunda, hâlâ yolda olan isteklerin cevapları hiç kaydedilmez. Bu yüzden analiz, cevabı kaydedilen son istekte biter; böylece yavaş bir sunucu, cevap vermeyi bırakmış gibi görünmez.

## Analizin sınırları

Analiz, ölçülen sayılara uygulanan otomatik kurallardan oluşur. Yanılabilir. Volta sunucunu sadece dışarıdan görür: İşlemcini, belleğini, veritabanını ya da loglarını bilmez. Analizi bir başlangıç noktası olarak kullan ve uygulaman hakkında bildiklerinle birlikte değerlendir.

Volta ile test ettiğin sunucu genelde aynı bilgisayarı paylaşır. Yüksek yüklerde aynı işlemci için yarışırlar; bu yüzden yerelde bulunan bir sınır, canlı ortamdaki sınırla aynı olmayabilir.
