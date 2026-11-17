# Nedenmiş Studio

Yerel öncelikli, Türkçe bir Windows belgesel prodüksiyon stüdyosu. Konu → senaryo onayı → storyboard onayı → sahne bazlı üretim → doğrulanmış MP4. Varsayılan profil **30 sn hedef, 1080 × 1920, 30 FPS, sinematik 2D, orta hareket, Türkçe erkek anlatıcı**. Ses süreye uydurulmaz; kurgu gerçek anlatımı izler.

## Windows’ta başla

1. **Windows desktop installer** iş akışının başarılı çalıştırmasından `Nedenmis-Studio-Windows-x64` paketini indirip aç. İçindeki `Nedenmis-Studio-1.0.0-Setup.exe` kurulumunu çalıştır. İmzalama sertifikası sağlanmadığı için Windows yayıncıyı doğrulayamaz; yalnızca güvendiğin derlemeyi kur.
2. Masaüstü kısayolundan aç. İlk kurulumda **Yerel servisler** kontrolünü çalıştır. FFmpeg, FFprobe ve Remotion kompozisyonu paketlenir. Render için Microsoft Edge veya Chrome gerekir; NVIDIA/CUDA gerekmez.
3. **Whisper ortamını kur** işlemi için [Python 3.11 x64](https://www.python.org/downloads/release/python-3119/) ve Python Launcher gereklidir. Bu işlem ayrı bir sanal ortama CPU PyTorch, Whisper ve stable-ts kurar, çok dilli `base` ağırlıklarını indirip doğrular. İnternet ve yaklaşık 2 GB boş alan ayır. Büyük modeller kurucuda yoktur.
4. **Ayarlar → API ve modeller** bölümünde tek Google AI Studio anahtarını gir, **Anahtarı kaydet**, **Bağlantıyı test et**. Anahtarı sohbete, kaynak koda veya `.env` dosyasına koyma.
5. Dönen canlı listeden metin, görsel ve TTS modellerini seç. Metin/TTS için *yalnızca ücretsiz proje* iznini ancak faturalandırması kapalı bir projede ücretsiz kotayı doğruladıysan ver. Model listeleme çağrısı faturalandırma bilgisini döndürmez. Görsel üretim varsayılan olarak kapalıdır: kendin dosya yükle veya seçilen modelin ücretli çağrılarına açıkça izin ver. Başka modele otomatik geçiş ve ücretli otomatik tekrar yoktur.
6. **Yeni Video** ile konunu gir. Var olan anlatımın varsa içe aktar. Senaryoyu düzenle/onayla, ardından sahneleri incele. **Onayla ve üret** üretimi başlatır. Eksik yapılandırmayı giderdikten sonra **Üretime devam et** kaydedilen aşamaları kullanır.
7. **Video Önizleme** bölümünde gerçek çıktıyı oynat, sahneye git, MP4/SRT/JSON indir. Ayarlama gerektiren sahneyi yenile. Önceki duruma **Geri al** ile dön.

Üç başlangıç projesi, editoryal metin ve kapak örnekleridir. Onay vermezler, API çağrısı yapmazlar ve bitmiş video olarak sayılmazlar.

## Çalışma ilkeleri

- **Onaylar sunucuda uygulanır.** Onay belirteçleri içerik özetine bağlıdır. Sahne anlatımlarının birleşimi onaylı senaryoya eşit olmalıdır. Sıra/metin değişince yeniden onay gerekir. İstemciden `approved: true` göndermek yeterli değildir.
- **Bir kerede tek üretim.** Uzun işlemler asenkron; ses, hizalama ve kodlama ayrı süreçlerde çalışır. Tek Remotion render işçisi, CPU üzerinde tek Whisper modeli. Kare yüzdesi renderer’dan, aşama durumu gerçek tamamlanan işlemlerden gelir.
- **Ücretli işlemlerden önce ön kontrol.** Tam üretim, ihtiyaç duyulan bulut izinlerini ve yerel servisleri kontrol eder. Kota hatasını bildirir; başarılı varlıkları korur. Bağlantı testi yalnız `models.list` çağrısıdır, üç ayrı üretim servisinin çalıştığı iddia edilmez.
- **Üretilen medya doğrulanır.** Gemini görseli decode edilip JPEG olarak saklanır; WAV/PCM ses örnekleme hızı denetlenir ve FFprobe ile ölçülür. Bozuk varlık başarı sayılmaz. Bir sahnenin görselini, anlatımını veya efektini bağımsız değiştirebilirsin.
- **Altyazılar ses verisinden.** Whisper önce bağımsız Türkçe transkripsiyon yapar. Aynı model stable-ts ile onaylı metni ses üzerine zorla hizalar. Ciddi metin/ses uyuşmazlığı veya bozuk zaman dizisi üretimi durdurur. Tahmini sözcük zamanları üretilmez. Sözcükler ve zamanlar üretim merkezinde düzenlenebilir.
- **Hareket ve ses.** Planlayıcı serbest metnin yanında tip denetimli kamera, ortam, nesne ve geçiş komutları üretir. Remotion bunları kareye bağlı, deterministik hareketlere dönüştürür. Desteklenenler arasında takip, odak, ön plan paralaksı, kar, toz, ışık, su, kabarcık, sis, yürüyüş izleri, yörüngeler ve açıklayıcı çizgiler vardır. Bu sistem tek görüntüden genel amaçlı karakter iskeleti çıkarmaz. FFmpeg özgün prosedürel fon/ambiyans ve Foley’yi veya içe aktarılan sesi kullanır; müzik ducking, yumuşak geçiş ve −16 LUFS hedefli normalizasyon uygular.
- **Artımlı kurgu.** Sahne süreleri gerçek sesin sonunu kesmeyecek şekilde tam kareye yukarı yuvarlanır. Geçiş komşu sahnenin görseline bağlıdır. Klip anahtarı değişmeyen kareler yeniden render edilmez. Son dışa aktarım, klipleri tekrar video kodlamadan birleştirir; ses/görüntü süresi, codec, kare sayısı ve tüm dosyanın decode edilmesi doğrulanır.
- **Sınırlı ve güvenli revizyonlar.** “İkinci sahnedeki kamerayı yavaşlat”, “Altyazı boyutunu küçült”, “Müziği azalt” ve seçili görseli yeniden çizme gibi istekler desteklenir. Belirsiz komutlar uygulanmaz. Anlatım kendiliğinden değiştirilmez; sahne konsepti değişiklikleri yeniden onaylanır.

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
| `server/gemini.ts`, `planner.ts` | Resmî Gemini REST, model keşfi, izinler, senaryo ve storyboard |
| `server/production.ts`, `media.ts` | Üretim denetleyicisi, süreçler, medya doğrulama, ses ve export |
| `python/align.py` | CPU transkripsiyonu + onaylı metne gerçek zorlanmış hizalama |
| `composition/Film.tsx` | Tek paketlenmiş, prop tabanlı Remotion sahne kompozisyonu |
| `ui/` | Türkçe masaüstü çalışma alanı; API anahtarı veya dış sağlayıcı istemcisi içermez |
| `tests/` | İş akışı, red yolları, güvenlik ve gerçek yerel medya denetimleri |

## Doğrulama ve kabul sınırı

`npm test` bozuk dosyaları, onay sırasını, metin bütünlüğünü, eski revizyonları, sürüm geri almayı, kısmi başarıyı, kesintiden dönüşü, kota hatasını ve anahtar/izin yalıtımını kapsar. Sağlayıcı sözleşme testlerindeki taşıma katmanı test çiftidir; normal uygulamada sahte sağlayıcı yoktur.

`npm run build && npm run test:render` (Edge/Chrome gerekir) iki farklı gerçek ses dosyası, harici referans sözcük zamanları ve iki kapakla **gerçek bir 1080 × 1920 H.264/AAC kontrol MP4’ü** üretir. Son dosya ve FFprobe raporu `out/render-control/` altındadır. İkinci render’da değişmeyen klibin yeniden kullanılmasını da kontrol eder. Bu test sesi Gemini değildir ve bu test Whisper aşamasını temsil etmez. Uygulamanın normal üretim yolu referans test verisini kullanmaz.

**“Karıncalar kışın neden ortadan kaybolur?” uçtan uca kabulü henüz tamamlanmış sayılmaz.** Bu geliştirme ortamına gerçek bir Gemini anahtarı sağlanmamıştır. Canlı senaryo, Gemini görsel/TTS kalitesi, gerçek sesle Whisper hizalaması ve 30 sn hedefli bitmiş belgesel ayrıca doğrulanmalıdır. Kullanıcı onaylarını atlayan bir kabul betiği veya sahte tamamlanma durumu yoktur. [Kabul kontrol listesi](docs/ACCEPTANCE.md).

### Entegrasyon kaynakları (17 Kasım 2026 tarihinde incelendi)

[Modelleri listeleme](https://ai.google.dev/api/models) · [Interactions API](https://ai.google.dev/api/interactions) · [Yapılandırılmış JSON](https://ai.google.dev/gemini-api/docs/structured-output) · [Gemini Image / referans görseller](https://ai.google.dev/gemini-api/docs/image-generation) · [TTS ve WAV/PCM biçimleri](https://ai.google.dev/gemini-api/docs/speech-generation) · [Fiyatlar ve ücretsiz erişim](https://ai.google.dev/gemini-api/docs/pricing) · [stable-ts hizalama](https://github.com/jianfch/stable-ts) · [Remotion lisansı](https://www.remotion.dev/docs/license). Model adları katalogdan seçilir; fiyat ve kota uygulama içine sabitlenmez. Üçüncü taraf bildirimleri `resources/NOTICE.txt` içindedir.

Ek çevrimdışı denetim: `npm run test:ui` derlenmiş arayüzü, izole SQLite deposunu ve gerçek Chromium’u kullanır. Proje oluşturma, otomatik kayıt/yeniden açma, iki onay, dosya yükleme, anahtar yönetimi, yerel denetimler, mobil gezinme ve mevcut kontrol MP4’ünün oynatılmasını sınar. Önce `npm run build` ve `npm run test:render` çalıştırın. `npm run test:render -- --whisper --setup-python` **ayrı ve açıkça indirme gerektiren** akustik testtir: referans altyazıları üretime vermeden gerçek Whisper/stable-ts çalıştırır ve ölçülen sözcük başlangıçlarını ses dosyasındaki bilinen olaylarla karşılaştırır. Sonuçlar ayrı `out/acoustic-control/` dizinindedir.
