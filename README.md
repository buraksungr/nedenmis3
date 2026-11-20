# Nedenmiş Studio

Türkçe Windows belgesel stüdyosu. **1.6.1:** Storyboard, Gemini ve OpenRouter’dan gelen geçici hataları sahne bazında yeniden dener. Yeni projelerde kamera sabittir. Hareket, fotoğrafın üzerinde gezinen bir kameradan değil, sahne içindeki ayrı SVG nesnelerinden gelir. Çıktı 1080 × 1920, 30 FPS H.264/AAC’dir. 30 saniye bir hedeftir; gerçek süre ses kayıtlarından ölçülür.

**[Windows x64 Setup · 1.6.1 (ZIP)](https://github.com/buraksungr/nedenmis3/actions/runs/44753777493/artifacts/14636574247)** · **[Karıncalar kışın nereye gider? · Windows MP4 ve ölçümler](https://github.com/buraksungr/nedenmis3/actions/runs/44753777493/artifacts/14637196987)** · [Doğrulama kaydı](docs/VALIDATION.md) · [Sahne biçimi](docs/MOTION.md) · [Kabul kontrolü](docs/ACCEPTANCE.md)

## Windows’ta başla

1. Yukarıdaki **Windows x64 Setup · 1.6.1 (ZIP)** bağlantısından `Nedenmis-Studio-Windows-x64` arşivini indir, aç ve `Nedenmis-Studio-1.6.1-Setup.exe` kurulumunu çalıştır. Yayıncı sertifikası yoktur; yalnızca güvendiğin derlemeyi kur. FFmpeg, FFprobe ve Remotion paketlidir. Güncel Edge veya Chrome gerekir; GPU gerekmez.
2. Gerçek sözcük zamanları için **Yerel servisler → Whisper ortamını kur**. [Python 3.11 x64](https://www.python.org/downloads/release/python-3119/), Python Launcher, internet ve yaklaşık 2 GB boş disk gerekir. CPU PyTorch, çok dilli Whisper `base` ve stable-ts ayrı ortamda çalışır. Model ağırlıkları kurucuda yoktur.
3. **Ayarlar → Sahne planlayıcı:** OpenRouter (`openrouter/free`) veya izin verdiğin Gemini metin modelini seç. Bunlar SVG çizer; fotoğraf servisi, görsel anahtarı veya yerleşik konu şablonu yoktur. Senaryo ve yeni ses için **API ve modeller** bölümünde Gemini hesabını bağla; metin/TTS modelini ve konuşmacıyı seç. Ücretsiz proje iznini ancak faturalandırmanın kapalı olduğunu doğruladıysan ver. Anahtarı sohbete, kaynak koda veya `.env` dosyasına yazma.
4. **Yeni Video:** Konu gir veya kendi senaryonu kullan. **Onayla ve devam et** önce ortak özne şablonunu, sonra anlatımı değiştirmeden sahneleri hazırlar. Storyboard’da her sahnenin başlığını ve özne sayısını incele. **Önizleme** veya kare çubuğunu kullan: dekor sabit kalırken nesneler yürür, düşer, çizilir, salınır ya da yaylanır.
5. **Onayla ve üret:** eksik anlatımı seslendir → gerçek kayıt üzerinde Whisper hizalamasını dene → klipleri işle → sesli MP4’ü doğrula. Altta tek altyazı vardır; ölçülmüş sözcük, söylenirken `#FACC15` olur. Whisper yoksa veya ses/metin uyuşmazsa yalnız o sahnede *tahmini cümle* etiketi ve gerekçe gösterilir, sahte sözcük zamanı üretilmez. **Video Önizleme**’den MP4, SRT ve zaman JSON’unu alabilirsin.

## Kaydet, durdur, devam et

- Her doğrulanmış SVG, bir sonraki istekten önce proje klasörüne yazılır. Hatalı bir çizimin en fazla iki onarımı vardır; hâlâ hatalıysa sağlam kardeş sahneler kaybolmaz. **Tekrar dene** yalnız o sahneyi, **Eksik sahneleri tamamla** bekleyenleri işler. Düz renk veya gradyan bir arka plan tek başına hata değildir.
- İki eksik sahne arasında **5 sn** beklenir. Yalnızca sağlayıcıdan **HTTP 429 veya 503** gelirse aynı çizim isteği sırasıyla **10, 20, 35 sn** sonra, en fazla üç kez tekrarlanır. Kalıcı 429’da kuyruk durur; kotan açılınca eksikten devam et. Bağlantı kopmasında ulaşmış olabilecek bir isteği otomatik göndermeyiz.
- **Durdur** sahneler arası beklemeyi, yeniden deneme sayacını, etkin sağlayıcı isteğini, Whisper’ı veya render’ı iptal eder ve alt süreç temizliğini bekler. Tamamlanmış sahne, WAV ve zamanlar korunur. İptal edilmiş bir hizalama tahmini başarıya çevrilmez. Durdurma daha önce işleme alınmış bir bulut isteğinin bedelini geri almaz.
- **Bu sahneyi yeniden üret** için örneğin “Tüneldeki öncü karıncayı büyüt” yaz. Aynı özne şablonu kullanılır. Yeni çizim doğrulanmazsa önceki çizim korunur. Başarıda storyboard yeniden onay ister. Hedef klip ve ona geçiş yapan önceki klip değişir; anlatım aynıysa ses, Whisper zamanları ve altyazı düzeltmeleri değişmez.
- 1.5 ve önceki projeler açılırken değiştirilmez. Kayıtlı JPEG ve katmanlı çizimler yeniden render’da sabit kadrajdadır; eski diyagramlar kendi yerel gösterimlerini korur. Eski MP4 dosyasını oynatmak onu yeniden kodlamaz. İstersen açıkça **Hareketli SVG’ye dönüştür**. Yeni sahne oluşturmak için Pollinations kullanılmaz.

## Yerel kayıt ve geliştirme

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
