# Doğrulama kaydı

## 1.0.7 — Pollinations storyboard görselleri

[Windows x64 kurucusu](https://github.com/buraksungr/nedenmis3/actions/runs/44450544608/artifacts/14495592855) · [Başarılı CI](https://github.com/buraksungr/nedenmis3/actions/runs/44450544608) · `2c5d7dd31f46e2fb76e0e876fae8856791ca7176`. Yerel iki adresli sözleşme testi, manuel yükleme, fotoğraf geçişleri ve kurulu uygulamada ayrı şifreli anahtar depoları denetlendi. Bu sürümde SVG şablonları yoktur.

## 1.0.6 — sabit görseller, opaklık geçişi ve senaryoda HTTP 503

**[Windows x64 kurucusu (ZIP)](https://github.com/buraksungr/nedenmis3/actions/runs/44278142035/artifacts/14416007302)** · [Başarılı Windows CI](https://github.com/buraksungr/nedenmis3/actions/runs/44278142035) · Derleme: `ceb487e718244de1656e78718305db4363c044a7`.

- Windows’ta **31 test**, derleme ve arayüz kontrolü geçti. İmzasız `Nedenmis-Studio-1.0.6-Setup.exe` temiz ortama kuruldu ve kurulu uygulama sistem Edge’iyle kompozisyonu açtı. **ZIP paketinin** SHA-256 değeri: `6c698650dbe0e79218bbc35177341834e9ab17e404cc9cf3a3f837eb72e53792`.
- [MP4, sabit kadraj/geçiş, altyazı ve kurulum raporları](https://github.com/buraksungr/nedenmis3/actions/runs/44278142035/artifacts/14416101968): render öncesi kaynak fotoğraflarla render edilen sabit kareler piksel düzeyinde karşılaştırıldı. Geçişin ortasında iki resmin karışımı, sonunda ise sonraki resmin ilk karesi doğrulandı. Eski kesme ayarı taşıyan iki sahneli prodüksiyon MP4’ünde de aynı geçiş sınandı. Yerel kontrol: 1080 × 1920, 30 FPS, 109 kare; H.264 3,633333 sn / AAC 3,633 sn. [Ayrı gerçek Türkçe CPU hizalama testi](https://github.com/buraksungr/nedenmis3/actions/runs/44278142035/artifacts/14416630195) de geçti.
- Çevrimdışı senaryo testlerinde **gerçek SDK’nın** oluşturduğu HTTP isteği yakalandı: seçili model, `v1` yolu, anahtar başlığı ve gövde doğrulandı. Üç 503’ten sonra başarıda gecikmeler 1/2/4 sn; dört 503’te taslak ve onay korundu. Kalıcı hatada deneme sayısı, hizmet durumu ve anahtarsız iş günlüğü kontrol edildi. Derlenmiş arayüzde geçici 503 sonrası metin editöre ulaştı. Kota/404/ağ hatasında veya görsel/TTS/JSON storyboard çağrılarında otomatik tekrar yapılmadı. Bu sonuçlar canlı bir Google hesabının erişimini, kotasını veya o andaki hizmet durumunu göstermez.

## 1.0.5 — sahne hareketleri ve görüntü geçişleri

**[Windows x64 kurucusu (ZIP)](https://github.com/buraksungr/nedenmis3/actions/runs/44223452275/artifacts/14391199938)** · [Başarılı Windows CI](https://github.com/buraksungr/nedenmis3/actions/runs/44223452275) · Derleme: `2f8b9091e54a10406f497bbf1d4fdc9dc1230bfb`.

- Windows’ta 29 test, yerel MP4 üretimi ve derlenmiş arayüz kontrolleri geçti. [Render ve kurulum çıktıları](https://github.com/buraksungr/nedenmis3/actions/runs/44223452275/artifacts/14392725368) içinde iki sahneli MP4, `motion-report.json`, altyazı geri dönüş örneği ve `install-report.json` bulunur. Kurulan `Nedenmis-Studio-1.0.5-Setup.exe` içindeki kompozisyon sistem Edge’iyle açıldı. İmzasız kurucuyu içeren **ZIP paketinin** SHA-256 değeri: `117ac649e1aff28e5629bb52ba05a9a226d4fbd13d47158eb9d693ac1578c17f`.
- Kare testi gerçek `DocumentaryScene` çıktısında ön/arka PNG işaretlerinin farklı hızlarını, tek görselde büyüyüp tekrar küçülmeyi ve dikey süzülmeyi ölçer. Geçiş ortasında iki renk eşit katkı yapmalı; son kare komşu sahnenin bağımsız işlenen açılış karesiyle (kamera ve nesne dahil, altyazı hariç) aynı olmalı. Kesme kontrolünde son kare önceki sahnede kalır.
- Aynı kaynakla yerel ölçüm: 270 × 480 kontrol karelerinde arka plan 5 px, ön plan 13 px kaydı; nefes hareketinde renk işaretinin alanı 1824 → 2050 → 1824 piksel oldu. Asıl iki sahneli MP4 **1080 × 1920, 30 FPS, 109 kare**; H.264 3,633333 sn, AAC 3,633 sn. Kısa kontrol, canlı Gemini üretimi değildir. [Ayrı Türkçe CPU hizalama testi](https://github.com/buraksungr/nedenmis3/actions/runs/44223452275/artifacts/14391821661) de tahmini zaman kullanmadan geçti.

## 1.0.4 — kesin hizalama başarısızken render

**[Windows x64 kurucusu (ZIP)](https://github.com/buraksungr/nedenmis3/actions/runs/44217017902/artifacts/14389451254)** · [Başarılı Windows CI](https://github.com/buraksungr/nedenmis3/actions/runs/44217017902) · Derleme: `d3becfda4e104b9ea946d8019200aeaeccc1b929`.

- Windows’ta **25 test** geçti. İki sahneli geri dönüş kontrolünde ilk sözcük için bilerek `başlangıç=bitiş=0.32` verildi, ikinci sahnede Whisper ön kontrolü bulunamayan çalıştırılabilir dosyayla (`ENOENT`) başarısız oldu. İçe aktarılmış görseller ve ölçülen ses süreleriyle gerçek 1080 × 1920 H.264/AAC MP4 tamamlandı ve tamamı decode edildi. [Geri dönüş MP4, SRT, JSON ve sahne günlükleri](https://github.com/buraksungr/nedenmis3/actions/runs/44217017902/artifacts/14388619469) (`fallback-control.*`, `fallback-diagnostics.ndjson`). Bu iki hata kontrollü test koşullarıdır, kullanıcının bilgisayarındaki hatanın teşhisi değildir.
- Derlenmiş arayüzde tahmini altyazı etiketi, **Hizalama günlüğü** ve cümle düzenleyicisinde kaydetme sınandı. Önbellek ve yeniden deneme testleri eski geçerli hizalamaların/düzenlemelerin başarısız denemelerde korunmasını, kesin sonuç geldiğinde tahminin değişmesini ve bozuk sesin gerçek hata sayılmasını denetler.
- Ayrı [Türkçe CPU hizalama kontrolü](https://github.com/buraksungr/nedenmis3/actions/runs/44217017902/artifacts/14389051711) hem orijinal hem 800 ms geciktirilmiş ses için gerçek Whisper sözcük zamanlarıyla geçti; bu test tahmini hizalamayı kabul etmez.
- Önceki iki sessiz kurulum denemesi NSIS `0xC0000005` ile durdu. Paketleyici [üst projenin ilk kurulum düzeltmesini](https://github.com/electron-userland/electron-builder/pull/9769) içeren 26.18.0’a güncellendi. Yukarıdaki nihai çalıştırmada `Nedenmis-Studio-1.0.4-Setup.exe` kuruldu, kurulu uygulama Edge ile kompozisyonu açtı. İmzasız kurucuyu içeren **ZIP paketinin** SHA-256 değeri: `a0af7c3253b8f6cfe2780e472ec2a7012438af74113abeffb27f20a54e6176d7`.

## 1.0.3 — senaryo üretiminde HTTP 404

**[Windows x64 kurucusu (ZIP)](https://github.com/buraksungr/nedenmis3/actions/runs/44210425542/artifacts/14385877184)** · [Başarılı Windows CI](https://github.com/buraksungr/nedenmis3/actions/runs/44210425542) · Derleme: `1fadcf634a2844d7de67f80b75a52404768e3fdf`.

- Önceki kod, yalnızca listelenmiş metin modelinin `generateContent` yolunu kabul eden çevrimdışı testte kullanıcının bildirdiği 404’ü verdi. Düzeltme sonrası aynı proje oluşturma rotasında `gemini-2.5-flash` ile senaryo ve yapılandırılmış storyboard kaydedildi. Test istek yöntemini, tam URL’yi, anahtarın yalnız başlıkta olmasını ve JSON gövdesini denetler. Eksik metin ve kota durumları başarı sayılmaz; sağlayıcı hâlâ 404 dönerse taslak korunur, başka model denenmez.
- Windows’ta TypeScript denetimi ve **21 test** geçti. Derlenmiş arayüzde ücretsiz metin izni seçildi ve yalnızca konu girilerek oluşturulan projenin metni senaryo düzenleyicisinde görüldü. Gemini yanıtları bu testte yerel test verisidir; **canlı hesaptaki model erişimi veya kota doğrulaması değildir**.
- `Nedenmis-Studio-1.0.3-Setup.exe` kuruldu, kurulu uygulama sistem Edge’i ile kompozisyonu açtı. [Render ve kurulum raporları](https://github.com/buraksungr/nedenmis3/actions/runs/44210425542/artifacts/14385807233) ve [gerçek Türkçe CPU hizalama çıktıları](https://github.com/buraksungr/nedenmis3/actions/runs/44210425542/artifacts/14386485567) ayrı paketlerdedir. İmzasız kurucuyu içeren **ZIP paketinin** SHA-256 değeri: `cd7740e584b31a83c23860239ae1c22f84ea4b0ece172420edf1e54b9431a692`.

## 1.0.2 — manuel storyboard görselleri ve TTS konuşmacısı

**[Windows x64 kurucusu (ZIP)](https://github.com/buraksungr/nedenmis3/actions/runs/44205732925/artifacts/14384570141)** · [Başarılı Windows CI](https://github.com/buraksungr/nedenmis3/actions/runs/44205732925) · Derleme: `5e5305929da17c8a33fdb4441e3be294bb856450`.

- 19 test geçti. Çevrimdışı Gemini sözleşme testinde katalogda görsel modeli yokken senaryo, storyboard ve beş TTS isteği tamamlandı. Görsel servisi için izin doğrulaması veya üretim çağrısı yapılmadı. Eksik görseller bekleme durumuna geçti; kısmi yüklemeden sonra hazır anlatımlar tekrar istenmedi. İstekteki konuşmacı ve onaylı metin denetlendi; bu, canlı Google hesabı veya ücretsiz kota testi değildir.
- Derlenmiş arayüzde konuşmacı ayarının yeniden açılışta korunması, proje için değiştirilmesi, boş sahne alanı ve onaylı storyboard’dan görsel yükleme sınandı. [Windows render/kurulum raporları](https://github.com/buraksungr/nedenmis3/actions/runs/44205732925/artifacts/14382819085).
- [Gerçek CPU hizalama testi](https://github.com/buraksungr/nedenmis3/actions/runs/44205732925/artifacts/14383194502) görsel olmadan bekledi; manuel yüklemeden sonra aynı anlatımla Whisper, hizalama ve MP4 render’ı tamamlandı. Bu ses, atıflı Türkçe QA örneğidir, Gemini üretimi değildir.
- `Nedenmis-Studio-1.0.2-Setup.exe` sessizce kuruldu ve kurulu uygulama Edge ile kompozisyonu açtı. Kurucu imzasızdır. GitHub **ZIP paketinin** SHA-256 değeri: `125c4407bc6dd4c77b3b0347ed3ce7a1381e3e2ac3b012d6aa5fd5762c9ba618`.

## 1.0.1 — kurulu Windows uygulamasında Remotion

**[Windows x64 kurucusu (ZIP)](https://github.com/buraksungr/nedenmis3/actions/runs/44198400356/artifacts/14379119762)** · [Windows CI](https://github.com/buraksungr/nedenmis3/actions/runs/44198400356) · Derleme: `c62af308a4a6967b34b91dabe5f9aa2567f27656`.

- `Nedenmis-Studio-1.0.1-Setup.exe` sessizce kuruldu. Kurulu uygulama, kaynak veya tarayıcı önbelleği olmayan ayrı bir çalışma dizininden açıldı. Testin ilk `.exe` adayı bir DevTools bağlantısı kuramadan çıktı. **Yerel servisler** kontrolü sıradaki çalışan sistem tarayıcısıyla paketlenmiş `DocumentaryScene` kompozisyonunu açtı. [Kurulu uygulamanın bildirdiği yol](https://github.com/buraksungr/nedenmis3/actions/runs/44198400356/job/134445822123): `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
- 17 test, Windows üretim render’ı, arayüz/oynatıcı testi ve gerçek Türkçe CPU hizalama işi geçti. [Render ve kurulum raporu](https://github.com/buraksungr/nedenmis3/actions/runs/44198400356/artifacts/14379623758) · [Akustik test çıktıları](https://github.com/buraksungr/nedenmis3/actions/runs/44198400356/artifacts/14378944985).
- Kurucu imzasızdır. GitHub’ın bildirdiği **kurucu ZIP paketinin** SHA-256 değeri: `5bfa345ca4d1103850f241f20ec07acbef422467d1ede1f14e394eda6d1e64d2`. Bu, içteki EXE’nin özeti değildir.

## 1.0.0 — önceki doğrulama kaydı

**Test edilen uygulama:** `4eb41653d080f8c45b0deed910135e397412d3ca`. [Windows iş akışı ve iki başarılı iş](https://github.com/buraksungr/nedenmis3/actions/runs/44185904314).

### Teslim dosyaları

| GitHub Actions paketi | İçerik |
|---|---|
| [Windows x64 kurucu](https://github.com/buraksungr/nedenmis3/actions/runs/44185904314/artifacts/14375860143) | ZIP içindeki `Nedenmis-Studio-1.0.0-Setup.exe`. Sertifikayla imzalanmamıştır. |
| [Yerel render kontrolü](https://github.com/buraksungr/nedenmis3/actions/runs/44185904314/artifacts/14375381216) | İki sahneli MP4, FFprobe ve kurulu uygulama denetim raporları. |
| [Türkçe akustik kontrol](https://github.com/buraksungr/nedenmis3/actions/runs/44185904314/artifacts/14374596980) | İçe aktarılmış Türkçe sesle gerçek Whisper/stable-ts çıktısı, zaman kayması deneyi, MP4 ve medya raporu. İçerik atfı `alignment-report.json` içindedir. |

Kurucu **ZIP paketinin** SHA-256 değeri: `8d9dc1d0c84aae206c1a886a9e30d0b4a163ef48df5a70d1d2e567e5df27e645`. Bu değer içteki EXE’nin değil, Actions paketinin özetidir. GitHub’ın bildirdiği saklama sonu 15 Şubat 2027’dir. Sonrasında Windows üzerinde `npm ci` ve `npm run dist:win` ile yeniden üretilebilir.

### Gerçekten yürütülen kontroller

- Windows x64 CI: bağımlılık kurulumu, TypeScript denetimi ve **14 test** geçti. İki onay, değişen içerik, reddedilen eski yazma, sürüm geri alma, kesilen işin kurtarılması, anahtar silme/yenileme, kota reddi ve bozuk dosya denendi. Sağlayıcı sözleşme testleri canlı Google erişimi değildir.
- **Asıl NSIS kurucusu çalıştırıldı; kurulmuş EXE açıldı.** İzole test profiliyle gerçek Electron renderer → yerel API → SQLite yolu doğrulandı. Windows güvenli saklama ile rastgele bir değer şifrelendi, disk içeriğinde açık metin bulunmadığı kontrol edildi, geri çözüldü ve silindi. FFmpeg/FFprobe çalıştırıldı, Remotion tarayıcısı açılıp kapatıldı.
- Derlenmiş arayüzde Chromium/Edge ile proje oluşturma, senaryo otomatik kaydı/yeniden açma, storyboard düzenleme, iki onay, eksik yapılandırmada durma, görsel yükleme, anahtar giriş/güncelleme/silme kontrolleri ve dar ekran gezinmesi denendi. **Oynatıcı** doğrulanmış MP4’ü yükledi; çözünürlük 1080 × 1920 ve oynatım saatinin ilerlediği doğrulandı.
- Yerel iki sahneli kontrol: Remotion gerçek kareleri işledi, FFmpeg MP4’ü birleştirip miksledi ve **bütün dosyayı decode etti**. Değişmemiş bir klibin ikinci istekte yeniden render edilmediği test edildi. Linux çalıştırmasında 109 kare, 30 FPS; H.264 süresi 3,633333 sn, AAC süresi 3,633000 sn; ölçülen ses −16,01 LUFS ve −1,51 dBTP. İki sahne ve geçişten çıkarılan karelerde kadraj ve yakılmış altyazılar incelendi. Bu kısa kontrolün süreleri 30 saniyelik gerçek proje sonucu değildir.
- Ayrı Windows işinde Python ortamı ve CPU ağırlıkları gerçekten kuruldu. Onaylı metin ile **yaklaşık 12 sn’lik Türkçe konuşma** bağımsız olarak transkribe edildi ve zorla hizalandı. Zamanlar girdiye verilmeden normal üretim yolundan MP4 çıktı. Aynı sesin başına 800 ms sessizlik eklendiğinde ölçülen sözcük başlangıçlarının kaymayı izlemesi denetlendi (medyan mutlak kayma hatası eşiği 200 ms). Bu bir senkron regresyon testidir; bağımsız insan anotasyonuna göre mutlak doğruluk iddiası değildir.

## Henüz doğrulanmayan kabul

Gerçek Gemini anahtarı veya ücretli istek izni sağlanmadı. **Gemini’nin ürettiği “Karıncalar kışın neden ortadan kaybolur?” belgeseli oluşturulmadı; nihai kabul tamamlanmadı.** Canlı model/kota erişimi, onaylı anlatımın ses kalitesi, sahneler arası görsel tutarlılık ve bitmiş ant belgeselinin izlenerek değerlendirilmesi kullanıcı hesabıyla yapılmalıdır. Başlangıç kapakları, referans konuşmalar ve yukarıdaki QA videoları bu teslimin yerine geçmez. [Gerçek kabul adımları](ACCEPTANCE.md).
