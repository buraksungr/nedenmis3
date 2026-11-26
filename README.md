# Nedenmiş Studio

Türkçe Windows belgesel stüdyosu. **1.7.2:** Windows kayıt kilitlerine karşı yeniden deneme, daha görünür bilimsel çizim yönlendirmesi ve geçişte temizlenen etiketler. Tam kare SVG arka planı sabit üst başlık olmadan oynatılır; kısa bilimsel etiketler isteğe bağlıdır. Storyboard’da hazır sahneler, storyboard onayı ve ses beklemeden **sessiz taslak** olarak dışa aktarılabilir. Normal sesli üretim 1080 × 1920, 30 FPS H.264/AAC’dir; sessiz MP4’te ses kanalı yoktur. Kamera sabittir, sahne içindeki nesneler hareket eder ve 30 saniye bir hedeftir.

**[Nedenmiş Studio 1.7.2 · Windows kurucu](https://github.com/buraksungr/nedenmis3/releases/latest)** (`Nedenmis-Studio-1.7.2-Setup.exe`) · [Tüm sürümler](https://github.com/buraksungr/nedenmis3/releases) · [Doğrulama kaydı](docs/VALIDATION.md) · [Sahne biçimi](docs/MOTION.md) · [Kabul kontrolü](docs/ACCEPTANCE.md)

## Windows’ta başla

1. **Releases → Latest** sayfasından `Nedenmis-Studio-1.7.2-Setup.exe` dosyasını indir ve çalıştır. Windows testleri ve temiz kurulum doğrulaması başarıyla tamamlandığında, ilgili `v<sürüm>` etiketiyle kurucu yayımlanır; GitHub bu yayın için e-posta bildirimi gönderir. Yayıncı sertifikası yoktur; yalnızca güvendiğin derlemeyi kur. FFmpeg, FFprobe ve Remotion paketlidir. Güncel Edge veya Chrome gerekir; GPU gerekmez.
2. Gerçek sözcük zamanları için **Yerel servisler → Whisper ortamını kur**. [Python 3.11 x64](https://www.python.org/downloads/release/python-3119/), Python Launcher, internet ve yaklaşık 2 GB boş disk gerekir. CPU PyTorch, çok dilli Whisper `base` ve stable-ts ayrı ortamda çalışır. Model ağırlıkları kurucuda yoktur.
3. **Ayarlar → Sahne planlayıcı:** OpenRouter (`openrouter/free`) veya izin verdiğin Gemini metin modelini seç. Bunlar SVG çizer; fotoğraf servisi, görsel anahtarı veya yerleşik konu şablonu yoktur. Senaryo ve yeni ses için **API ve modeller** bölümünde Gemini hesabını bağla; metin/TTS modelini ve konuşmacıyı seç. Ücretsiz proje iznini ancak faturalandırmanın kapalı olduğunu doğruladıysan ver. Anahtarı sohbete, kaynak koda veya `.env` dosyasına yazma.
4. **Yeni Video:** Konu gir veya kendi senaryonu kullan. **Onayla ve devam et** anlatımı değiştirmeden her sahneyi ayrı SVG olarak hazırlar. Storyboard’daki **Önizleme** veya kare çubuğunda dekor sabit kalırken nesneler yürür, düşer, çizilir, salınır ya da yaylanır. Başlıklar proje bilgisidir, videonun üstüne yazılmaz.
5. **Sessiz taslağı oluştur:** Senaryo onaylandıktan ve en az bir çizim hazır olduktan sonra storyboard onayı beklemeden yalnız hazır sahneleri işle. Ekrandaki X/Y sayısı doğrulanan çizimleri gösterir. Süreler sahne ayarından tahmin edilir; TTS, Whisper, kayıtlı ses, müzik veya efekt kullanılmaz. Taslak, normal üretim dosyalarından ayrı tutulur ve aynı yerden indirilebilir.
6. **Onayla ve üret:** eksik anlatımı seslendir → gerçek kayıt üzerinde Whisper hizalamasını dene → klipleri işle → sesli MP4’ü doğrula. Altta tek altyazı vardır; ölçülmüş sözcük, söylenirken `#FACC15` olur. Whisper yoksa veya ses/metin uyuşmazsa yalnız o sahnede _tahmini cümle_ etiketi ve gerekçe gösterilir, sahte sözcük zamanı üretilmez. **Video Önizleme**’den MP4, SRT ve zaman JSON’unu alabilirsin.

## Kaydet, durdur, devam et

- Her doğrulanmış SVG, bir sonraki istekten önce proje klasörüne yazılır. Desteklenmeyen ama zararsız etiketler sahne reddedilmeden temizlenir; `title`, `desc`, `style`, SMIL, işaretlenmemiş `text`, `metadata`, bilinmeyen dekor öznitelikleri ve tanımsız yerel başvurular çıkar. `layer-fx` içinde işaretlenmiş en fazla iki küçük 1–2 sözcüklük bilimsel etiket kabul edilir. Bir doğrulama hatası kalırsa mesaj sorunlu etiketi adlandırır. Hatalı bir çizimin en fazla iki onarımı vardır; hâlâ hatalıysa sağlam kardeş sahneler kaybolmaz. **Tekrar dene** yalnız o sahneyi, **Eksik sahneleri tamamla** bekleyenleri işler. Düz renk veya gradyan bir arka plan tek başına hata değildir.
- İki eksik sahne arasında **5 sn** beklenir. OpenRouter’dan **HTTP 429** gelirse aynı çizim isteği sırasıyla **10, 20, 35 sn** sonra, en fazla üç kez tekrarlanır; OpenRouter 503 durumunda hata bildirilir. Gemini ise 429/503 için uygun model yedeklerini beklemeden dener. Kalıcı 429’da kuyruk durur; kotan açılınca eksikten devam et. Bağlantı kopmasında ulaşmış olabilecek bir isteği otomatik göndermeyiz.
- **Durdur** sahneler arası beklemeyi, yeniden deneme sayacını, etkin sağlayıcı isteğini, Whisper’ı veya render’ı iptal eder ve alt süreç temizliğini bekler. Tamamlanmış sahne, WAV ve zamanlar korunur. İptal edilmiş bir hizalama tahmini başarıya çevrilmez. Durdurma daha önce işleme alınmış bir bulut isteğinin bedelini geri almaz.
- **Bu sahneyi yeniden üret** için örneğin “Tüneldeki öncü karıncayı büyüt” yaz. Sahne yeniden çizilir. Yeni çizim doğrulanmazsa önceki çizim korunur. Başarıda storyboard yeniden onay ister. Hedef klip ve ona geçiş yapan önceki klip değişir; anlatım aynıysa ses, Whisper zamanları ve altyazı düzeltmeleri değişmez.
- 1.5 ve önceki projeler açılırken değiştirilmez. Kayıtlı JPEG ve katmanlı çizimler yeniden render’da sabit kadrajdadır; eski diyagramların uzun veya büyük yazıları süzülür. Eski MP4 dosyasını oynatmak onu yeniden kodlamaz. İstersen açıkça **Hareketli SVG’ye dönüştür**. Yeni sahne oluşturmak için Pollinations kullanılmaz.

## Yerel kayıt ve geliştirme

Windows’un geçici `EPERM`, `EBUSY` ve `EACCES` dosya kilitleri kısa aralıklarla yeniden denenir; gerekirse aynı geçici dosyadan kopyalama kullanılır. İlerleme kayıtları seyreltilir, kalıcı disk hatası arayüzde bildirilir ve kayıt düzelene kadar aynı projenin düzenlenmesi engellenir. Kopyalama son çaredir, `rename` gibi atomik değildir; disk hatasında uygulamayı kapatmadan erişimi düzeltin.

`Belgeler/NedenmisStudio/Projects/<UUID>/` içinde proje, onaylı metin, storyboard sürümleri, `media/motion/` altında özetle adreslenen özne ve sahne SVG’leri, ses, altyazı, klip ve final dosyaları bulunur. **Yedek indir** önceki sürümlerle birlikte ZIP alır; geçici önbellek ve sırlar dahil edilmez. Masaüstünde kimlik bilgileri Electron `safeStorage`/Windows DPAPI ile saklanır. API oturum kanıtı ister ve yalnız loopback’te dinler. Tarayıcı geliştirme modu tek kullanıcılıdır; anahtarları yalnız süreç belleğinde tutar.

```sh
npm ci                 # Node 22.16+ (CI: 22.22)
npm run dev            # Arayüz + yerel API; port 5173
npm run typecheck && npm test
npm run build          # Arayüz, sunucu ve kompozisyon → build/
npm run desktop        # Electron
npm run dist:win       # Windows x64 NSIS kurucusu → dist/installer/
```

Geliştirme verileri `.studio/` altındadır; `STUDIO_HOME` ile değiştirilebilir. `STUDIO_BROWSER`, `STUDIO_PYTHON`, `STUDIO_FFMPEG`, `STUDIO_FFPROBE` yalnız yürütülebilir dosya seçimidir. `test:render`, `test:stop`, `test:ui` paketlenen yolun render, iptal ve arayüz regresyonlarıdır. Windows’ta `test:ant` **son MP4’te** sabit kamera, hareketli nesneler, ses ve gerçek sözcük zamanlarını ölçer. QA kaynakları ve tekrar çalıştırma ayrıntıları [burada](tests/fixtures/README.md).
