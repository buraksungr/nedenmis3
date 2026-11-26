# Sabit kameralı bilimsel SVG sahnesi · 1.7.4

`board` / `ObjectPlanner`, onaylı senaryoyu sahnelere ayırır. Modelden her sahne için yalnız **şablon kimliği ve sınırlandırılmış parametreler** içeren JSON ister; SVG, XML, koordinat, serbest çizim veya kod istemez ve bunları yanıt şemasında kabul etmez. Çizim ve hareket geometrileri uygulamanın yerel kodundadır. Başlık doğal, tamamlanmış 2–4 sözcüklük Türkçe proje bilgisidir; videoya çizilmez.

## Yerel şablonlar ve seçim

33 farklı katmanlı görünüm vardır: gözün önden görünümü ve kesiti, beyin, nöron, kalp, dolaşım, hücre, DNA, akciğer, kas/eklem; yeraltı kolonisi, karınca tüneli ve odacığı, atmosfer, okyanus derinliği, su döngüsü, bitki ve fotosentez; kırılma, manyetizma, elektrik, yörünge, yerçekimi, ses ve ısı; genel bakış, odak, ayrıntı, karşılaştırma, neden/etki, zaman çizgisi, mikroskop ve denge. Somut görünümler ayrıca konuya özgü küçük ayrıntı panelleri içerir.

Model `template` ve `title` verir; isteğe bağlı `palette` (`night`, `ocean`, `forest`, `ember`), `accent` (`cyan`, `gold`, `coral`, `lime`), `speed` (`slow`, `normal`, `fast`), `direction` (`forward`, `reverse`), 0–100 tam sayılı `level`, `label1`, `label2` ve kısa sayısal `value` seçebilir. Bunlar yalnız önceden tanımlanmış renkleri, hareketleri ve bazı şablonların durumunu değiştirir. Bilinmeyen veya fazladan alan reddedilir; model çizim yolunu, konumu veya hareket sınırını belirlemez. Etiket/değerler yalnız onaylı anlatım veya konuda aynen bulunursa kullanılır; aksi halde düşürülür.

Konu ve sahne metniyle eşleştirilen somut seçenekler sunulur; hiçbiri uygun değilse başka bir bilimsel özne uydurmak yerine nötr genel görünümler kullanılır. Eşleme anahtar sözcüklere dayalıdır; konuya uyum ve bilimsel doğruluk garanti değildir, storyboard’da gözle kontrol edilmelidir. Planlayıcı mümkünse kullanılmamış görünümü seçer ve hedefin **iki yanındaki** imzalı şablonları dışlar. Kısmi projede eksikler atlanınca komşu olacak en yakın hazır sahneler dikkate alınır: doğrulanmış eski çizim veya hazır fotoğraf aradaki iki şablonu gerçekten ayırır, eksik dosya ayırmaz. Sıralama veya eksik dosyalar yine de çıktıdaki iki hazır sahneyi aynı şablona getirirse storyboard onayı ya da kısmi taslak açıklayıcı hata verir; bir sahneyi yeniden üretin. Kimlik imzalı SVG içindedir; eski işaretsiz çizimler değiştirilmez.

## Üretim, sağlayıcı ve devam

- Seçilen Gemini, OpenRouter veya doğrudan Anthropic hem senaryo hem şablon seçimi için kullanılır. OpenRouter model kimliği seçilebilir; varsayılan `openrouter/free`dir. `:free` veya ücretli modellerin erişimini ve fiyatını sağlayıcıda doğrulayın. Anthropic ayrı anahtar/model ister. Otomatik seçim kayıtlı OpenRouter anahtarına, yoksa Gemini’ye öncelik verir; hata halinde başka sağlayıcıya geçmez. Gemini TTS ayrıca yapılandırılır.
- İlk eksik sahne hemen başlar; sonraki eksik sahneden önce tamamlanan dosya kaydedilir ve 5 saniye beklenir. OpenRouter veya Anthropic HTTP 429 yanıtında aynı istek 10/20/35 saniye aralıklarıyla en fazla üç kez tekrarlanır; 503 doğrudan bildirilir. Geçersiz JSON/parametre için en fazla iki ayrı içerik onarımı yapılır. Gemini 429/503 için sabit yedek model kimliklerini beklemeden dener; zincirin son yanıtı 429 ise aynı beklemelerle yeniden denenebilir. Bu beklemeler senaryo isteğine uygulanmaz. Belirsiz bağlantı hatasında ulaşmış olabilecek POST otomatik tekrarlanmaz.
- **Durdur** zamanlayıcıyı, isteği veya render’ı iptal eder ve temizliği bekler. Hazır sahneler saklanır; **Eksik sahneleri tamamla** yalnız gerekli sahneleri işler. Yönlendirmeli yeniden üretim hazır seçeneklerle sınırlıdır; başarısız olursa önceki çizim, ses ve zamanlar korunur.

