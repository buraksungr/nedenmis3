# Nedenmiş Studio

Yerel öncelikli, Türkçe bir Windows belgesel prodüksiyon stüdyosu. Konu → senaryo onayı → storyboard onayı → sahne bazlı üretim → doğrulanmış MP4. Varsayılan profil **30 sn hedef, 1080 × 1920, 30 FPS, sinematik 2D, sabit kadraj ve yumuşak geçiş, Türkçe erkek anlatıcı**. Ses süreye uydurulmaz; kurgu gerçek anlatımı izler.

**[Windows x64 kurucusunu indir · 1.0.5](https://github.com/buraksungr/nedenmis3/actions/runs/44223452275/artifacts/14391199938)** · [Test sonuçları ve QA videoları](docs/VALIDATION.md)

## Windows’ta başla

1. **Windows desktop installer** iş akışının başarılı çalıştırmasından `Nedenmis-Studio-Windows-x64` paketini indirip aç. İçindeki `Nedenmis-Studio-1.0.5-Setup.exe` kurulumunu çalıştır. İmzalama sertifikası sağlanmadığı için Windows yayıncıyı doğrulayamaz; yalnızca güvendiğin derlemeyi kur.
2. Masaüstü kısayolundan aç. İlk kurulumda **Yerel servisler** kontrolünü çalıştır. FFmpeg, FFprobe ve Remotion kompozisyonu paketlenir. Render için güncel Microsoft Edge veya Google Chrome yeterlidir; ayrıca Chromium indirilmez, NVIDIA/CUDA gerekmez.
3. **Kesin sözcük zamanları için isteğe bağlı:** **Whisper ortamını kur** işlemi için [Python 3.11 x64](https://www.python.org/downloads/release/python-3119/) ve Python Launcher gereklidir. Bu işlem ayrı bir sanal ortama CPU PyTorch, Whisper ve stable-ts kurar, çok dilli `base` ağırlıklarını indirip doğrular. İnternet ve yaklaşık 2 GB boş alan ayır. Büyük modeller kurucuda yoktur.
4. **Ayarlar → API ve modeller** bölümünde tek Google AI Studio anahtarını gir, **Anahtarı kaydet**, **Bağlantıyı test et**. Anahtarı sohbete, kaynak koda veya `.env` dosyasına koyma.
5. Dönen canlı listeden kullanacağın metin ve TTS modellerini seç. Manuel görsel yükleme için görsel modeli seçmen gerekmez. Metin/TTS için *yalnızca ücretsiz proje* iznini ancak faturalandırması kapalı bir projede ücretsiz kotayı doğruladıysan ver. Model listeleme çağrısı faturalandırma bilgisini döndürmez. Görsel üretim varsayılan olarak kapalıdır: kendin dosya yükle veya seçilen modelin ücretli çağrılarına açıkça izin ver. Başka modele veya ücretli izin düzeyine otomatik geçiş yoktur. Görsel ve TTS istekleri otomatik tekrarlanmaz.
6. **Yeni Video** ile konunu gir. Var olan anlatımın varsa içe aktar. Senaryoyu düzenle/onayla, ardından sahneleri incele. **Onayla ve üret** üretimi başlatır. Eksik yapılandırmayı giderdikten sonra **Üretime devam et** kaydedilen aşamaları kullanır.
7. **Video Önizleme** bölümünde gerçek çıktıyı oynat, sahneye git, MP4/SRT/JSON indir. Ayarlama gerektiren sahneyi yenile. Önceki duruma **Geri al** ile dön.

**Sabit görseller (1.0.6):** Kamera hareketi, dijital zoom, bulanıklık, paralaks ve hareketli kaplamalar kaldırıldı. Yalnızca iki sabit görselin opaklık geçişi var (30 FPS’te en fazla 20 kare, kısa sahnelerde daha kısa). Eski kesme/maske/hareket ayarları da render’a uygulanmaz. Anlatım ve altyazı süreleri değişmez. Önceki bir MP4’ü yeni biçimde üretmek için **Üretim Merkezi → Üretimi başlat** (veya **Üretime devam et**); geçerli görseller, sesler ve altyazılar tekrar kullanılabilir.

**Senaryo üretiminde HTTP 503 (1.0.6):** Senaryo yazımı ve metin revizyonları sunucuda resmî `@google/genai` 3.6.0 ile `POST https://generativelanguage.googleapis.com/v1/models/{seçili-model}:generateContent` kullanır. Gerçek bir HTTP 503 yanıtında aynı istek aynı modelde **1, 2 ve 4 sn** beklenerek en fazla üç kez tekrarlanır (ilk istekle toplam dört). Google daha uzun bir bekleme süresi bildirirse ona uyulur. Bekleme ve deneme numarası iş durumunda ve `production.ndjson` içinde görünür; her deneme yerel istek sayacına girer. Model ve kullanım izni değiştirilmez. Kota, geçersiz anahtar/model, bağlantı kesintisi ve geçersiz yanıtlar bu tekrarı tetiklemez. Kalıcı 503’te taslak ve onaylar korunur; daha sonra **Senaryoyu oluştur / yenile** ile tekrar deneyebilirsin. Yeniden deneme, Google hizmetinin geri geleceğini garanti etmez.

**Hizalama hatasından sonra devam et (1.0.4):** Mevcut projede **Üretim Merkezi → Üretime devam et** yeterli; güncel görsel ve anlatımlar yeniden istenmez. Whisper kurulu değilse, işlem başarısız olursa veya sözcük zamanları geçersizse, o sahnenin **onaylı** anlatımı Türkçe cümlelere ayrılır. Her cümlenin payı sözcük sayısıyla orantılıdır; son cümle FFprobe’un ölçtüğü gerçek ses süresinde biter. MP4 ve SRT bu cümleleri gösterir; JSON’da `sentences[].estimated` ayrımı vardır. Tahmini cümleler `words` alanına yazılmaz ve sözcük vurgusu almaz.

**Nedeni nerede?** **Üretim Merkezi → ilgili sahnenin üretim araçları → Hizalama günlüğü**. Ayrıntılı kayıt terminale ve `Belgeler/NedenmisStudio/Projects/<proje-kimliği>/production.ndjson` dosyasına yazılır: sahne, ses dosyası ve süresi, Python/FFmpeg/FFprobe yolları, varsa süreç hatası veya ilk geçersiz zaman aralığı. **Altyazıyı düzenle** ile cümleleri dinleyerek ayarlayabilir, istersen **Sesi hizala** ile yalnız o sahnede kesin zamanları yeniden deneyebilirsin. Okunamayan ses dosyası, eksik FFmpeg/Remotion veya bozuk MP4 bir altyazı hatası değildir; bu durumlarda üretim başarılı sayılmaz.

**HTTP 404 durumunda:** **Ayarlar → API ve modeller → Bağlantıyı test et** ile listeyi yenile ve hesabına açık bir metin modeli seç. Senaryo için kararlı `v1` model kataloğu kullanılır. Yapılandırılmış JSON storyboard ve görsel/TTS entegrasyonları kendi `v1beta` sözleşmelerini korur; bunlara 503 otomatik tekrarı eklenmedi. Model listeleme üretim yetkisi veya kota garantisi değildir.

**Ücretsiz proje ve manuel görseller (1.0.2):** Ayarlar → API ve modeller’de **Görsel → İstekler kapalı** bırak. Senaryo ve storyboard yalnızca metin modelini kullanır. İki onaydan sonra seçili TTS ile anlatımlar hazırlanır; eksik görsel bir API hatası değil, **Görsel bekleniyor** durumudur. Onaylı storyboard’da veya Üretim Merkezi’nde her boş sahne için **Görsel yükle** ile JPG, PNG veya WebP seç. Tüm görseller hazır olunca **Üretime devam et**; güncel anlatım tekrar istenmez. Yer tutucular MP4’e yazılmaz. Remotion render sırasında, Whisper yalnız kesin sözcük zamanları için kullanılır; görselleri beklerken bu araçlar seslendirmeyi engellemez.

**Konuşmacı:** TTS modelinin altındaki **Konuşmacı (Speaker) seçimi** Gemini’nin 30 hazır sesinden stüdyo varsayılanını belirler (ilk değer: Charon). Henüz seslendirilmemiş ve özel ses seçilmemiş mevcut projeler de bu tercihi kullanır. Tek bir proje için storyboard’da onaydan önce konuşmacıyı seçebilir veya Üretim Merkezi → Prodüksiyon ayarları’ndan değiştirebilirsin. Varsayılanı değiştirmek kayıtlı anlatımları yeniden üretmez; projede konuşmacıyı değiştirmek sonraki üretimde ses ve ona bağlı çıktıları yeniler, görselleri korur. Seçim yapmak API çağrısı başlatmaz. [Google’ın Gemini TTS örneği](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_TTS.ipynb).

**Remotion tarayıcı kontrolü (1.0.1):** Stüdyo, Windows’un varsayılan HTTPS tarayıcısı Edge/Chrome ise onun tam `.exe` yolunu dener. Ardından 64/32 bit `Program Files` ve `%LOCALAPPDATA%` altındaki Edge/Chrome kurulumlarına bakar. Bir tarayıcı bağlantı kuramadan kapanırsa sıradaki denenir. **Ayarlar → Yerel servisler → Servisleri kontrol et** kompozisyonu açar ve çalışan tarayıcının yolunu gösterir. Özel/taşınabilir bir kurulum kullanıyorsan isteğe bağlı `STUDIO_BROWSER` kullanıcı ortam değişkenine tarayıcının tam yolunu verip stüdyoyu tamamen kapatıp açabilirsin; bu yol önce denenir. Kısayol (`.lnk`), klasör veya stüdyonun kendi `.exe` dosyasını seçme.

Üç başlangıç projesi, editoryal metin ve kapak örnekleridir. Onay vermezler, API çağrısı yapmazlar ve bitmiş video olarak sayılmazlar.

## Çalışma ilkeleri

- **Onaylar sunucuda uygulanır.** Onay belirteçleri içerik özetine bağlıdır. Sahne anlatımlarının birleşimi onaylı senaryoya eşit olmalıdır. Sıra/metin değişince yeniden onay gerekir. İstemciden `approved: true` göndermek yeterli değildir.
- **Bir kerede tek üretim.** Uzun işlemler asenkron; ses, hizalama ve kodlama ayrı süreçlerde çalışır. Tek Remotion render işçisi, CPU üzerinde tek Whisper modeli. Kare yüzdesi renderer’dan, aşama durumu gerçek tamamlanan işlemlerden gelir.
- **Ücretli işlemlerden önce ön kontrol.** Tam üretim, ihtiyaç duyulan bulut izinlerini ve yerel servisleri kontrol eder. Kota hatasını bildirir; başarılı varlıkları korur. Bağlantı testi yalnız `models.list` çağrısıdır, üç ayrı üretim servisinin çalıştığı iddia edilmez.
- **Üretilen medya doğrulanır.** Gemini görseli decode edilip JPEG olarak saklanır; WAV/PCM ses örnekleme hızı denetlenir ve FFprobe ile ölçülür. Bozuk varlık başarı sayılmaz. Bir sahnenin görselini, anlatımını veya ses efektini bağımsız değiştirebilirsin.
- **Altyazılar ses verisinden.** Whisper önce bağımsız Türkçe transkripsiyon yapar. Aynı model stable-ts ile onaylı metni ses üzerine zorla hizalar. Metin/ses uyuşmazlığı veya bozuk zaman dizisi günlükte belirtilir; yalnız ilgili sahnede tahmini cümle altyazısına geçilir. Uyarı varsa anlatımı dinleyip metinle eşleştiğini kontrol et. Doğrulanmış sözcükler de tahmini cümleler de üretim merkezinde düzenlenebilir.
- **Görüntü ve ses.** Her sahne sabit bir 9:16 kadrajdır. Remotion kamera, nesne veya atmosfer animasyonu çizmez; yalnızca sonraki görselin opaklığını artırır. FFmpeg özgün prosedürel fon/ambiyans ve Foley’yi veya içe aktarılan sesi kullanır; müzik ducking, yumuşak geçiş ve −16 LUFS hedefli normalizasyon uygular.
- **Artımlı kurgu.** Sahne süreleri gerçek sesin sonunu kesmeyecek şekilde tam kareye yukarı yuvarlanır. Klip kendi ve sıradaki görsele, altyazılara ve gerçek süreye bağlıdır. Eski kamera ayarları klip önbelleğini etkilemez. Klip anahtarı değişmeyen kareler yeniden render edilmez. Son dışa aktarım, klipleri tekrar video kodlamadan birleştirir; ses/görüntü süresi, codec, kare sayısı ve tüm dosyanın decode edilmesi doğrulanır.
- **Sınırlı ve güvenli revizyonlar.** “Altyazı boyutunu küçült”, “Müziği azalt” ve seçili görseli yeniden çizme gibi istekler desteklenir. Belirsiz komutlar uygulanmaz. Anlatım kendiliğinden değiştirilmez; sahne konsepti değişiklikleri yeniden onaylanır.

## Yerel kayıt ve güvenlik

`Belgeler/NedenmisStudio/` içinde SQLite indeks/ayar dosyası ve `Projects/<UUID>/project.json`, `script/`, `storyboard/`, `images/`, `audio/`, `music/`, `scenes/`, `subtitles/`, `renders/`, `cache/`, `versions/` dizinleri bulunur. Dosyalar atomik olarak yayımlanır. Yeniden açılışta indeks diskten toparlanır ve yarım kalan iş başarısız/kurtarılabilir olarak işaretlenir. Sürüm dosyaları ve önceki medya korunur. Proje kartındaki **Yedek indir** proje ve sürümlerini ZIP'e alır; sırlar ve geçici cache dahil edilmez. Geri yüklemek için uygulama kapalıyken yedeği ilgili UUID dizinine aç.

Anahtar yalnız Electron ana sürecinde `safeStorage` ile, Windows’ta mevcut kullanıcıya bağlı DPAPI kullanılarak şifreli saklanır. Kaydedilen anahtarı döndüren API yoktur. Güncelleme/silme model izinlerini sıfırlar. Üretim istekleri ve model kataloğu backend’dedir. Masaüstü API’si yalnız loopback’te, rastgele oturum kanıtıyla çalışır. Renderer sandbox, context isolation ve CSP kullanır. Tarayıcı geliştirme önizlemesi **tek kullanıcılıdır**; anahtarı yalnız süreç belleğinde tutar. Genel internete servis olarak dağıtma.

## Geliştirme

Node.js **22.16+** (22.22 ile test edildi), npm ve modern bir tarayıcı kullan.

```sh
npm ci
npm run dev          # Tek origin: React arayüzü + gerçek yerel API, port 5173
npm run typecheck
npm test
npm run build        # Arayüz, backend ve Remotion kompozisyonu → build/
npm run desktop      # Normal Electron uygulaması
npm run dist:win     # Windows x64: dist/installer/*Setup.exe
```

Tarayıcı modunda veriler `.studio/` altındadır. `STUDIO_HOME` ile değiştirilebilir. Yalnız test veya özel yerel kurulumlar için `STUDIO_BROWSER` (Edge/Chrome **yürütülebilir dosyası**), `STUDIO_PYTHON`, `STUDIO_FFMPEG`, `STUDIO_FFPROBE` desteklenir. Bunlar API anahtarı değildir. Python paketlerini kurmadan senaryo, storyboard, kayıt, ayarlar ve varlık içe aktarma çalışır.

| Dizin | Sorumluluk |
|---|---|
| `desktop/` | Electron uygulama yaşam döngüsü, güvenli kasa, yerel servis ve kurulum denetimi |
| `shared/` | Proje/sahne sözleşmeleri, alan doğrulama ve altyazı gruplama |
| `server/store.ts`, `invalidate.ts` | Onaylar, SQLite, sürümler, artımlı bağımlılıklar |
| `server/gemini.ts`, `planner.ts` | Resmî Google Gen AI SDK (metin), REST (katalog/medya), model keşfi, izinler, senaryo ve storyboard |
| `server/production.ts`, `media.ts`, `render-browser.ts` | Üretim denetleyicisi, render tarayıcısı seçimi, medya doğrulama, ses ve export |
| `python/align.py` | CPU transkripsiyonu + onaylı metne gerçek zorlanmış hizalama |
| `composition/Film.tsx` | Tek paketlenmiş, prop tabanlı Remotion sahne kompozisyonu |
| `ui/` | Türkçe masaüstü çalışma alanı; API anahtarı veya dış sağlayıcı istemcisi içermez |
| `tests/` | İş akışı, red yolları, güvenlik ve gerçek yerel medya denetimleri |

## Doğrulama ve kabul sınırı

`npm test` bozuk dosyaları, onay sırasını, metin bütünlüğünü, eski revizyonları, sürüm geri almayı, kısmi başarıyı, kesintiden dönüşü, kota hatasını ve anahtar/izin yalıtımını kapsar. Sağlayıcı sözleşme testlerindeki taşıma katmanı test çiftidir; normal uygulamada sahte sağlayıcı yoktur.

`npm run build && npm run test:render` (Edge/Chrome gerekir) iki farklı gerçek ses dosyası, harici referans sözcük zamanları ve iki kapakla **gerçek bir 1080 × 1920 H.264/AAC kontrol MP4’ü** üretir. Son dosya ve FFprobe raporu `out/render-control/` altındadır. `static-fade-report.json` her iki resmin özgün piksel değerleriyle eşleşmesini, hareket olmadığını ve görüntü geçişini denetler. İkinci render’da değişmeyen klibin yeniden kullanılmasını da kontrol eder. Ayrı `fallback-control.mp4` ise geçersiz zaman ve bulunamayan Whisper örnekleriyle üretilir; SRT/JSON ve `fallback-diagnostics.ndjson` aynı dizindedir. Bu test sesleri Gemini değildir ve bu kontroller başarılı Whisper hizalamasının kanıtı değildir. Uygulamanın normal üretim yolu referans test verisini kullanmaz.

**“Karıncalar kışın neden ortadan kaybolur?” uçtan uca kabulü henüz tamamlanmış sayılmaz.** Bu geliştirme ortamına gerçek bir Gemini anahtarı sağlanmamıştır. Canlı senaryo, Gemini görsel/TTS kalitesi, gerçek sesle Whisper hizalaması ve 30 sn hedefli bitmiş belgesel ayrıca doğrulanmalıdır. Kullanıcı onaylarını atlayan bir kabul betiği veya sahte tamamlanma durumu yoktur. [Kabul kontrol listesi](docs/ACCEPTANCE.md).

### Entegrasyon kaynakları

[Modelleri listeleme](https://ai.google.dev/api/models) · [Google Gen AI SDK 3.6.0 ve kararlı API seçimi](https://github.com/googleapis/js-genai/tree/v3.6.0#api-selection) · [Google’ın v1 generateContent REST tanımı](https://github.com/googleapis/googleapis/blob/6f8ddc394a90ea2c6a355afd2e9d21f56622df14/google/ai/generativelanguage/v1/generative_service.proto#L36-L52) · [Görsel/TTS: Interactions API](https://ai.google.dev/api/interactions) · [Yapılandırılmış JSON](https://ai.google.dev/gemini-api/docs/structured-output) · [Gemini Image / referans görseller](https://ai.google.dev/gemini-api/docs/image-generation) · [TTS ve WAV/PCM biçimleri](https://ai.google.dev/gemini-api/docs/speech-generation) · [Fiyatlar ve ücretsiz erişim](https://ai.google.dev/gemini-api/docs/pricing) · [stable-ts hizalama](https://github.com/jianfch/stable-ts) · [Remotion lisansı](https://www.remotion.dev/docs/license). Model adları katalogdan seçilir; fiyat ve kota uygulama içine sabitlenmez. Üçüncü taraf bildirimleri `resources/NOTICE.txt` içindedir.

Ek çevrimdışı denetim: `npm run test:ui` derlenmiş arayüzü, izole SQLite deposunu ve gerçek Chromium’u kullanır. Proje oluşturma, otomatik kayıt/yeniden açma, iki onay, dosya yükleme, anahtar yönetimi, yerel denetimler, mobil gezinme ve mevcut kontrol MP4’ünün oynatılmasını sınar. Önce `npm run build` ve `npm run test:render` çalıştırın. `npm run test:render -- --whisper --setup-python` **ayrı ve açıkça indirme gerektiren** akustik testtir: referans altyazıları üretime vermeden gerçek Whisper/stable-ts çalıştırır ve 800 ms sessizlik eklenmiş aynı kayıttaki sözcük zamanlarının akustik kaymayı izlediğini denetler. Yalnız bu test için SHA-256 doğrulamalı, sabitlenmiş Türkçe Piper/DFKI konuşma örneği indirilir (kaynak ve atıf `tests/fixtures/README.md`). Sonuçlar ayrı `out/acoustic-control/` dizinindedir.
