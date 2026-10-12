// Volta sözlüğü ve biçimlendirme araçları.
// Arayüzdeki metinler burada TR ve EN olarak tutulur, kodda t("anahtar") ile kullanılır.
// HTML'de data-i18n="anahtar" ile işaretlenen öğeler applyTranslations() ile doldurulur.
//
// Dil: ilk açılışta tarayıcının dili (Türkçe ise TR, değilse EN), sonra kullanıcının seçimi hatırlanır.
// Dil değişince sayfa yenilenir: ekrandaki her şey baştan, yeni dille kurulur.

const MESSAGES = {
    tr: {
        // --- Üst menü ---
        "nav.dashboard": "DASHBOARD",
        "nav.history": "TEST HISTORY",
        "nav.github": "GitHub",
        "nav.language": "Dil",

        // --- Form ---
        "form.title": "Test Kur",
        "form.url": "Hedef URL",
        "form.method": "Yöntem",
        "form.profile": "Test Türü",
        "form.profile.constant": "Sabit Yük",
        "form.profile.stepped": "Kademeli Artış",
        "form.rps": "Saniyede İstek",
        "form.rpsStepped": "Maks. RPS",
        "form.duration": "Süre (s)",
        "form.steps": "Kademe Sayısı",
        "form.stepPreview": "{count} kademe: {steps} RPS · her biri {seconds} sn",
        "form.stepTooShort": "Her kademe en az {min} sn sürmeli. Süreyi artır ya da kademe sayısını azalt.",
        "form.stepCountRange": "Kademe sayısı {min} ile {max} arasında olmalı.",
        "form.stepRpsTooLow": "Maks. RPS, kademe sayısından ({min}) az olamaz. Her kademe saniyede en az 1 istek göndermeli.",
        "form.rpsRange": "Saniyede istek 1 ile {max} arasında bir tam sayı olmalı.",
        "form.durationRange": "Süre 1 ile {max} saniye arasında bir tam sayı olmalı.",
        "form.body": "JSON Body",
        "form.optional": "Opsiyonel",
        "form.start": "TESTİ BAŞLAT",
        "form.stop": "TESTİ DURDUR",

        // --- Durum mesajları ---
        "state.ready": "Hazır.",
        "state.starting": "Test başlatılıyor...",
        "state.running": "Test çalışıyor.",
        "state.stopping": "Durduruluyor...",
        "state.completed": "Test tamamlandı.",
        "state.stopped": "Test durduruldu.",
        "state.reconnected": "Çalışan teste yeniden bağlanıldı.",
        "state.rerunLoaded": "Ayarlar geçmişten yüklendi. Kontrol edip testi başlatabilirsin.",
        "state.error": "Hata: {message}",
        "state.serverUnreachable": "Volta sunucusuna bağlanılamadı.",
        "state.invalidJson": "JSON Body geçersiz formatta.",

        // --- Grafik ---
        "chart.title": "Canlı Ölçüm",
        "chart.reset": "SIFIRLA",
        "chart.lag": "Volta gecikmesi {ms} ms",
        "chart.dataRate": "{mb} MB/s",
        "chart.warning": "Volta zorlanıyor, sonuçlar güvenilir olmayabilir.",
        "chart.series.avg": "Ortalama",
        "chart.series.p95": "p95",
        "chart.series.p99": "p99",
        "chart.series.completedRps": "Başarılı RPS",
        "chart.series.sentRps": "Gönderilen RPS",
        "chart.tooltip.time": "{value} sn",
        "chart.tooltip.sent": "Gönderilen",
        "chart.tooltip.received": "Cevap gelen",
        "chart.tooltip.success": "Başarılı",
        "chart.tooltip.errors": "Hata",
        "chart.connectionError": "Bağlantı Hatası",
        "chart.help.healthy": "Ortalama ve p95 düz ve birbirine yakınsa sunucu sağlıklı.",
        "chart.help.queue": "Ortalama düzken p95 ve p99 yükseliyorsa kuyruk oluşmaya başlıyor. Bu, zorlanmanın ilk işareti.",
        "chart.help.capacity": "Başarılı RPS, gönderilen RPS'in (kesikli çizgi) altına düşüyorsa sunucu gelen isteklere yetişemiyor.",
        "chart.help.errors": "Kırmızı bölümler o anda hata olduğunu gösterir: timeout, bağlantı hatası ya da 5xx.",
        "chart.help.warmup": "Testin ilk anlarındaki kısa yükselme bağlantıların kurulmasından kaynaklanır, normaldir.",
        "chart.help.controls": "Fare tekerleğiyle yakınlaştır, sürükleyerek kaydır. Çizgi adlarına tıklayarak gizle ya da göster.",

        // --- Metrik kartları ---
        "metric.avg": "ORTALAMA",
        "metric.requests": "İSTEK",
        "metric.min": "EN DÜŞÜK",
        "metric.max": "EN YÜKSEK",
        "metric.live": "Anlık:",
        "unit.count": "adet",

        // --- Durum kodları ve günlük ---
        "statusCard.title": "Durum Kodu Dağılımı",
        "statusCard.empty": "Henüz veri yok.",
        "statusCard.total": "{count} yanıt",
        "statusCard.percent": "%{value}",
        "log.title": "İstek Günlüğü",
        "log.second": "{n}. sn",

        "dashboard.pageTitle": "Volta — Yerel Yük Testi",
        // --- Detay sayfası ---
        "detail.pageTitle": "Volta — Test Detayı",
        "detail.back": "Geçmiş",
        "detail.settings": "Test Ayarları",
        "detail.targetRps": "Hedef RPS",
        "detail.duration": "Süre",
        "detail.status": "Durum",
        "detail.date": "Tarih",
        "detail.steps": "{count} kademe",
        "detail.seconds": "{value} sn",
        "detail.rerun": "YENİDEN ÇALIŞTIR",
        "detail.chartTitle": "Test Grafiği",
        "detail.running": "Bu test hâlâ çalışıyor. Canlı izlemek için",
        "detail.runningLink": "anasayfaya git",
        "detail.redirectWarning": "Hedef adres yönlendirme döndürdü ({codes} · cevapların %{percent} oranı). Volta yönlendirmeleri takip etmez. Asıl sayfayı test etmek istiyorsan doğrudan yönlendirilen adresi gir.",
        "detail.notFoundTitle": "Test bulunamadı",
        "detail.notFoundText": "Bu test silinmiş olabilir ya da bağlantı hatalı.",
        "detail.loadErrorTitle": "Test yüklenemedi",
        "detail.loadErrorText": "Volta sunucusuna ulaşılamadı. Sunucunun çalıştığından emin ol.",
        "detail.backToHistory": "GEÇMİŞE DÖN",
        "detail.summary": "Özet",
        "detail.noSummary": "Bu testte ölçülebilen bir cevap yok.",
        "summary.p95": "p95",
        "summary.p99": "p99",
        "summary.stdDev": "Standart sapma",
        "summary.actualRps": "Gerçekleşen RPS",
        "summary.errorRate": "Hata oranı",
        "summary.totalData": "Toplam veri",
        "summary.duration": "Gerçek süre",
        "runStatus.RUNNING": "Çalışıyor",
        "runStatus.COMPLETED": "Tamamlandı",
        "runStatus.STOPPED": "Durduruldu",
        "runStatus.FAILED": "Başarısız",
        "runStatus.INTERRUPTED": "Yarıda kaldı",


        // --- Geçmiş listesi ---
        "history.pageTitle": "Volta — Test Geçmişi",
        "history.title": "Test Geçmişi",
        "history.subtitle": "Geçmiş yük testlerini, gecikme ve RPS değerlerini incele.",
        "history.countBadge": "{count} TEST",
        "history.newTest": "Yeni Test Başlat",
        "history.searchPlaceholder": "Hedef URL ara... (örn: /api/products)",
        "history.filter.all": "Tümü",
        "history.sort.label": "Sıralama: {value}",
        "history.sort.optionNewest": "En Yeni",
        "history.sort.optionOldest": "En Eski",
        "history.col.date": "Tarih / Saat",
        "history.col.url": "Hedef URL",
        "history.col.method": "Yöntem",
        "history.col.avg": "Ort. Gecikme",
        "history.col.rps": "Gerçekleşen RPS",
        "history.col.duration": "Süre",
        "history.col.status": "Durum",
        "history.loading": "Yükleniyor...",
        "history.loadError": "Geçmiş yüklenemedi.",
        "history.empty": "Henüz test yapılmamış.",
        "history.noMatch": "Bu aramaya ya da filtreye uyan test yok.",
        "history.range": "Toplam {total} test kaydı arasından {from} - {to} gösteriliyor",
        "history.rangeEmpty": "Gösterilecek test yok",
        "history.copyUrl": "URL'yi kopyala",
        "history.p95": "p95: {value}",


        // --- Onay pencereleri ---
        "dialog.cancel": "VAZGEÇ",
        "dialog.typeToConfirm": "Onaylamak için {text} yaz:",
        "deleteTest.button": "TESTİ SİL",
        "deleteTest.runningHint": "Çalışan test silinemez.",
        "deleteTest.title": "Testi sil",
        "deleteTest.message": "Bu test ve tüm sonuçları kalıcı olarak silinecek. Bu işlem geri alınamaz.",
        "deleteTest.confirm": "EVET, SİL",
        "deleteTest.busy": "SİLİNİYOR...",
        "deleteTest.failed": "Test silinemedi.",
        "clearDb.button": "Veritabanını Temizle",
        "clearDb.title": "Veritabanını temizle",
        "clearDb.message": "Tüm test kayıtları ve sonuçları kalıcı olarak silinecek: {count} test. Bu işlem geri alınamaz.",
        "clearDb.empty": "Silinecek test yok.",
        "clearDb.confirmText": "SİL",
        "clearDb.confirm": "TEMİZLE",
        "clearDb.busy": "TEMİZLENİYOR...",
        "clearDb.running": "Çalışan bir test var. Bitmesini bekle ya da durdur.",
        "clearDb.failed": "Veritabanı temizlenemedi.",
        "deleteTest.done": "✓ SİLİNDİ",
        "deleteTest.toast": "Test silindi",
        "clearDb.done": "✓ TEMİZLENDİ",
        "clearDb.toast": "{count} test silindi",



        // --- Bilgi kutuları ---
        "hint.graphPrefix": "Grafikte: {text}",
        "hint.avg.text": "Cevap gelen ve zaman aşımına uğrayan isteklerin ortalama süresi. Bağlantı hataları dahil değil, çünkü anında dönüp ortalamayı yapay olarak düşürürler.",
        "hint.avg.graph": "sarı çizgi",
        "hint.requests.text": "Testte sonuçlanan toplam istek sayısı, hatalılar dahil. Anasayfadaki \"Anlık\" değeri son biten saniyedeki istek sayısıdır.",
        "hint.min.text": "En hızlı cevap. Sunucunun boştayken ne kadar hızlı olabileceğine dair bir fikir verir.",
        "hint.max.text": "En yavaş cevap. 2.500 ms ise en az bir istek zaman aşımına uğramış demektir.",
        "hint.p95.text": "İsteklerin %95'i bu süreden hızlı cevaplandı. En yavaş %5'i dışarıda bırakır, kullanıcıların çoğunun yaşadığı en kötü durumu gösterir.",
        "hint.p95.graph": "cyan çizgi",
        "hint.p99.text": "İsteklerin %99'u bu süreden hızlı cevaplandı. Nadir ama can sıkıcı gecikmeleri gösterir. p95'ten çok yüksekse arada bir çok yavaş istekler var demektir.",
        "hint.p99.graph": "lavanta çizgi",
        "hint.stdDev.text": "Cevap sürelerinin ortalamadan ne kadar saptığı. Küçükse süreler tutarlı, büyükse bazen hızlı bazen yavaş.",
        "hint.stdDev.graph": "çizginin ne kadar dalgalı olduğu",
        "hint.actualRps.text": "Saniyede ortalama kaç isteğin sonuçlandığı (toplam istek ÷ gerçek süre). Hatalı cevaplar dahil. Hedef RPS'in belirgin altındaysa sunucu yetişememiş olabilir.",
        "hint.actualRps.graph": "Başarılı RPS çizgisi saniye saniye gösterir",
        "hint.errorRate.text": "Sunucu hatası (5xx) ya da cevap alınamayan (zaman aşımı, bağlantı hatası) isteklerin oranı. 4xx cevaplar dahil değil, çünkü onlar sunucunun bilinçli reddi.",
        "hint.errorRate.graph": "kırmızı bölgeler",
        "hint.totalData.text": "Sunucudan gelen cevapların toplam boyutu. Büyük cevaplar hem ağı hem sunucuyu daha çok yorar.",
        "hint.duration.text": "İlk isteğin gönderilmesinden son cevabın gelmesine kadar geçen süre. Ayarlanan süreden biraz uzun olabilir, çünkü süre dolunca yolda olan isteklerin cevabı beklenir (en fazla 2,5 sn).",


        // --- URL rehberi ---
        "book.open": "Kayıtlı hedefler",
        "book.title": "Kayıtlı Hedefler",
        "book.searchPlaceholder": "İsim ya da URL ara...",
        "book.add": "Yeni kayıt",
        "book.name": "İsim",
        "book.namePlaceholder": "örn: Test Sunucusu",
        "book.url": "URL",
        "book.save": "KAYDET",
        "book.saving": "KAYDEDİLİYOR...",
        "book.saved": "\"{name}\" kaydedildi",
        "book.saveFailed": "Kaydedilemedi.",
        "book.loading": "Yükleniyor...",
        "book.loadError": "Kayıtlar yüklenemedi.",
        "book.empty": "Henüz kayıtlı hedef yok. + ile ekleyebilirsin.",
        "book.noMatch": "Aramaya uyan kayıt yok.",
        "book.delete": "Sil",
        "book.deleteTitle": "Kaydı sil",
        "book.deleteMessage": "Bu hedef rehberden silinecek. Geçmişteki testler silinmez, sadece isim yerine URL ile görünür.",
        "book.deleteConfirm": "EVET, SİL",
        "book.deleteBusy": "SİLİNİYOR...",
        "book.deleteFailed": "Kayıt silinemedi.",
        "book.deleted": "Kayıt silindi",
        "dialog.close": "Kapat",

        "suggest.title": "Bu adresi rehbere kaydetmek ister misin?",
        "suggest.no": "HAYIR",
        "suggest.save": "KAYDET",


        // --- Analiz ---
        "analysis.title": "Analiz",
        "analysis.loading": "Analiz hazırlanıyor...",
        "analysis.pending": "Analiz test bitince hazırlanacak.",
        "analysis.empty": "Analiz için yeterli veri yok.",
        "analysis.loadError": "Analiz yüklenemedi.",
        "analysis.capacity": "Tahmini kapasite",
        "analysis.events": "Olaylar",
        "analysis.seconds": "{value} sn",
        "analysis.disclaimer": "Otomatik kurallarla üretildi, %100 doğru olmayabilir.",
        "hint.analysisDisclaimer.text": "Bu analiz, ölçülen sayılara uygulanan otomatik kurallarla üretilmiştir ve %100 doğru olmayabilir. Volta sunucuyu dışarıdan ölçer, içeride ne olduğunu göremez. Sonuçları kendi bilginle birlikte değerlendir.",
        "analysis.recommendations": "ÖNERİLER ({count})",
        "analysis.voltaOverloaded": "Bu testte Volta zorlandı, sonuçlar güvenilir olmayabilir.",
        "analysis.ended.STOPPED": "Test durduruldu. Analiz sadece durana kadarki kısmı kapsıyor.",
        "analysis.ended.INTERRUPTED": "Volta test sırasında kapandı, test yarıda kaldı. Analiz sadece o ana kadarki kısmı kapsıyor.",
        "analysis.ended.FAILED": "Test bir hata yüzünden yarıda kaldı. Analiz sadece o ana kadarki kısmı kapsıyor.",
        "analysis.redirectsNotice": "Sonuçlar asıl sayfayı değil, yönlendirme cevabını ölçüyor.",
        "analysis.clientErrorsNotice": "Cevapların çoğu 4xx: test ayarları yanlış olabilir, sonuçlar sunucunun gerçek performansını yansıtmayabilir.",

        "health.HEALTHY": "Sağlıklı",
        "health.BORDERLINE": "Sınırda",
        "health.STRAINED": "Zorlandı",
        "health.COLLAPSED": "Çöktü",

        "capacity.approx": "{rps}–{breakAt} RPS",
        "capacity.atLeast": "≥ {rps} RPS",
        "capacity.below": "< {rps} RPS",

        "verdict.healthyUpTo": "Sunucu {rps} RPS'e kadar sağlıklı çalıştı",
        "verdict.subject": "Sunucu",
        "verdict.part": "{rps} RPS'te {verb}",
        "verdict.outage": "Sunucu {second}. saniyeye kadar {rps} RPS'i sorunsuz karşıladı, sonra bağlantı koptu. Sunucu yük altında çökmüş ya da kapatılmış olabilir.",
        "verdict.connectionLost": "Sunucuyla bağlantı koptu.",
        "verb.BORDERLINE": "zorlanmaya başladı",
        "verb.STRAINED": "zorlandı",
        "verb.COLLAPSED": "çöktü",
        "verdict.atLeast": "Sunucu test edilen en yüksek yükü ({rps} RPS) sorunsuz karşıladı. Sınır görülmedi.",
        "verdict.atLeastConstant": "Sunucu {rps} RPS'i sorunsuz karşıladı.",
        "verdict.belowStepped": "Sunucu ilk kademede ({rps} RPS) bile zorlandı.",
        "verdict.belowConstant": "Sunucu {rps} RPS'i karşılayamadı.",
        "verdict.slowButStable": "Sunucu yük altında kararlı ama yavaş: p95 {p95} ms.",

        "event.start": "Test başladı · {rps} RPS",
        "event.step": "Kademe {index} · {rps} RPS",
        "event.unhealthyFromStart": "Sunucu ilk saniyeden itibaren zorlandı, sağlıklı bir başlangıç seviyesi ölçülemedi",
        "event.latencyRise": "Gecikme arttı: p95 {from} → {to} ms",
        "event.queueRising": "Kuyruk birikiyor: p95 sürekli artıyor ({from} → {to} ms)",
        "event.errorsStart": "Hatalar başladı: {codes}",
        "event.errorPeak": "Hata oranı zirvede: %{rate}",
        "event.connectionLost": "Sunucuya bağlanılamıyor",
        "event.recovered": "Sunucu yeniden cevap veriyor",
        "event.end": "Test bitti",
        "event.stopped": "Test durduruldu",
        "event.interrupted": "Test yarıda kaldı (Volta kapandı)",
        "event.failed": "Test hatayla bitti",

        "rec.dialogTitle": "Öneriler",
        "rec.runTest": "BU TESTİ ÇALIŞTIR",
        "rec.followUp": "Kademeli · maks. {rps} RPS · {steps} kademe · {duration} sn",
        "rec.overload.title": "Sunucu aşırı yükte istekleri reddediyor ({codes})",
        "rec.overload.text": "Sunucu kapasitesini aşan istekleri bilinçli olarak geri çeviriyor ya da hız sınırlayıcı devrede. Uygulamanın eşzamanlı istek sınırını ve sunucu kaynaklarını (CPU, bellek) gözden geçir.",
        "rec.timeouts.title": "İstekler zaman aşımına uğruyor",
        "rec.timeouts.text": "İstekler işleniyor ama 2,5 saniye içinde bitmiyor. Yavaş veritabanı sorgularını (eksik indeksler), dış servis çağrılarını ve bekleten (senkron) işlemleri incele.",
        "rec.tooSlow.title": "Tek bir istek bile 2,5 saniyede tamamlanmıyor olabilir",
        "rec.tooSlow.text": "İsteklerin neredeyse tamamı zaman aşımına uğradı. Volta 2,5 saniyeden uzun süren istekleri zaman aşımı sayar. Sorun yük değil, isteğin kendisi olabilir: adresi tarayıcıda ya da tek bir istekle dene, kaç saniye sürdüğüne bak.",
        "rec.serverErrors.title": "Uygulama hata veriyor ({codes})",
        "rec.serverErrors.text": "Sunucu loglarındaki hata mesajlarına bak. Sadece yük altında ortaya çıkan bir hata olabilir: dolan bağlantı havuzu, eşzamanlılık hataları, yetersiz bellek.",
        "rec.connection.title": "Sunucuyla bağlantı koptu",
        "rec.connection.text": "Sunucu test sırasında çökmüş, yeniden başlamış ya da bağlantıları kesmiş olabilir. Sunucu loglarına ve bellek kullanımına bak.",
        "rec.tailLatency.title": "Arada çok yavaş istekler var",
        "rec.tailLatency.text": "İsteklerin çoğu hızlı (p95 {p95} ms) ama bir kısmı çok daha yavaş (p99 {p99} ms). Önbellek kaçırmaları, çöp toplayıcı duraklamaları ya da kilitlenmeler olabilir.",
        "rec.clientErrors.title": "Cevapların çoğu 4xx (%{share})",
        "rec.clientErrors.text": "Test ayarları yanlış olabilir: URL, yöntem, JSON Body ya da kimlik bilgisi. Bu durumda sonuçlar sunucunun gerçek performansını yansıtmayabilir.",
        "rec.redirects.title": "Cevapların çoğu yönlendirme ({codes} · %{share})",
        "rec.redirects.text": "Volta yönlendirmeleri takip etmez. Asıl sayfayı test etmek istiyorsan doğrudan yönlendirilen adresi gir.",
        "rec.slowButStable.title": "Gecikme yükten değil, isteğin kendisinden",
        "rec.slowButStable.text": "Sunucu yük altında kararlı ama her istek yavaş (p95 {p95} ms). Tek bir isteğin neden bu kadar sürdüğünü incele: yavaş sorgu, dış servis çağrısı, büyük cevaplar.",
        "rec.narrowCapacity.title": "Kesin sınırı bul",
        "rec.narrowCapacity.text": "Kırılma {from} ile {to} RPS arasında. Bu aralığı daha ince adımlarla test et:",
        "rec.findCapacity.title": "Kapasiteyi bul",
        "rec.findCapacity.text": "Sunucu {rps} RPS'i karşılayamadı. Düşük bir yükle başlayıp kademe kademe artan bir testle sınırı bul:",
        "rec.noLimitFound.title": "Daha yüksek yükle dene",
        "rec.noLimitFound.text": "Sunucu test edilen yükü ({rps} RPS) rahat kaldırdı. Sınırı bulmak için daha yüksek bir yükle tekrar dene:",
        "rec.noLimitFound.maxed": "Sunucu Volta'nın üst sınırını ({rps} RPS) rahat kaldırdı. Bu sunucunun sınırını bulmak için Volta'nın kapasitesi yeterli değil.",
        "rec.lowSample.title": "Az istek: yüzdelikler güvenilir değil",
        "rec.lowSample.text": "Saniyede 10'dan az istek gönderildiği için p95 ve p99 az sayıda isteğe dayanıyor. Daha net sonuç için RPS'i artır.",

        "steps.title": "Kademeler",
        "steps.col.step": "Kademe",
        "steps.col.target": "Hedef",
        "steps.col.actual": "Gerçekleşen",
        "steps.col.avg": "Ortalama",
        "steps.col.p95": "p95",
        "steps.col.errors": "Hata",
        "steps.col.state": "Durum",


        // --- Rapor ---
        "report.pageTitle": "Volta — Yük Testi Raporu",
        "report.button": "RAPOR AL",
        "report.runningHint": "Rapor test bitince alınabilir.",
        "report.toolbar": "Rapor önizlemesi",
        "report.printHint": "Yazdırma penceresinde hedef olarak \"PDF olarak kaydet\"i seç.",
        "report.back": "TESTE DÖN",
        "report.savePdf": "PDF OLARAK KAYDET",
        "report.loading": "Rapor hazırlanıyor...",
        "report.pending": "Test hâlâ çalışıyor. Rapor test bitince alınabilir.",
        "report.title": "Yük Testi Raporu",
        "report.generatedAt": "Rapor tarihi",
        "report.result": "Sonuç",
        "report.keyMetrics": "Ana Ölçümler",
        "report.chart": "Test Grafiği",
        "report.analysisUnavailable": "Bu test için analiz hazırlanamadı.",
        "report.events": "Olaylar",
        "report.eventTime": "Zaman",
        "report.eventText": "Olay",
        "report.steps": "Kademeler",
        "report.recommendations": "Öneriler",
        "report.noRecommendations": "Öneri yok.",
        "report.suggestedTest": "Önerilen test: {settings}",
        "report.statusCodes": "Durum Kodları",
        "report.col.code": "Kod",
        "report.col.name": "Açıklama",
        "report.col.count": "Adet",
        "report.col.share": "Oran",
        "report.col.category": "Kategori",
        "report.settings": "Test Ayarları",
        "report.totalRequests": "Toplam istek",
        "report.maxLag": "Volta'nın en yüksek gecikmesi",
        "report.glossary": "Terimler",
        "report.aboutAnalysis": "Bu analiz hakkında",
        "report.footer": "Volta {version} ile oluşturuldu",



        // --- Cevap gelmeyen isteklerin kısa adları ---
        "status.name.TIMEOUT": "Zaman aşımı",
        "status.name.CONNECTION_REFUSED": "Bağlantı reddedildi",
        "status.name.CONNECTION_RESET": "Bağlantı koptu",
        "status.name.NETWORK_ERROR": "Ağ hatası",

        // --- Bilgi kutusundaki etiketler ---
        "status.tag.success": "Başarılı",
        "status.tag.redirect": "Yönlendirme · takip edilmez",
        "status.tag.clientError": "Sunucu sağlıklı · hata sayılmaz",
        "status.tag.serverError": "Sunucu hatası · hata oranına dahil",

        // --- Durum kodu açıklamaları ---
        "status.200": "Başarılı. Sunucu isteği işledi.",
        "status.201": "Oluşturuldu. Sunucu yeni bir kayıt oluşturdu.",
        "status.204": "Başarılı, içerik yok.",
        "status.301": "Kalıcı yönlendirme. Volta yönlendirmeleri takip etmez, test ettiğin adres başka bir adrese yönlendiriyor.",
        "status.302": "Yönlendirme. Volta yönlendirmeleri takip etmez, test ettiğin adres başka bir adrese yönlendiriyor.",
        "status.304": "Değişmedi. Sunucu önbellekteki sürümü kullanmayı önerdi.",
        "status.400": "Hatalı istek. Gönderilen veri eksik ya da yanlış biçimde. JSON Body'yi kontrol et.",
        "status.401": "Yetkisiz. Kimlik doğrulama başarısız, örneğin şifre yanlış. Sunucu sağlıklı çalışıyor.",
        "status.403": "Yasak. Bu işlem için izin yok. Sunucu sağlıklı çalışıyor.",
        "status.404": "Bulunamadı. Adres yanlış olabilir.",
        "status.405": "Yöntem desteklenmiyor. Bu adres seçilen yöntemi (GET/POST) kabul etmiyor.",
        "status.409": "Çakışma. Örneğin bu kayıt zaten var.",
        "status.422": "İşlenemeyen veri. Veri biçim olarak doğru ama kurallara uymuyor.",
        "status.429": "Çok fazla istek. Sunucunun hız sınırlayıcısı devreye girdi, sunucu kendini koruyor.",
        "status.500": "Sunucu hatası. Sunucuda beklenmeyen bir hata oluştu. Sunucu loglarını kontrol et.",
        "status.502": "Geçersiz ağ geçidi. Aradaki bir sunucu (örneğin Nginx) arkadaki uygulamadan cevap alamadı.",
        "status.503": "Servis kullanılamıyor. Sunucu aşırı yüklü ve yeni istekleri reddediyor.",
        "status.504": "Ağ geçidi zaman aşımı. Aradaki bir sunucu arkadaki uygulamayı beklerken süre doldu.",
        "status.TIMEOUT": "2,5 saniye içinde cevap gelmedi. Sunucu yük altında yetişemiyor olabilir. İstek sunucu tarafında yine de işlenmiş olabilir.",
        "status.CONNECTION_REFUSED": "Bağlantı reddedildi. Sunucu çalışmıyor ya da port yanlış.",
        "status.CONNECTION_RESET": "Bağlantı koptu. Sunucu cevap vermeden bağlantıyı kesti, çökmüş ya da yeniden başlatılmış olabilir.",
        "status.NETWORK_ERROR": "Ağ hatası. Sunucuya ulaşılırken beklenmeyen bir sorun oluştu.",
        "status.group.2xx": "Başarılı.",
        "status.group.3xx": "Yönlendirme.",
        "status.group.4xx": "İstemci hatası. İstek sunucu tarafından reddedildi.",
        "status.group.5xx": "Sunucu hatası.",
        "status.unknown": "Bilinmeyen durum.",


        // --- Sunucu hataları (kodlar: src/errors.ts) ---
        "error.INVALID_URL": "Geçerli bir URL girilmeli.",
        "error.INVALID_METHOD": "Yöntem GET ya da POST olmalı.",
        "error.INVALID_RPS": "Saniyede istek 1 ile {max} arasında bir tam sayı olmalı.",
        "error.INVALID_DURATION": "Süre 1 ile {max} saniye arasında bir tam sayı olmalı.",
        "error.INVALID_PROFILE": "Test türü sabit ya da kademeli olmalı.",
        "error.INVALID_STEP_COUNT": "Kademe sayısı {min} ile {max} arasında olmalı.",
        "error.STEP_TOO_SHORT": "Her kademe en az {min} sn sürmeli. Süreyi artır ya da kademe sayısını azalt.",
        "error.STEP_RPS_TOO_LOW": "Maks. RPS, kademe sayısından ({min}) az olamaz.",
        "error.URL_MALFORMED": "Geçersiz URL biçimi.",
        "error.URL_PROTOCOL": "Sadece http ve https adresleri test edilebilir.",
        "error.URL_UNSPECIFIED": "0.0.0.0 bir hedef adres değil. Bunun yerine localhost kullan.",
        "error.DNS_FAILED": "Adres çözümlenemedi. URL'yi kontrol et.",
        "error.NOT_LOCAL": "Güvenlik nedeniyle sadece yerel adresler (localhost ve özel ağ) test edilebilir.",
        "error.SELF_TARGET": "Volta'nın kendi adresi test edilemez. Test etmek istediğin projenin adresini gir.",
        "error.TARGET_UNREACHABLE": "Hedefe ulaşılamıyor. Projenin çalıştığından ve portun doğru olduğundan emin ol.",
        "error.TEST_ALREADY_RUNNING": "Zaten çalışan bir test var. Bitmesini bekle ya da durdur.",
        "error.START_FAILED": "Test başlatılamadı.",
        "error.NO_ACTIVE_TEST": "Çalışan bir test bulunamadı.",
        "error.TEST_NOT_FOUND": "Test bulunamadı.",
        "error.TEST_RUNNING": "Çalışan bir test silinemez.",
        "error.TEST_UNEXPECTED_ERROR": "Test sırasında beklenmeyen bir hata oluştu.",
        "error.WORKER_EXITED": "Test motoru beklenmedik şekilde durdu.",
        "error.TARGET_NAME_LENGTH": "İsim 1 ile {max} karakter arasında olmalı.",
        "error.TARGET_URL_EXISTS": "Bu URL zaten \"{name}\" adıyla kayıtlı.",
        "error.TARGET_NAME_EXISTS": "\"{name}\" adı zaten kullanılıyor.",
        "error.TARGET_EXISTS": "Bu isim ya da URL zaten kayıtlı.",
        "error.URL_REQUIRED": "URL gerekli.",
        "error.INVALID_ID": "Geçersiz kayıt.",
        "error.TARGET_NOT_FOUND": "Kayıt bulunamadı.",

    },

    en: {
        "nav.dashboard": "DASHBOARD",
        "nav.history": "TEST HISTORY",
        "nav.github": "GitHub",
        "nav.language": "Language",

        "form.title": "Test Setup",
        "form.url": "Target URL",
        "form.method": "Method",
        "form.profile": "Test Type",
        "form.profile.constant": "Constant Load",
        "form.profile.stepped": "Stepped Ramp",
        "form.rps": "Requests / sec",
        "form.rpsStepped": "Max RPS",
        "form.duration": "Duration (s)",
        "form.steps": "Steps",
        "form.stepPreview": "{count} steps: {steps} RPS · {seconds}s each",
        "form.stepTooShort": "Each step must last at least {min}s. Increase the duration or reduce the steps.",
        "form.stepCountRange": "Steps must be between {min} and {max}.",
        "form.stepRpsTooLow": "Max RPS cannot be lower than the number of steps ({min}). Each step must send at least 1 request per second.",
        "form.rpsRange": "Requests per second must be a whole number between 1 and {max}.",
        "form.durationRange": "Duration must be a whole number between 1 and {max} seconds.",
        "form.body": "JSON Body",
        "form.optional": "Optional",
        "form.start": "START TEST",
        "form.stop": "STOP TEST",

        "state.ready": "Ready.",
        "state.starting": "Starting test...",
        "state.running": "Test running.",
        "state.stopping": "Stopping...",
        "state.completed": "Test completed.",
        "state.stopped": "Test stopped.",
        "state.reconnected": "Reconnected to the running test.",
        "state.rerunLoaded": "Settings loaded from history. Review them and start the test.",
        "state.error": "Error: {message}",
        "state.serverUnreachable": "Could not reach the Volta server.",
        "state.invalidJson": "JSON Body is not valid JSON.",

        "chart.title": "Live Measurement",
        "chart.reset": "RESET",
        "chart.lag": "Volta lag {ms} ms",
        "chart.dataRate": "{mb} MB/s",
        "chart.warning": "Volta is under strain, results may be unreliable.",
        "chart.series.avg": "Average",
        "chart.series.p95": "p95",
        "chart.series.p99": "p99",
        "chart.series.completedRps": "Successful RPS",
        "chart.series.sentRps": "Sent RPS",
        "chart.tooltip.time": "{value}s",
        "chart.tooltip.sent": "Sent",
        "chart.tooltip.received": "Responses",
        "chart.tooltip.success": "Successful",
        "chart.tooltip.errors": "Errors",
        "chart.connectionError": "Connection Error",
        "chart.help.healthy": "If average and p95 are flat and close together, the server is healthy.",
        "chart.help.queue": "If p95 and p99 rise while the average stays flat, a queue is starting to form. This is the first sign of strain.",
        "chart.help.capacity": "If successful RPS falls below sent RPS (dashed line), the server can't keep up with incoming requests.",
        "chart.help.errors": "Red sections show errors at that moment: timeouts, connection errors or 5xx.",
        "chart.help.warmup": "A short spike at the very start comes from connections being established and is normal.",
        "chart.help.controls": "Zoom with the mouse wheel, drag to pan. Click a series name to hide or show it.",

        "metric.avg": "AVERAGE",
        "metric.requests": "REQUESTS",
        "metric.min": "MIN",
        "metric.max": "MAX",
        "metric.live": "Now:",
        "unit.count": "reqs",

        "statusCard.title": "Status Codes",
        "statusCard.empty": "No data yet.",
        "statusCard.total": "{count} responses",
        "statusCard.percent": "{value}%",
        "log.title": "Request Log",
        "log.second": "{n}s",


        "dashboard.pageTitle": "Volta — Local Load Testing",
        "detail.pageTitle": "Volta — Test Detail",
        "detail.back": "History",
        "detail.settings": "Test Settings",
        "detail.targetRps": "Target RPS",
        "detail.duration": "Duration",
        "detail.status": "Status",
        "detail.date": "Date",
        "detail.steps": "{count} steps",
        "detail.seconds": "{value}s",
        "detail.rerun": "RUN AGAIN",
        "detail.chartTitle": "Test Chart",
        "detail.running": "This test is still running. To watch it live,",
        "detail.runningLink": "go to the dashboard",
        "detail.redirectWarning": "The target returned redirects ({codes} · {percent}% of responses). Volta does not follow redirects. To test the actual page, enter the redirected address directly.",
        "detail.notFoundTitle": "Test not found",
        "detail.notFoundText": "This test may have been deleted, or the link is wrong.",
        "detail.loadErrorTitle": "Could not load the test",
        "detail.loadErrorText": "Could not reach the Volta server. Make sure it is running.",
        "detail.backToHistory": "BACK TO HISTORY",
        "detail.summary": "Summary",
        "detail.noSummary": "No measurable responses in this test.",
        "summary.p95": "p95",
        "summary.p99": "p99",
        "summary.stdDev": "Standard deviation",
        "summary.actualRps": "Actual RPS",
        "summary.errorRate": "Error rate",
        "summary.totalData": "Total data",
        "summary.duration": "Actual duration",
        "runStatus.RUNNING": "Running",
        "runStatus.COMPLETED": "Completed",
        "runStatus.STOPPED": "Stopped",
        "runStatus.FAILED": "Failed",
        "runStatus.INTERRUPTED": "Interrupted",


        "history.pageTitle": "Volta — Test History",
        "history.title": "Test History",
        "history.subtitle": "Review past load tests, their latency and RPS.",
        "history.countBadge": "{count} TESTS",
        "history.newTest": "New Test",
        "history.searchPlaceholder": "Search target URL... (e.g. /api/products)",
        "history.filter.all": "All",
        "history.sort.label": "Sort: {value}",
        "history.sort.optionNewest": "Newest",
        "history.sort.optionOldest": "Oldest",
        "history.col.date": "Date / Time",
        "history.col.url": "Target URL",
        "history.col.method": "Method",
        "history.col.avg": "Avg. Latency",
        "history.col.rps": "Actual RPS",
        "history.col.duration": "Duration",
        "history.col.status": "Status",
        "history.loading": "Loading...",
        "history.loadError": "Could not load history.",
        "history.empty": "No tests yet.",
        "history.noMatch": "No tests match this search or filter.",
        "history.range": "Showing {from} - {to} of {total} test runs",
        "history.rangeEmpty": "No tests to show",
        "history.copyUrl": "Copy URL",
        "history.p95": "p95: {value}",


        "dialog.cancel": "CANCEL",
        "dialog.typeToConfirm": "Type {text} to confirm:",
        "deleteTest.button": "DELETE TEST",
        "deleteTest.runningHint": "A running test cannot be deleted.",
        "deleteTest.title": "Delete test",
        "deleteTest.message": "This test and all its results will be permanently deleted. This cannot be undone.",
        "deleteTest.confirm": "YES, DELETE",
        "deleteTest.busy": "DELETING...",
        "deleteTest.failed": "Could not delete the test.",
        "clearDb.button": "Clear Database",
        "clearDb.title": "Clear database",
        "clearDb.message": "All test runs and their results will be permanently deleted: {count} tests. This cannot be undone.",
        "clearDb.empty": "There are no tests to delete.",
        "clearDb.confirmText": "DELETE",
        "clearDb.confirm": "CLEAR",
        "clearDb.busy": "CLEARING...",
        "clearDb.running": "A test is running. Wait for it to finish or stop it.",
        "clearDb.failed": "Could not clear the database.",
        "deleteTest.done": "✓ DELETED",
        "deleteTest.toast": "Test deleted",
        "clearDb.done": "✓ CLEARED",
        "clearDb.toast": "{count} tests deleted",


        "hint.graphPrefix": "On the chart: {text}",
        "hint.avg.text": "Average time of requests that got a response or timed out. Connection errors are excluded because they return instantly and would artificially lower the average.",
        "hint.avg.graph": "yellow line",
        "hint.requests.text": "Total number of completed requests, including errors. On the dashboard, \"Now\" is the request count of the last finished second.",
        "hint.min.text": "The fastest response. Gives an idea of how fast the server can be when idle.",
        "hint.max.text": "The slowest response. If it is 2,500 ms, at least one request timed out.",
        "hint.p95.text": "95% of requests were answered faster than this. It leaves out the slowest 5% and shows the worst case most users experience.",
        "hint.p95.graph": "cyan line",
        "hint.p99.text": "99% of requests were answered faster than this. It shows rare but annoying delays. If it is much higher than p95, some requests are occasionally very slow.",
        "hint.p99.graph": "lavender line",
        "hint.stdDev.text": "How much response times deviate from the average. Small means consistent, large means sometimes fast, sometimes slow.",
        "hint.stdDev.graph": "how wavy the line is",
        "hint.actualRps.text": "Average number of completed requests per second (total requests ÷ actual duration), including errors. If clearly below the target RPS, the server may not have kept up.",
        "hint.actualRps.graph": "the Successful RPS line shows it second by second",
        "hint.errorRate.text": "Share of requests with a server error (5xx) or no response (timeout, connection error). 4xx responses are excluded because they are a deliberate rejection by the server.",
        "hint.errorRate.graph": "red areas",
        "hint.totalData.text": "Total size of responses from the server. Large responses put more load on both the network and the server.",
        "hint.duration.text": "Time from the first request sent to the last response received. It can be slightly longer than the configured duration because in-flight requests are awaited (up to 2.5 s).",


        "book.open": "Saved targets",
        "book.title": "Saved Targets",
        "book.searchPlaceholder": "Search name or URL...",
        "book.add": "New entry",
        "book.name": "Name",
        "book.namePlaceholder": "e.g. Test Server",
        "book.url": "URL",
        "book.save": "SAVE",
        "book.saving": "SAVING...",
        "book.saved": "\"{name}\" saved",
        "book.saveFailed": "Could not save.",
        "book.loading": "Loading...",
        "book.loadError": "Could not load saved targets.",
        "book.empty": "No saved targets yet. Add one with +.",
        "book.noMatch": "No entries match your search.",
        "book.delete": "Delete",
        "book.deleteTitle": "Delete entry",
        "book.deleteMessage": "This target will be removed from the list. Past tests are kept and will show their URL instead of the name.",
        "book.deleteConfirm": "YES, DELETE",
        "book.deleteBusy": "DELETING...",
        "book.deleteFailed": "Could not delete the entry.",
        "book.deleted": "Entry deleted",
        "dialog.close": "Close",

        "suggest.title": "Save this address to your targets?",
        "suggest.no": "NO",
        "suggest.save": "SAVE",


        "analysis.title": "Analysis",
        "analysis.loading": "Preparing analysis...",
        "analysis.pending": "Analysis will be ready when the test finishes.",
        "analysis.empty": "Not enough data for an analysis.",
        "analysis.loadError": "Could not load the analysis.",
        "analysis.capacity": "Estimated capacity",
        "analysis.events": "Events",
        "analysis.seconds": "{value}s",
        "analysis.disclaimer": "Generated by automatic rules, may not be 100% accurate.",
        "hint.analysisDisclaimer.text": "This analysis is generated by automatic rules applied to the measured numbers and may not be 100% accurate. Volta measures the server from the outside and cannot see what happens inside. Evaluate the results together with your own knowledge.",
        "analysis.recommendations": "RECOMMENDATIONS ({count})",
        "analysis.voltaOverloaded": "Volta was under strain during this test, results may be unreliable.",
        "analysis.ended.STOPPED": "The test was stopped. The analysis covers only the part before it stopped.",
        "analysis.ended.INTERRUPTED": "Volta shut down during the test, so the test was interrupted. The analysis only covers the part up to that point.",
        "analysis.ended.FAILED": "The test stopped because of an error. The analysis only covers the part up to that point.",
        "analysis.redirectsNotice": "The results measure the redirect response, not the actual page.",
        "analysis.clientErrorsNotice": "Most responses are 4xx: the test settings may be wrong and the results may not reflect the server's real performance.",

        "health.HEALTHY": "Healthy",
        "health.BORDERLINE": "Borderline",
        "health.STRAINED": "Strained",
        "health.COLLAPSED": "Collapsed",

        "capacity.approx": "{rps}–{breakAt} RPS",
        "capacity.atLeast": "≥ {rps} RPS",
        "capacity.below": "< {rps} RPS",

        "verdict.healthyUpTo": "The server was healthy up to {rps} RPS",
        "verdict.subject": "The server",
        "verdict.part": "{verb} at {rps} RPS",
        "verdict.outage": "The server handled {rps} RPS without issues until second {second}, then the connection was lost. The server may have crashed under load or been shut down.",
        "verdict.connectionLost": "The connection to the server was lost.",
        "verb.BORDERLINE": "started to strain",
        "verb.STRAINED": "was strained",
        "verb.COLLAPSED": "collapsed",
        "verdict.atLeast": "The server handled the highest tested load ({rps} RPS) without issues. No limit was reached.",
        "verdict.atLeastConstant": "The server handled {rps} RPS without issues.",
        "verdict.belowStepped": "The server was strained even at the first step ({rps} RPS).",
        "verdict.belowConstant": "The server could not handle {rps} RPS.",
        "verdict.slowButStable": "The server is stable under load but slow: p95 {p95} ms.",

        "event.start": "Test started · {rps} RPS",
        "event.step": "Step {index} · {rps} RPS",
        "event.unhealthyFromStart": "The server was strained from the first second, no healthy baseline could be measured",
        "event.latencyRise": "Latency rose: p95 {from} → {to} ms",
        "event.queueRising": "Queue building up: p95 keeps rising ({from} → {to} ms)",
        "event.errorsStart": "Errors started: {codes}",
        "event.errorPeak": "Error rate peaked: {rate}%",
        "event.connectionLost": "Cannot connect to the server",
        "event.recovered": "The server is responding again",
        "event.end": "Test finished",
        "event.stopped": "Test stopped",
        "event.interrupted": "Test interrupted (Volta shut down)",
        "event.failed": "Test ended with an error",

        "rec.dialogTitle": "Recommendations",
        "rec.runTest": "RUN THIS TEST",
        "rec.followUp": "Stepped · max {rps} RPS · {steps} steps · {duration}s",
        "rec.overload.title": "The server rejects requests under overload ({codes})",
        "rec.overload.text": "The server deliberately turns away requests beyond its capacity, or a rate limiter kicked in. Review the application's concurrency limit and server resources (CPU, memory).",
        "rec.timeouts.title": "Requests are timing out",
        "rec.timeouts.text": "Requests are processed but don't finish within 2.5 seconds. Look into slow database queries (missing indexes), external service calls and blocking (synchronous) work.",
        "rec.tooSlow.title": "Even a single request may not finish within 2.5 seconds",
        "rec.tooSlow.text": "Almost all requests timed out. Volta counts requests taking longer than 2.5 seconds as timeouts. The problem may be the request itself, not the load: open the address in a browser or send a single request and see how long it takes.",
        "rec.serverErrors.title": "The application returns errors ({codes})",
        "rec.serverErrors.text": "Check the error messages in the server logs. It may be an error that only appears under load: an exhausted connection pool, concurrency bugs, insufficient memory.",
        "rec.connection.title": "The connection to the server was lost",
        "rec.connection.text": "The server may have crashed, restarted or dropped connections during the test. Check the server logs and memory usage.",
        "rec.tailLatency.title": "Some requests are very slow",
        "rec.tailLatency.text": "Most requests are fast (p95 {p95} ms) but some are much slower (p99 {p99} ms). Possible causes: cache misses, garbage collection pauses or lock contention.",
        "rec.clientErrors.title": "Most responses are 4xx ({share}%)",
        "rec.clientErrors.text": "The test settings may be wrong: URL, method, JSON Body or credentials. In that case the results may not reflect the server's real performance.",
        "rec.redirects.title": "Most responses are redirects ({codes} · {share}%)",
        "rec.redirects.text": "Volta does not follow redirects. To test the actual page, enter the redirected address directly.",
        "rec.slowButStable.title": "Latency comes from the request itself, not the load",
        "rec.slowButStable.text": "The server is stable under load but every request is slow (p95 {p95} ms). Investigate why a single request takes this long: slow queries, external calls, large responses.",
        "rec.narrowCapacity.title": "Find the exact limit",
        "rec.narrowCapacity.text": "The break point is between {from} and {to} RPS. Test this range in finer steps:",
        "rec.findCapacity.title": "Find the capacity",
        "rec.findCapacity.text": "The server could not handle {rps} RPS. Find the limit with a test that starts low and increases step by step:",
        "rec.noLimitFound.title": "Try a higher load",
        "rec.noLimitFound.text": "The server comfortably handled the tested load ({rps} RPS). Try again with a higher load to find the limit:",
        "rec.noLimitFound.maxed": "The server comfortably handled Volta's upper limit ({rps} RPS). Volta's capacity is not enough to find this server's limit.",
        "rec.lowSample.title": "Few requests: percentiles are unreliable",
        "rec.lowSample.text": "Fewer than 10 requests per second were sent, so p95 and p99 rely on few requests. Increase the RPS for clearer results.",

        "steps.title": "Steps",
        "steps.col.step": "Step",
        "steps.col.target": "Target",
        "steps.col.actual": "Actual",
        "steps.col.avg": "Average",
        "steps.col.p95": "p95",
        "steps.col.errors": "Errors",
        "steps.col.state": "State",


        "report.pageTitle": "Volta — Load Test Report",
        "report.button": "GET REPORT",
        "report.runningHint": "The report is available when the test finishes.",
        "report.toolbar": "Report preview",
        "report.printHint": "In the print dialog, choose \"Save as PDF\" as the destination.",
        "report.back": "BACK TO TEST",
        "report.savePdf": "SAVE AS PDF",
        "report.loading": "Preparing report...",
        "report.pending": "The test is still running. The report is available when it finishes.",
        "report.title": "Load Test Report",
        "report.generatedAt": "Report date",
        "report.result": "Result",
        "report.keyMetrics": "Key Metrics",
        "report.chart": "Test Chart",
        "report.analysisUnavailable": "No analysis could be prepared for this test.",
        "report.events": "Events",
        "report.eventTime": "Time",
        "report.eventText": "Event",
        "report.steps": "Steps",
        "report.recommendations": "Recommendations",
        "report.noRecommendations": "No recommendations.",
        "report.suggestedTest": "Suggested test: {settings}",
        "report.statusCodes": "Status Codes",
        "report.col.code": "Code",
        "report.col.name": "Description",
        "report.col.count": "Count",
        "report.col.share": "Share",
        "report.col.category": "Category",
        "report.settings": "Test Settings",
        "report.totalRequests": "Total requests",
        "report.maxLag": "Volta's highest lag",
        "report.glossary": "Glossary",
        "report.aboutAnalysis": "About this analysis",
        "report.footer": "Generated with Volta {version}",

        "status.name.TIMEOUT": "Timeout",
        "status.name.CONNECTION_REFUSED": "Connection refused",
        "status.name.CONNECTION_RESET": "Connection reset",
        "status.name.NETWORK_ERROR": "Network error",

        "status.tag.success": "Success",
        "status.tag.redirect": "Redirect · not followed",
        "status.tag.clientError": "Server healthy · not counted as error",
        "status.tag.serverError": "Server error · counted as error",

        "status.200": "Success. The server processed the request.",
        "status.201": "Created. The server created a new record.",
        "status.204": "Success, no content.",
        "status.301": "Permanent redirect. Volta does not follow redirects, the address you are testing redirects elsewhere.",
        "status.302": "Redirect. Volta does not follow redirects, the address you are testing redirects elsewhere.",
        "status.304": "Not modified. The server suggested using the cached version.",
        "status.400": "Bad request. The data sent is missing or malformed. Check the JSON Body.",
        "status.401": "Unauthorized. Authentication failed, e.g. wrong password. The server is working fine.",
        "status.403": "Forbidden. No permission for this action. The server is working fine.",
        "status.404": "Not found. The address may be wrong.",
        "status.405": "Method not allowed. This address does not accept the selected method (GET/POST).",
        "status.409": "Conflict. For example, this record already exists.",
        "status.422": "Unprocessable data. The format is valid but it breaks the rules.",
        "status.429": "Too many requests. The server's rate limiter kicked in, the server is protecting itself.",
        "status.500": "Server error. An unexpected error occurred on the server. Check the server logs.",
        "status.502": "Bad gateway. A server in between (e.g. Nginx) got no response from the application behind it.",
        "status.503": "Service unavailable. The server is overloaded and rejecting new requests.",
        "status.504": "Gateway timeout. A server in between timed out waiting for the application behind it.",
        "status.TIMEOUT": "No response within 2.5 seconds. The server may not be keeping up under load. The request may still have been processed on the server.",
        "status.CONNECTION_REFUSED": "Connection refused. The server is not running or the port is wrong.",
        "status.CONNECTION_RESET": "Connection reset. The server closed the connection without responding, it may have crashed or restarted.",
        "status.NETWORK_ERROR": "Network error. An unexpected problem occurred while reaching the server.",
        "status.group.2xx": "Success.",
        "status.group.3xx": "Redirect.",
        "status.group.4xx": "Client error. The request was rejected by the server.",
        "status.group.5xx": "Server error.",
        "status.unknown": "Unknown status.",


        "error.INVALID_URL": "A valid URL is required.",
        "error.INVALID_METHOD": "Method must be GET or POST.",
        "error.INVALID_RPS": "Requests per second must be a whole number between 1 and {max}.",
        "error.INVALID_DURATION": "Duration must be a whole number between 1 and {max} seconds.",
        "error.INVALID_PROFILE": "Test type must be constant or stepped.",
        "error.INVALID_STEP_COUNT": "Steps must be between {min} and {max}.",
        "error.STEP_TOO_SHORT": "Each step must last at least {min}s. Increase the duration or reduce the steps.",
        "error.STEP_RPS_TOO_LOW": "Max RPS cannot be lower than the number of steps ({min}).",
        "error.URL_MALFORMED": "Invalid URL format.",
        "error.URL_PROTOCOL": "Only http and https addresses can be tested.",
        "error.URL_UNSPECIFIED": "0.0.0.0 is not a target address. Use localhost instead.",
        "error.DNS_FAILED": "Could not resolve the address. Check the URL.",
        "error.NOT_LOCAL": "For security, only local addresses (localhost and private networks) can be tested.",
        "error.SELF_TARGET": "Volta's own address cannot be tested. Enter the address of the project you want to test.",
        "error.TARGET_UNREACHABLE": "Cannot reach the target. Make sure your project is running and the port is correct.",
        "error.TEST_ALREADY_RUNNING": "A test is already running. Wait for it to finish or stop it.",
        "error.START_FAILED": "The test could not be started.",
        "error.NO_ACTIVE_TEST": "No running test was found.",
        "error.TEST_NOT_FOUND": "Test not found.",
        "error.TEST_RUNNING": "A running test cannot be deleted.",
        "error.TEST_UNEXPECTED_ERROR": "An unexpected error occurred during the test.",
        "error.WORKER_EXITED": "The test engine stopped unexpectedly.",
        "error.TARGET_NAME_LENGTH": "Name must be between 1 and {max} characters.",
        "error.TARGET_URL_EXISTS": "This URL is already saved as \"{name}\".",
        "error.TARGET_NAME_EXISTS": "The name \"{name}\" is already in use.",
        "error.TARGET_EXISTS": "This name or URL is already saved.",
        "error.URL_REQUIRED": "URL is required.",
        "error.INVALID_ID": "Invalid entry.",
        "error.TARGET_NOT_FOUND": "Entry not found.",
    },
};

