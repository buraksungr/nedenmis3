# Nedenmiş Studio

Yerel öncelikli, Türkçe bir Windows belgesel prodüksiyon stüdyosu. Konu → senaryo onayı → storyboard onayı → sahne bazlı üretim → doğrulanmış MP4. Varsayılan profil **30 sn hedef, 1080 × 1920, 30 FPS, ortak özne ve stile sahip 2D bilim illüstrasyonları, yavaş kamera hareketi ve yumuşak geçiş, Türkçe erkek anlatıcı**. Ses süreye uydurulmaz; kurgu gerçek anlatımı izler.

[Windows x64 Setup · 1.4.1 (ZIP)](https://github.com/buraksungr/nedenmis3/actions/runs/44602679040/artifacts/14569073565) · [Karaya vuran balinalar neden ölür? — tam ekran vektör Windows test filmi](https://github.com/buraksungr/nedenmis3/actions/runs/44602679040/artifacts/14569726840) · [Çizim kaynağı ve doğrulama kaydı](docs/VALIDATION.md)

## Windows’ta başla

1. **Windows desktop installer** iş akışının başarılı çalıştırmasından `Nedenmis-Studio-Windows-x64` paketini indirip aç. İçindeki `Nedenmis-Studio-1.5.0-Setup.exe` kurulumunu çalıştır. İmzalama sertifikası sağlanmadığı için Windows yayıncıyı doğrulayamaz; yalnızca güvendiğin derlemeyi kur.
2. Masaüstü kısayolundan aç. İlk kurulumda **Yerel servisler** kontrolünü çalıştır. FFmpeg, FFprobe ve Remotion kompozisyonu paketlenir. Render için güncel Microsoft Edge veya Google Chrome yeterlidir; ayrıca Chromium indirilmez, NVIDIA/CUDA gerekmez.
3. **Kesin sözcük zamanları için isteğe bağlı:** **Whisper ortamını kur** işlemi için [Python 3.11 x64](https://www.python.org/downloads/release/python-3119/) ve Python Launcher gereklidir. Bu işlem ayrı bir sanal ortama CPU PyTorch, Whisper ve stable-ts kurar, çok dilli `base` ağırlıklarını indirip doğrular. İnternet ve yaklaşık 2 GB boş alan ayır. Büyük modeller kurucuda yoktur.
4. **Sahne planı için OpenRouter veya Gemini metin modeli gerekir.** Gemini kullanacaksan **Ayarlar → API ve modeller** bölümünde senaryo, storyboard metni ve TTS için Google AI Studio anahtarını gir, **Anahtarı kaydet**, **Bağlantıyı test et**. Anahtarı sohbete, kaynak koda veya `.env` dosyasına koyma.
5. Listeden metin ve TTS modellerini seç. *Yalnızca ücretsiz proje* iznini, ancak Google projesinde faturalandırmanın kapalı olduğunu ve ücretsiz kotanı doğruladıysan ver. Yazısız sahne illüstrasyonları ayrı bir servis olan **Pollinations** ile üretilir: aynı ayarlar sekmesinde isteğe bağlı anahtarı kaydet veya eski adresi kullanmak için alanı boş bırak. Başka modele, sağlayıcıya veya ücretli izne otomatik geçiş yoktur.
6. **Yeni Video** ile konunu gir. Var olan anlatımın varsa içe aktar. Senaryoyu düzenle/onayla, ardından sahneleri incele. **Onayla ve üret** üretimi başlatır. Eksik yapılandırmayı giderdikten sonra **Videoyu üret** kaydedilen aşamaları kullanır.
7. **Video Önizleme** bölümünde gerçek çıktıyı oynat, sahneye git, MP4/SRT/JSON indir. Ayarlama gerektiren sahneyi yenile. Önceki duruma **Geri al** ile dön.

### Sinematik bilim illüstrasyonları · 1.5.0

1. **Ayarlar → Sahne planlayıcı** bölümünde OpenRouter veya izin verilen Gemini metin modelini seç. Model artık varsayılan yolda SVG kodu yazmaz. Önce tüm onaylı senaryodan tek bir İngilizce özne tanımı çıkarır; ardından her sahneye İngilizce çekim betimlemesi ve anlatımla örtüşen 2–3 sözcüklük Türkçe başlık yazar. Senaryo, sahne kimlikleri ve anlatım sırası planlayıcıya bırakılmaz.
2. **Storyboard**’da ana özneyi, her görselin tam istemini ve başlığı incele. **Başlığı düzenle** yalnız üst yazıyı değiştirir. Stil, özne ve yazı yasağı her görsel isteğine sunucuda eklenir. **Yalnızca onayla → Eksik illüstrasyonları üret** yalnız resimleri alır. İlk indirmelerde proje tohumu ortaktır. Dikey görseller doğrulandıktan sonra yerel 1080 × 1920 JPEG olarak saklanır.
3. **Bu sahneyi yeniden üret** için istersen “Yeraltındaki karınca tünellerini daha yakından göster” yaz. Türkçe yön İngilizce çekim istemine işlenir, aynı özne/stil kilidi korunur. Yön vermezsen metin modeline gitmeden yeni bir tohumla üretir. İndirme veya dosya doğrulaması başarısızsa önceki görsel ve MP4 korunur. Başarı yalnız hedef görseli değiştirir; sonraki dışa aktarmada hedef klip ve ona geçiş yapan klip yeniden işlenir. Ses ve Whisper zamanları değişmez.
4. **Onayla ve üret / Videoyu üret**: eksik görseller → anlatım → Whisper → klipler → MP4. Yavaş yaklaşma, uzaklaşma, yatay ve dikey kaydırma sahne sırasına göre değişir. Üst ve alt gradyanlar, çok hafif hareketli parçacıklar, yumuşak geçiş ve tek üst başlık Remotion’da eklenir. Alttaki tek altyazıda etkin sözcük `#FACC15` olur. Whisper yoksa mevcut *tahmini cümle* davranışı açıkça belirtilir; tahmin sözcük zamanı olarak sunulmaz.
5. **Durdur** etkin isteği/işi keser; tamamlanan sahneler diskte kalır. **Eksik illüstrasyonları üret** veya **Videoyu üret** çalıştırıldığında hazır görseller tekrar istenmez. Fotoğraf, eski atlas ve katmanlı SVG projeleri açılırken dönüştürülmez; dönüşüm için açıkça **İllüstrasyon planı oluştur** seçilir. [Eski SVG biçimi](docs/ATLAS.md).

### Storyboard görselleri · Pollinations (1.0.7)

**Ayarlar → API ve modeller → Pollinations** alanında [Pollinations gizli anahtarını](https://enter.pollinations.ai/keys) kaydedebilir, güncelleyebilir veya kaldırabilirsin. Anahtar kaydetmek üretim isteği göndermez. İki onaydan sonra, her **Görsel üret** isteği için yalnız bir adres kullanılır:

| Pollinations anahtarı | Sunucunun gönderdiği GET |
|---|---|
| Kayıtlı | `https://gen.pollinations.ai/image/{istem}?width=1080&height=1920` · `Authorization: Bearer` başlığıyla; hesabın bütçesini kullanabilir |
| Yok | `https://image.pollinations.ai/prompt/{istem}?width=1080&height=1920&nologo=true` · kimlik bilgisi gönderilmez; eski servisin kullanılabilirliği garanti edilmez |

**Yeni bilim illüstrasyonunda** `{istem}` İngilizce çekim, ortak özne, palet, `no text, no typography, no labels` ve sabit bilim illüstrasyonu stilidir; ayrıca `seed` kullanılır. **Yalnız klasik fotoğraf sahnelerinde** görsel istemine (boşsa betimlemesine) tam olarak `, nostalgic 2D pixel art style, highly detailed, nature documentary aesthetic` eklenir; **tamamı** tek URL yol bileşeni olarak kodlanır. Sağlayıcıya proje dosyaları veya referans fotoğraflar yüklenmez. İndirme en fazla 90 sn ve 30 MB ile sınırlıdır. Geçerli JPEG/PNG/WebP çözümlenir, sabit bir JPEG olarak `Projects/<UUID>/media/storyboard/` altına yazılır. Storyboard ve render yalnız yerel dosyayı okur.

**Yalnızca onayla** ile istek göndermeden storyboard’da kalabilirsin. **Görsel yükle** her iki yolda da kullanılabilir. Yanıt yoksa, kota doluysa veya dosya bozuksa önceki görsel korunur; başka adrese geçilmez ve otomatik tekrar yapılmaz. İstersen yalnız o sahneyi yeniden dene. **Onayla ve üret** ve **Videoyu üret** hazır varlıkları yeniden kullanır. Tüm görselleri kendin yükleyeceksen ayarlarda **Toplu üretimde eksik görselleri Pollinations ile üret** seçimini kaldır; seslendirmeler hazırlanır, render eksik görselleri bekler.

**Eski fotoğraf modu (1.0.6):** Kamera hareketi, dijital zoom, bulanıklık, paralaks ve hareketli kaplamalar kaldırıldı. Yalnızca iki sabit görselin opaklık geçişi var (30 FPS’te en fazla 20 kare, kısa sahnelerde daha kısa). Eski kesme/maske/hareket ayarları da render’a uygulanmaz. Anlatım ve altyazı süreleri değişmez. Önceki bir MP4’ü yeni biçimde üretmek için **Üretim Merkezi → Videoyu üret**; geçerli görseller, sesler ve altyazılar tekrar kullanılabilir.

**Senaryo üretiminde HTTP 503 (1.0.6):** Senaryo yazımı ve metin revizyonları sunucuda resmî `@google/genai` 3.6.0 ile `POST https://generativelanguage.googleapis.com/v1/models/{seçili-model}:generateContent` kullanır. Gerçek bir HTTP 503 yanıtında aynı istek aynı modelde **1, 2 ve 4 sn** beklenerek en fazla üç kez tekrarlanır (ilk istekle toplam dört). Google daha uzun bir bekleme süresi bildirirse ona uyulur. Bekleme ve deneme numarası iş durumunda ve `production.ndjson` içinde görünür; her deneme yerel istek sayacına girer. Model ve kullanım izni değiştirilmez. Kota, geçersiz anahtar/model, bağlantı kesintisi ve geçersiz yanıtlar bu tekrarı tetiklemez. Kalıcı 503’te taslak ve onaylar korunur; daha sonra **Senaryoyu oluştur / yenile** ile tekrar deneyebilirsin. Yeniden deneme, Google hizmetinin geri geleceğini garanti etmez.

**Hizalama hatasından sonra devam et (1.0.4):** Mevcut projede **Üretim Merkezi → Videoyu üret** yeterli; güncel görsel ve anlatımlar yeniden istenmez. Whisper kurulu değilse, işlem başarısız olursa veya sözcük zamanları geçersizse, o sahnenin **onaylı** anlatımı Türkçe cümlelere ayrılır. Her cümlenin payı sözcük sayısıyla orantılıdır; son cümle FFprobe’un ölçtüğü gerçek ses süresinde biter. MP4 ve SRT bu cümleleri gösterir; JSON’da `sentences[].estimated` ayrımı vardır. Tahmini cümleler `words` alanına yazılmaz ve sözcük vurgusu almaz.

**Nedeni nerede?** **Üretim Merkezi → ilgili sahnenin üretim araçları → Hizalama günlüğü**. Ayrıntılı kayıt terminale ve `Belgeler/NedenmisStudio/Projects/<proje-kimliği>/production.ndjson` dosyasına yazılır: sahne, ses dosyası ve süresi, Python/FFmpeg/FFprobe yolları, varsa süreç hatası veya ilk geçersiz zaman aralığı. **Altyazıyı düzenle** ile cümleleri dinleyerek ayarlayabilir, istersen **Sesi hizala** ile yalnız o sahnede kesin zamanları yeniden deneyebilirsin. Okunamayan ses dosyası, eksik FFmpeg/Remotion veya bozuk MP4 bir altyazı hatası değildir; bu durumlarda üretim başarılı sayılmaz.

**HTTP 404 durumunda:** **Ayarlar → API ve modeller → Bağlantıyı test et** ile listeyi yenile ve hesabına açık bir metin modeli seç. Senaryo için kararlı `v1` model kataloğu kullanılır. Yapılandırılmış JSON storyboard ve Gemini TTS entegrasyonları kendi `v1beta` sözleşmelerini korur; bunlara 503 otomatik tekrarı eklenmedi. Model listeleme üretim yetkisi veya kota garantisi değildir.

**Konuşmacı:** TTS modelinin altındaki **Konuşmacı (Speaker) seçimi** Gemini’nin 30 hazır sesinden stüdyo varsayılanını belirler (ilk değer: Charon). Henüz seslendirilmemiş ve özel ses seçilmemiş mevcut projeler de bu tercihi kullanır. Tek bir proje için storyboard’da onaydan önce konuşmacıyı seçebilir veya Üretim Merkezi → Prodüksiyon ayarları’ndan değiştirebilirsin. Varsayılanı değiştirmek kayıtlı anlatımları yeniden üretmez; projede konuşmacıyı değiştirmek sonraki üretimde ses ve ona bağlı çıktıları yeniler, görselleri korur. Seçim yapmak API çağrısı başlatmaz. [Google’ın Gemini TTS örneği](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_TTS.ipynb).

**Remotion tarayıcı kontrolü (1.0.1):** Stüdyo, Windows’un varsayılan HTTPS tarayıcısı Edge/Chrome ise onun tam `.exe` yolunu dener. Ardından 64/32 bit `Program Files` ve `%LOCALAPPDATA%` altındaki Edge/Chrome kurulumlarına bakar. Bir tarayıcı bağlantı kuramadan kapanırsa sıradaki denenir. **Ayarlar → Yerel servisler → Servisleri kontrol et** kompozisyonu açar ve çalışan tarayıcının yolunu gösterir. Özel/taşınabilir bir kurulum kullanıyorsan isteğe bağlı `STUDIO_BROWSER` kullanıcı ortam değişkenine tarayıcının tam yolunu verip stüdyoyu tamamen kapatıp açabilirsin; bu yol önce denenir. Kısayol (`.lnk`), klasör veya stüdyonun kendi `.exe` dosyasını seçme.

Üç başlangıç projesi, editoryal metin ve kapak örnekleridir. Onay vermezler, API çağrısı yapmazlar ve bitmiş video olarak sayılmazlar.

## Çalışma ilkeleri

- **Onaylar sunucuda uygulanır.** Onay belirteçleri içerik özetine bağlıdır. Sahne anlatımlarının birleşimi onaylı senaryoya eşit olmalıdır. Sıra/metin değişince yeniden onay gerekir. İstemciden `approved: true` göndermek yeterli değildir.
- **Bir kerede tek üretim.** Uzun işlemler asenkron; ses, hizalama ve kodlama ayrı süreçlerde çalışır. Tek Remotion render işçisi, CPU üzerinde tek Whisper modeli. Kare yüzdesi renderer’dan, aşama durumu gerçek tamamlanan işlemlerden gelir.
- **Ücretli işlemlerden önce ön kontrol.** Tam üretim, ihtiyaç duyulan bulut izinlerini ve yerel servisleri kontrol eder. Kota hatasını bildirir; başarılı varlıkları korur. Bağlantı testi yalnız `models.list` çağrısıdır, Pollinations çağrısı veya üretim hakkı testi değildir.
- **Üretilen medya doğrulanır.** Pollinations görseli çözümlenip JPEG olarak saklanır; WAV/PCM ses örnekleme hızı denetlenir ve FFprobe ile ölçülür. Bozuk varlık başarı sayılmaz. Bir sahnenin görselini, anlatımını veya ses efektini bağımsız değiştirebilirsin.
- **Altyazılar ses verisinden.** Whisper önce bağımsız Türkçe transkripsiyon yapar. Aynı model stable-ts ile onaylı metni ses üzerine zorla hizalar. Metin/ses uyuşmazlığı veya bozuk zaman dizisi günlükte belirtilir; yalnız ilgili sahnede tahmini cümle altyazısına geçilir. Uyarı varsa anlatımı dinleyip metinle eşleştiğini kontrol et. Doğrulanmış sözcükler de tahmini cümleler de üretim merkezinde düzenlenebilir.
- **Görüntü ve ses.** Fotoğraf sahneleri sabit 9:16 kadrajdır; kamera veya nesne hareketi eklenmez. Yeni vektör sahnelerinde ortam, ana özne ve efektler ayrı hareket eder. Her iki türde geçiş opaklıkla yapılır. FFmpeg özgün prosedürel fon/ambiyans ve Foley’yi veya içe aktarılan sesi kullanır; müzik ducking, yumuşak geçiş ve −16 LUFS hedefli normalizasyon uygular.
- **Artımlı kurgu.** Sahne süreleri gerçek sesin sonunu kesmeyecek şekilde tam kareye yukarı yuvarlanır. Klip kendi ve sıradaki görsele, altyazılara ve gerçek süreye bağlıdır. Eski kamera ayarları klip önbelleğini etkilemez. Klip anahtarı değişmeyen kareler yeniden render edilmez. Son dışa aktarım, klipleri tekrar video kodlamadan birleştirir; ses/görüntü süresi, codec, kare sayısı ve tüm dosyanın decode edilmesi doğrulanır.
- **Sınırlı ve güvenli revizyonlar.** “Altyazı boyutunu küçült”, “Müziği azalt” ve seçili görseli yeniden çizme gibi istekler desteklenir. Belirsiz komutlar uygulanmaz. Anlatım kendiliğinden değiştirilmez; sahne konsepti değişiklikleri yeniden onaylanır.

## Yerel kayıt ve güvenlik

`Belgeler/NedenmisStudio/` içinde SQLite indeks/ayar dosyası ve `Projects/<UUID>/project.json`, `script/`, `storyboard/`, `media/storyboard/`, `images/`, `audio/`, `music/`, `scenes/`, `subtitles/`, `renders/`, `cache/`, `versions/` dizinleri bulunur. Dosyalar atomik olarak yayımlanır. Yeniden açılışta indeks diskten toparlanır ve yarım kalan iş başarısız/kurtarılabilir olarak işaretlenir. Sürüm dosyaları ve önceki medya korunur. Proje kartındaki **Yedek indir** proje ve sürümlerini ZIP'e alır; sırlar ve geçici cache dahil edilmez. Geri yüklemek için uygulama kapalıyken yedeği ilgili UUID dizinine aç.

Gemini, Pollinations, Groq ve OpenRouter anahtarları ayrı dosyalarda, yalnız Electron ana sürecinde `safeStorage` ile, Windows’ta mevcut kullanıcıya bağlı DPAPI kullanılarak şifreli saklanır. Kaydedilen anahtarı döndüren API yoktur. Gemini anahtarını değiştirmek Gemini model izinlerini sıfırlar; Pollinations anahtarını değiştirmek bunlara dokunmaz. Üretim istekleri ve model kataloğu backend’dedir. Masaüstü API’si yalnız loopback’te, rastgele oturum kanıtıyla çalışır. Renderer sandbox, context isolation ve CSP kullanır. Tarayıcı geliştirme önizlemesi **tek kullanıcılıdır**; anahtarı yalnız süreç belleğinde tutar. Genel internete servis olarak dağıtma.

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
| `server/gemini.ts`, `planner.ts` | Resmî Google Gen AI SDK (metin), REST (katalog/TTS), model keşfi, izinler, senaryo ve storyboard |
| `shared/svg.ts`, `server/svg-planner.ts`, `composition/ScientificPlate.tsx` | Katı plan sözleşmesi, seçilen planlayıcı ve on iki yerel diyagram |
| `server/pollinations.ts` | Anahtar durumuna göre tek GET, kodlanmış sahne istemi, sınırlı ve doğrulanan görsel indirme |
| `server/production.ts`, `media.ts`, `render-browser.ts` | Üretim denetleyicisi, render tarayıcısı seçimi, medya doğrulama, ses ve export |
| `python/align.py` | CPU transkripsiyonu + onaylı metne gerçek zorlanmış hizalama |
| `composition/Film.tsx` | Tek paketlenmiş, prop tabanlı Remotion sahne kompozisyonu |
| `ui/` | Türkçe masaüstü çalışma alanı; API anahtarı veya dış sağlayıcı istemcisi içermez |
| `tests/` | İş akışı, red yolları, güvenlik ve gerçek yerel medya denetimleri |

## Doğrulama ve kabul sınırı

`npm test` bozuk dosyaları, onay sırasını, metin bütünlüğünü, eski revizyonları, sürüm geri almayı, kısmi başarıyı, kesintiden dönüşü, kota hatasını ve anahtar/izin yalıtımını kapsar. Sağlayıcı sözleşme testlerindeki taşıma katmanı test çiftidir; normal uygulamada sahte sağlayıcı yoktur.

`npm run build && npm run test:render` (Edge/Chrome gerekir) iki farklı gerçek ses dosyası, harici referans sözcük zamanları ve iki kapakla **gerçek bir 1080 × 1920 H.264/AAC kontrol MP4’ü** üretir. Ayrıca geçmiş sürümde kaydedilmiş on iki atlas sahnesini ve bir manuel fotoğrafı sıfır sağlayıcı isteğiyle `svg-atlas-control.mp4` olarak render eder. `svg-atlas-report.json`, şemalardaki hareketi ve birleşim karelerini ölçer. Son dosya ve FFprobe raporu `out/render-control/` altındadır. `static-fade-report.json` her iki resmin özgün piksel değerleriyle eşleşmesini, hareket olmadığını ve görüntü geçişini denetler. İkinci render’da değişmeyen klibin yeniden kullanılmasını da kontrol eder. Ayrı `fallback-control.mp4` ise geçersiz zaman ve bulunamayan Whisper örnekleriyle üretilir; SRT/JSON ve `fallback-diagnostics.ndjson` aynı dizindedir. Bu test sesleri Gemini değildir ve bu kontroller başarılı Whisper hizalamasının kanıtı değildir. Uygulamanın normal üretim yolu referans test verisini kullanmaz.

`npm run test:ant` beş sahneli **“Karıncalar kışın nereye gider?”** belgeseli için Windows CPU Whisper, sesli H.264/AAC çıktı, gerçek MP4 karelerine karşı başlık/kamera kontrolleri ve yönlendirmeli tek sahne yenilemesini sınar. Varsayılan CI taşıması, gerçekten görsel üretim aracıyla çizilmiş kayıtlı resimleri ve QA konuşmasını döndürür. Uygulamada böyle bir yedek yoktur. Canlı OpenRouter ve Pollinations kabulü için yetkili anahtarlarla `live_ant` seçilmelidir; bozuk serviste test resmiyle devam edilmez. Bu test canlı Gemini TTS kalitesini veya bir hesabın kotasını doğrulamaz. [Kaynak ve lisans](tests/fixtures/README.md) · [Elle kabul](docs/ACCEPTANCE.md).

### Entegrasyon kaynakları

[Modelleri listeleme](https://ai.google.dev/api/models) · [Google Gen AI SDK 3.6.0 ve kararlı API seçimi](https://github.com/googleapis/js-genai/tree/v3.6.0#api-selection) · [Google’ın v1 generateContent REST tanımı](https://github.com/googleapis/googleapis/blob/6f8ddc394a90ea2c6a355afd2e9d21f56622df14/google/ai/generativelanguage/v1/generative_service.proto#L36-L52) · [Gemini TTS: Interactions API](https://ai.google.dev/api/interactions) · [Yapılandırılmış JSON](https://ai.google.dev/gemini-api/docs/structured-output) · [Pollinations görsel API sözleşmesi](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md) · [TTS ve WAV/PCM biçimleri](https://ai.google.dev/gemini-api/docs/speech-generation) · [Fiyatlar ve ücretsiz erişim](https://ai.google.dev/gemini-api/docs/pricing) · [stable-ts hizalama](https://github.com/jianfch/stable-ts) · [Remotion lisansı](https://www.remotion.dev/docs/license). Model adları katalogdan seçilir; fiyat ve kota uygulama içine sabitlenmez. Üçüncü taraf bildirimleri `resources/NOTICE.txt` içindedir.

Ek çevrimdışı denetim: `npm run test:ui` derlenmiş arayüzü, izole SQLite deposunu ve gerçek Chromium’u kullanır. Proje oluşturma, otomatik kayıt/yeniden açma, iki onay, çevrimdışı Pollinations hatasından manuel yüklemeye geçiş, anahtarlı üretimden dönen yerel resim ve anahtar yönetimi, yerel denetimler, mobil gezinme ve mevcut kontrol MP4’ünün oynatılmasını sınar. Önce `npm run build` ve `npm run test:render` çalıştırın. `npm run test:render -- --whisper --setup-python` **ayrı ve açıkça indirme gerektiren** akustik testtir: referans altyazıları üretime vermeden gerçek Whisper/stable-ts çalıştırır ve 800 ms sessizlik eklenmiş aynı kayıttaki sözcük zamanlarının akustik kaymayı izlediğini denetler. Yalnız bu test için SHA-256 doğrulamalı, sabitlenmiş Türkçe Piper/DFKI konuşma örneği indirilir (kaynak ve atıf `tests/fixtures/README.md`). Sonuçlar ayrı `out/acoustic-control/` dizinindedir.

`npm run test:whale`, yedi katmanlı çekim, tek tık ses ve **gerçek Windows CPU Whisper** yolunu sınar. Her çekimin bitmiş MP4 karesi, üç katmanı ayrı ayrı gizlenmiş ve dondurulmuş referanslarla ve başlıksız referansla karşılaştırılır. `report.json` sanat kaynağını ayırır: açıkça yapılandırılmış canlı metin sağlayıcısı veya CI anahtarı yoksa yalnız testteki özgün vektör yanıtlarının tekrarı. Kesin canlı kabul için `-- --require-live`; üretimde test yanıtı veya yerel yedek yoktur. [Koşullar ve atıflar](tests/fixtures/README.md).

`npm run test:flight`, Windows CPU kabulünde aynı 12 sahneyi **tek üretim işiyle** Türkçe ses, gerçek Whisper zamanları, SRT/JSON ve MP4 olarak doğrular. Girdi senaryosu, test sesinin kaynağı ve yeniden çalıştırma adımları: [test kayıtları](tests/fixtures/README.md).
