# Gerçek prodüksiyon kabul kontrolü

Bu liste bir test sonucu değildir. Gerçek bir Windows 10/11 x64 bilgisayarda, kullanıcıya ait yapılandırılmış Gemini hesabıyla tamamlanır. Anahtar veya API yanıt gövdelerini rapora kopyalamayın.

1. Kurucudan yükleyin ve kısayoldan açın. Üç yerel servisi gerçek testten geçirin. Kesin hizalama kabulü için CPU Whisper ortamını ve çok dilli modeli doğrulayın (tahmini cümlelerle render için zorunlu değildir).
2. Anahtarı kaydedin, gizleme/gösterme kontrolünün yalnız yeni girişi gösterdiğini doğrulayın. Model listesini test edin. Model kimliklerini ve izin düzeylerini kaydedin. Ücretli kullanıma izin verilmediyse üretimin durduğunu doğrulayın.
3. Örnek projeyi **değil**, “Karıncalar kışın neden ortadan kaybolur?” konulu **yeni**, metinsiz bir proje açın. Gemini’nin yaklaşık 65–75 sözcüklük metnini okuyun. Bilimsel genellemeleri ve Türkçe doğallığı inceleyin. Bir paragraf düzenleyin, yeniden açıp kaydı doğrulayın.
4. Senaryo onayından önce storyboard veya medya isteği gönderilememeli. Onaydan sonra 5–7 sahnenin birleşik anlatımını metinle karşılaştırın. Betimleme, sabit kadraj, çevre ve ses tasarımını gözden geçirin. Bu noktaya kadar ücretli görsel/TTS isteği olmamalı.
5. Storyboard’u onaylayın. Aktif sahne, gerçek kare yüzdesi ve hataların göründüğünü doğrulayın. Bir sahneden sonra uygulamayı kapatıp açarak, hazır dosyaların korunmasını ve tekrarların ücretli çağrı yapmamasını kontrol edin.
6. Her WAV’ı dinleyin: erkek Türkçe ses, doğru telaffuz, tutarlı ses kimliği, değişmemiş anlatım. Transkripsiyonla onaylı metni karşılaştırın. JSON/SRT ve yakılmış altyazıları özellikle kelime başlangıçları ve sahne sınırlarında kontrol edin.
7. Son MP4’ü **uygulamadaki oynatıcıda** baştan sona izleyin. Karınca görünümü ve palet sürekliliği, geçiş dışında görüntünün tamamen sabit kalması, güvenli altyazı marjları, yumuşak geçişler ve anlatımı bastırmayan ambiyansı değerlendirin. 30 saniye bir hedef; anlatımı mekanik olarak hızlandırmayın.
8. FFprobe ile H.264, 1080 × 1920, 30 FPS, AAC, ses ve görüntü sürelerini doğrulayın. Bütün dosyayı decode edin. Gerçek sürenin kaynağı sahne WAV dosyaları olmalıdır.
9. “Altyazı boyutunu küçült” revizyonunu yapın. Değişmemiş görsel ve seslerin dosya adları değişmemeli. Müzik seviyesi değişiminde yalnız final miksajı yenilenmeli. Eski sürümü geri alıp izleyin.
10. MP4, SRT, JSON ve ZIP dışa aktarın. Anahtarı güncelleyip yeniden test edin, ardından silin. Kaydedilmiş medya oynatılabilir kalmalı; yeni bulut üretimi engellenmeli.

**Sabit kadraj ve geçişi ayrıca doğrulayın:** Daha önce kamera, maske veya kesme seçilmiş bir projeyi yeniden render edin. Yüklediğiniz fotoğraflar sahne boyunca aynı kadrajda, bulanıklık veya hareketli kaplama olmadan kalmalı. Geçişte yalnızca iki resmin opaklıkları karışmalı; siyah parlama veya kadraj sıçraması olmamalı.

**Senaryo 503 kontrolü:** Çevrimdışı testte senaryo isteğine art arda 503 yanıtları verilir. Aynı model ve metinle 1/2/4 saniyelik yeniden deneme ve azami dört HTTP isteği doğrulanmalı. Başarıda taslak kaydedilmeli; kalıcı hatada önceki senaryo ve onay değişmemeli. Geçersiz model/anahtar veya kota hatası başka modele geçiş ya da yeniden deneme tetiklememeli. Gerçek hesabın erişimi bu testle doğrulanmaz.

**Hizalama geri dönüşünü ayrıca doğrulayın:** Onaylı, sesli ve görseli yüklenmiş bir sahnede Whisper kullanılamıyorsa veya geçersiz zaman dönerse MP4 tamamlanmalı. “Tahmini altyazı” etiketi ile sahne araçlarındaki gerekçeyi kontrol edin. SRT’de ve videoda aynı cümleler, JSON’da `estimated: true` görülmeli. Bu sonuç kesin akustik hizalama başarısı olarak kaydedilmemelidir.

Kabul kaydına model kimlikleri, işlem tarihi, sahne sayısı, gerçek süre, çıktı SHA-256, FFprobe özeti, insan tarafından görsel/ses/altyazı değerlendirmesi ve başarısız kontrolleri ekleyin. Yalnızca tüm gerekli adımlar gerçekten yürütüldüğünde tamamlandı olarak işaretleyin.
