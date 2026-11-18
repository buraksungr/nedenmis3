# Doğrulama kaydı

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
