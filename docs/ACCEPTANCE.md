# Gerçek prodüksiyon kabul kontrolü

Bu liste bir test sonucu değildir. Gerçek bir Windows 10/11 x64 bilgisayarda, kullanıcıya ait yapılandırılmış Gemini hesabıyla tamamlanır. Anahtar veya API yanıt gövdelerini rapora kopyalamayın.

1. Kurucudan yükleyin ve kısayoldan açın. Üç yerel servisi gerçek testten geçirin. CPU Whisper ortamını ve çok dilli modeli doğrulayın.
2. Anahtarı kaydedin, gizleme/gösterme kontrolünün yalnız yeni girişi gösterdiğini doğrulayın. Model listesini test edin. Model kimliklerini ve izin düzeylerini kaydedin. Ücretli kullanıma izin verilmediyse üretimin durduğunu doğrulayın.
3. Örnek projeyi **değil**, “Karıncalar kışın neden ortadan kaybolur?” konulu **yeni**, metinsiz bir proje açın. Gemini’nin yaklaşık 65–75 sözcüklük metnini okuyun. Bilimsel genellemeleri ve Türkçe doğallığı inceleyin. Bir paragraf düzenleyin, yeniden açıp kaydı doğrulayın.
4. Senaryo onayından önce storyboard veya medya isteği gönderilememeli. Onaydan sonra 5–7 sahnenin birleşik anlatımını metinle karşılaştırın. Betimleme, çevre, hareket, ses ve geçişleri gözden geçirin. Bu noktaya kadar ücretli görsel/TTS isteği olmamalı.
5. Storyboard’u onaylayın. Aktif sahne, gerçek kare yüzdesi ve hataların göründüğünü doğrulayın. Bir sahneden sonra uygulamayı kapatıp açarak, hazır dosyaların korunmasını ve tekrarların ücretli çağrı yapmamasını kontrol edin.
6. Her WAV’ı dinleyin: erkek Türkçe ses, doğru telaffuz, tutarlı ses kimliği, değişmemiş anlatım. Transkripsiyonla onaylı metni karşılaştırın. JSON/SRT ve yakılmış altyazıları özellikle kelime başlangıçları ve sahne sınırlarında kontrol edin.
7. Son MP4’ü **uygulamadaki oynatıcıda** baştan sona izleyin. Karınca görünümü ve palet sürekliliği, anlamlı kamera/nesne hareketi, güvenli altyazı marjları, yumuşak geçişler ve anlatımı bastırmayan ambiyansı değerlendirin. 30 saniye bir hedef; anlatımı mekanik olarak hızlandırmayın.
8. FFprobe ile H.264, 1080 × 1920, 30 FPS, AAC, ses ve görüntü sürelerini doğrulayın. Bütün dosyayı decode edin. Gerçek sürenin kaynağı sahne WAV dosyaları olmalıdır.
9. “İkinci sahnedeki kamerayı yavaşlat” revizyonunu yapın, yeniden onaylayın. Değişmemiş görsel ve seslerin dosya adları değişmemeli. Müzik seviyesi değişiminde yalnız final miksajı yenilenmeli. Eski sürümü geri alıp izleyin.
10. MP4, SRT, JSON ve ZIP dışa aktarın. Anahtarı güncelleyip yeniden test edin, ardından silin. Kaydedilmiş medya oynatılabilir kalmalı; yeni bulut üretimi engellenmeli.

Kabul kaydına model kimlikleri, işlem tarihi, sahne sayısı, gerçek süre, çıktı SHA-256, FFprobe özeti, insan tarafından görsel/ses/altyazı değerlendirmesi ve başarısız kontrolleri ekleyin. Yalnızca tüm gerekli adımlar gerçekten yürütüldüğünde tamamlandı olarak işaretleyin.
