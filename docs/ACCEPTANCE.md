# Windows kabul kontrolü

Bu bir elle kontrol listesidir, test sonucu değil. Çalıştırma kimlikleri ve ölçümler için [VALIDATION](VALIDATION.md).

1. Yeni CI kurucusunu Windows x64’e kurup kısayoldan açın. FFmpeg, Remotion tarayıcısı ve gerçek zaman kabulü için CPU Whisper ortamını doğrulayın. Metin ve ses modellerini yetkili hesabınızla seçin; anahtarı rapora yazmayın.
2. **Karıncalar kışın nereye gider?** projesinde senaryoyu onaylayın. İlk iş, başı/göğsü/karnı bağlı, altı bacaklı ve salınan iki antenli tek karınca şablonu olmalı. Her sahnede özneyi tanıyabiliyor musunuz? Aynı öznenin birkaç örneği farklı başlangıç noktalarından ayrı hareket etmeli.
3. Sahnenin başını, ortasını ve sonunu izleyin. Üst başlık bir satır ve doğal 2–3 sözcük olmalı. “Donan Toprakta Kimler” ve “Karıncalar Kışın Uykusuna” onaylanmamalı. Arka plan karmaşıklığı şart değildir. Taş, dal veya tünel ağzı aynı pikselde kalmalı; karınca yürümeli, kar düşmeli, tünel çizilmeli, ısı halkası genişleyip sönmeli. Yalnız kamera veya topluca kayan katmanlar kabul değildir.
4. İkinci sahnede **Durdur**. İlk sahneyi yeniden açın, **Bu sahneyi tamamla** ile yalnız eksikten devam edin. Tek bozuk çizim ilk yanıt + en fazla iki onarımdan sonra eksik işaretlenmeli; bağımsız sağlam sahneler korunmalı.
5. **Onayla ve üret** ile Türkçe ses → Whisper → 1080×1920 H.264/AAC MP4. Son videoyu gerçekten oynatın. Ses süresi, tam sözcük sırası, tek altyazı ve söylenen sözcükte `#FACC15` vurgusu kontrol edilmeli. Tahmini cümleler akustik kabul sayılmaz.
6. Yalnız bir sahneyi yeni yönle çizin. Yanlış yanıt mevcut çizim/MP4’ün yerine geçmemeli; başarılı değişiklikte komşu geçiş dışında diğer klipler, WAV ve sözcük zamanları korunmalı. Geri al, durdurulmuş render’dan devam, oynatma ve ZIP yedeğini sınayın.

`test:ant` yayımlanan MP4’ün çözümlenmiş kareleri üzerinde, her sahnede iki uzak dekor ayrıntısının kontrast kenarlarını geçiş dışında **her karede** izler. Ayrı deneyde altı nesneyi birer birer ilk pozuna döndürür ve yalnız değişen pikselleri doğru Remotion karesiyle karşılaştırır. Bu test kayıtlı çizim yanıtları ve atıflı QA sesini kullanır; canlı sağlayıcı kalitesi/ücretlendirmesi için 1–6’yı ayrıca çalıştırın. İsteğe bağlı `require_live` ek işi gerçek metin servisiyle yeni SVG planını sınar ve eksik yetkide hata verir.
