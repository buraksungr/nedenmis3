# Sabit kameralı SVG sahnesi · 1.6.2

`board` / `ObjectPlanner` iki tür metin yanıtı kullanır. Önce onaylı senaryonun tamamı için `{subject, svg}`: SVG’deki `<defs><g id="subject-main">…</g></defs>` **tek** şablondur. Karıncada baş, göğüs, karın, altı bacak ve iki hareketli anten; balinada gövde, kuyruk ve yüzgeç istenir. Sonra her sahne için `{title, svg}`: aynı kanonik şablon bağlam olarak verilir. Sahne onu yeniden çizmez; bağımsız yerleştirilmiş `<use href="#subject-main">` örnekleriyle kullanır. Başlık çizime gömülmez. Metin modeli anlatıma özgü, doğal ve tamamlanmış 2–3 Türkçe sözcük üretir; sözcük sayısı, bilinen eksik bitişler ve tekrarlar denetlenir. Anlamı ve bilimsel doğruluğu storyboard onayında inceleyin.

## İstek ve devam kuralları · 1.6.1

- Şablon, sahne ve içerik onarımı isteklerinde çıkış bütçesi Gemini’de `maxOutputTokens: 8192`, OpenRouter’da `max_tokens: 8192` olur. İstem, **3500 karakterin altında** tam SVG, tam sayı koordinat, kısa geometri, yorumsuz XML ve kapalı son etiket ister. Bu bir model talimatıdır; kayıtlı büyük çizimleri kesmez veya eski dosyaların güvenlik sınırını değiştirmez.
- İlk eksik sahne hemen başlar. Bir sonrakinden önce önceki sonuç diske yazılır ve **Sonraki sahne için bekleniyor...** gösterilerek 5 saniye beklenir. Kaydedilmiş şablon ve hazır sahne atlanır; kuyruğun sonunda beklenmez.
- Alınmış HTTP 429/503 yanıtında aynı yetkili uç nokta ve gövdeyle sırasıyla 10/20/35 sn sonra yeniden denenir. Çizim başına toplam üç HTTP tekrarı vardır. Bunlar modelin JSON/XML veya `MAX_TOKENS` çıktısına yönelik en fazla iki **içerik onarımından** ayrıdır. Bağlantı kopması HTTP 503 değildir; otomatik olarak aynı POST’u yollamayız. Senaryo/TTS politikası ayrı kalır.
- Kalıcı kotada iş durur; bozuk çizim veya üç tekrardan sonra süren HTTP 503 sadece o sahneyi eksik bırakabilir. Neden sahne numarasıyla iş günlüğüne ve bekleyen sahnenin kartına yazılır. **Durdur** hem zamanlayıcıyı hem etkin isteği keser. Uygulamayı tekrar açıp **Eksik sahneleri tamamla** dediğinizde `project.json` ve imzalı SVG’ler okunur; tamamlanan sahneler yeniden istenmez.

## Çizim protokolü

Portre sahne `viewBox="0 0 1080 1920"` veya eşdeğer bir koordinat alanı kullanır. Sahne kökü ve dekor kare numarasından etkilenmez. Düz renk, gradyan ve statik şekil grupları serbesttir. İç içe görüntü koordinatları ve sabit yerleşim `transform`ları kamera hareketi değildir. Örnek: sahnede `<g transform="translate(160 820) scale(.8)"><use href="#subject-main" data-anim="move" data-dx="190" data-dy="45" data-delay=".2" data-duration="3.5"/></g>`.

| `data-anim` | Nesne pozu |
|---|---|
| `move` | Gecikmeden sonra yerel `dx`, `dy` kadar ilerler, sonunda durur. |
| `fall`, `rise` | Fazı kaydırılabilen sürekli iniş/çıkış; başlangıç ve bitişte parçacık solar. |
| `draw` | Görünür stroke’lu çizgiyi `pathLength=1`, dash ve `stroke-dashoffset` ile açar. |
| `pulse` | Yerel merkezde genişleyip sönümlenen halkalar. |
| `swing`, `wiggle` | Parçanın eklem noktasında, belirtilen açıyla periyodik dönüş. |
| `pop` | `spring()` ile gecikmeli, taşma ve yerleşme içeren giriş. |