// --- Dil seçimi ---

const LANGUAGE_STORAGE_KEY = "volta-lang";
const SUPPORTED_LANGUAGES = ["tr", "en"];

// Kayıtlı seçim varsa o, yoksa tarayıcının dili
function detectLanguage() {
    try {
        const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (SUPPORTED_LANGUAGES.includes(saved)) return saved;
    } catch {
        // Tarayıcı depolamaya izin vermiyorsa tarayıcının diline bak
    }
    return (navigator.language || "").toLowerCase().startsWith("tr") ? "tr" : "en";
}

const currentLanguage = detectLanguage();
document.documentElement.lang = currentLanguage;

export function getLanguage() {
    return currentLanguage;
}

// Dil değişmeden hemen önce çalışacak işler (örneğin formdaki yazılmış değerleri kaydetmek)
const beforeSwitchHandlers = [];

export function onBeforeLanguageSwitch(handler) {
    beforeSwitchHandlers.push(handler);
}

// Dili değiştir ve sayfayı yenile (aynı dil seçildiyse bir şey yapmaz)
export function switchLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang) || lang === currentLanguage) return;

    for (const handler of beforeSwitchHandlers) {
        try {
            handler();
        } catch (err) {
            console.error(err);
        }
    }

    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
        // Kaydedilemezse dil değişmez, sayfa yine aynı dille açılır
    }
    window.location.reload();
}