## Çerçeve, metin ve hareket

Yerel sahnelerin `viewBox` değeri `0 0 1080 1920`dir. Arka plan tüm 9:16 kareyi doldurur; üstte başlık bandı yoktur. Özne ve hareketli katmanlar çıkışta y=0–1460 bölgesine, küçük etiketler y=0–1220 bölgesine kırpılır. En fazla iki 1–2 sözcüklük, 28 karakterlik etiket kullanılır; sayısal etiket kısa bir ölçü/birim içerebilir. Yerel şablondaki etiketlere okunabilirlik için kontur eklenir. Filmde altyazı aşağıda kendi bölgesindedir. Geçişte giden ve gelen anahtar sözcükler gizlenir; gelen etiket kendi sahnesinde görünür. Uzun altyazılar görüntüde küçük sayfalara bölünür; kayıtlı hizalama ve SRT değiştirilmez.

`move` kısa ve sınırlı yer değiştirme, `flow` çizilen yol üzerinde akan tire, `pulse` ve `dilate` şeklin gerçek dolgu kutusu merkezinde ölçeklenme sağlar. Göz bebeği veya organ ana şekilleri birbirinden bağımsız biçimde yer değiştirmez; dolaşım, solunum ve ışık gibi yönü önemli akışlar sabittir. Yalnız açıkça ters çevrilebilir akışlar modelin `direction` seçimini kullanır. Her poz Remotion karesi ve FPS’ye bağlıdır; kamera hareketi yoktur. Karınca şablonlarında hareketin iki ucundaki bacak/zemin ilişkisi tarayıcıda gerçek SVG geometrisine göre sınanır. Sınırlandırma her konu için tıbbi/fiziksel doğruluk garantisi değildir.

Motorun diğer desteklediği `fall`, `rise`, `draw`, `swing`, `wiggle` ve `pop` hareketleri eski sahnelerin oynatımı için korunur. Yeni `objects-v2` çizimlerinde `move` mesafesi dönüşümler ve iç içe hareketler dahil en fazla 240 çıkış pikselidir. `objects-v1` arşivleri önceki sınırsız `move` ve eski büyüyen/solan `pulse` davranışını korur. Eski imzalı `objects-v1` ve `objects-v2` çizimleri yeni şablona otomatik çevrilmez, yeni kalite kurallarıyla yeniden reddedilmez ve mevcut MP4 dosyaları kendiliğinden değiştirilmez.

## Sessiz taslak ve normal üretim

**Sessiz taslağı oluştur**, onaylı senaryodan en az bir doğrulanmış çizim varsa hazır sahneleri sırayla işler; eksik veya doğrulanamayan çizimler atlanır. Süre sahne ayarından tahmin edilir, altyazı tahminidir. TTS, Whisper, kayıtlı ses, müzik ve efekt kullanılmadan ses kanalı içermeyen H.264 MP4 doğrulanır. Taslak ve geçici klipler normal `final`, ses ve altyazı önbelleklerinden ayrıdır; görsel veya süre değişince taslak bağlantısı geçersizleşir. Yalnız eski v1 sahneler içeren mevcut taslak önbelleği korunur.

Normal üretim storyboard onayı ister. Tüm sahneler açıkça anlatımsızsa ve kullanıcı sesi, müzik veya efekt eklememişse normal MP4 de sessizdir. Sesli projelerin TTS, hizalama, altyazı ve miksaj akışı korunur.

## Güvenlik ve saklama

`layered-svg.ts` / `motion-svg.ts` hem yerel şablonları hem kayıtlı çizimleri sınırlı geometri listesine ayrıştırır (96 KiB, sınırlı düğüm ve derinlik, sonlu sayılar). `script`, `iframe`, `foreignObject`, `image`, JS olay öznitelikleri ve dış bağlantılar çıkarılır; CSS, SMIL ve desteklenmeyen dekor temizlenir. Tanımsız yerel başvurular kaldırılır. React ham XML veya `innerHTML` yerine doğrulanmış öğeleri üretir.

Sahne `choreography` referansı anlatımı, başlığı, kaynak sağlayıcı/modeli ve kanonik SVG’yi içerik özetiyle bağlar. Başarısız işler `motionWork` kuyruğunda kalır. Kayıtlı eski çizimler ve ölçülmüş sesler görsel revizyonda silinmez.