Parametre öneki `data-`dır: `dx/dy` SVG birimi, `delay/duration` saniye, `phase` döngünün 0–1 aralığı, `angle` derece, `pivot-x/y` yerel merkezdir. Zaman kaynağı Remotion karesi/FPS’dir; SMIL, rastgele tohum, CSS animasyonu veya tarayıcı saati render’ı yönetmez. Önizleme aynı bileşene bir kare numarası verir. Çıkış geçişi yalnız opaklık kullanır. Plan en az beş ayrı hareketli nesne, birden fazla görünür özne örneği ve ilk karede başlayan bir döngü gerektirir; şablonun iç parçaları nesne sayısını şişirmez.

## Güven ve saklama

`layered-svg.ts` ve `motion-svg.ts` XML’i **reddetmek yerine temizleyerek** sınırlı, etkin olmayan bir geometri listesine ayrıştırır (96 KiB, sınırlı derinlik/düğüm, geçerli path komutları, sayısal parametreler). İzinli çizim etiketleri `svg`, `g`, `defs`, `symbol`, `use`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`, `linearGradient`, `radialGradient`, `stop`, `clipPath`, `mask`, `pattern`, `filter`, `feGaussianBlur`, `feDropShadow`, `feOffset`, `feBlend`, `feMerge`, `feMergeNode` ve (yalnız eski katmanlı illüstrasyonda) `text`tir. `use` yalnız sahnede ve **yalnız** sabit `#subject-main` hedefine izinlidir; şablonda `use` bulunamaz. Yerel `url(#id)` boya, filtre, maske ve kırpma başvuruları çözülür; tanımsız olanlar öğeden çıkarılır.

Zararsız veya desteklenmeyen etiketler (`title`, `desc`, `style`, `metadata`, `animate`, `animateTransform`, `animateMotion`, `set`, `a`, `tspan`, `text` ve sahne dışı bilinmeyen sarmalayıcılar), `class`, `style`, SMIL zaman öznitelikleri ve bilinmeyen dekor öznitelikleri **sahne reddedilmeden** çıkarılır. Yalnız etkin içerik güvenlik gerekçesiyle silinir: `script`, `iframe`, `foreignObject`, `image`, `object`, `embed`, `video/audio`, JS `on*` olayları ve dış `http(s)` bağlantıları. Yapısal XML hatası, geçersiz hareket değeri veya bozuk geometri kalırsa mesaj **sorunlu etiketi adlandırır** (`Desteklenmeyen SVG öğesi: <foo> (<g> içinde).`, `<circle> için geçersiz data-dx…`). Temizlik notu kökte `x-nedenmis-clean` olarak, yalnız etiket/öznitelik adlarıyla saklanır; ham yanıt, istem veya anahtar yazılmaz ve aynı dosya yeniden doğrulanınca bit-bit aynı kalır. React yalnız doğrulanmış öğeleri üretir; sahnenin ve şablonun kimlikleri, geçişte yan yana olduklarında da çakışmaz. Asıl şablon ile sahne dosyaları ayrı saklanır; render sırasında tek yerel SVG ağacında birleştirilir.

`project.json` içindeki `subjectRig` onaylı metni; sahne `choreography` referansı anlatımı, şablon özetini, başlığı ve SVG’yi bağlar. Başarısız veya durdurulmuş işler `motionWork` kuyruğunda kalır. Bir sahne başarılı olduğunda doğrulanmış dosya/metadata atomik yayımlanır. Fotoğraf servisi veya son çare yerel ikon şablonu yoktur. Eski dosyalar ve ölçülmüş sesler görsel revizyonda silinmez.