export function getLocale() {
    return getLanguage() === "en" ? "en-US" : "tr-TR";
}

// Anahtara karşılık gelen metni döndürür. {isim} biçimindeki yer tutucular params'tan doldurulur.
// Seçili dilde yoksa Türkçe'ye, orada da yoksa anahtarın kendisine düşer (eksik çeviri hemen göze çarpsın).
export function t(key, params = {}) {
    const lang = getLanguage();
    let text = MESSAGES[lang]?.[key] ?? MESSAGES.tr[key] ?? key;

    for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value));
    }

    return text;
}

// Sayıyı seçili dilin biçiminde yazar (TR: 1.250,5 · EN: 1,250.5). Değer yoksa "—".
export function formatNumber(value, digits) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";

    const options =
        digits === undefined
            ? { maximumFractionDigits: 2 }
            : { minimumFractionDigits: digits, maximumFractionDigits: digits };

    return Number(value).toLocaleString(getLocale(), options);
}

// Gecikme: her zaman tam sayı milisaniye
export function formatMs(value) {
    if (value === null || value === undefined) return "—";
    return `${formatNumber(Math.round(value))} ms`;
}

// Yüzde: oran (0–1) verilir. TR: %12,5 · EN: 12.5%
export function formatPercent(ratio, digits = 1) {
    if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) return "—";
    const value = formatNumber(ratio * 100, digits);
    return getLanguage() === "en" ? `${value}%` : `%${value}`;
}

// data-i18n ile işaretli öğelerin metnini sözlükten doldurur
export function applyTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.title = t(el.dataset.i18nTitle);
    });
}