# Sabit kameralı SVG sahnesi · 1.7.2

`board` / `ObjectPlanner`, onaylı senaryoyu sahnelere ayırır ve her sahne için bağımsız `{title, svg}` ister; yeni üretimde ortak özne şablonu isteği yoktur. Başlık tamamlanmış, doğal 2–4 sözcüklük Türkçe proje bilgisidir; videoya çizilmez. Anlam ve bilimsel doğruluk storyboard’da gözden geçirilmelidir.

## Üretim ve devam

- İstem 3500 karakterin altında, tam sayı koordinatlı ve XML yorumsuz SVG ister. Yeni çizim `layer-bg`, `layer-main` ve `layer-fx` gruplarını ve ana katmanda en az üç görünür `<path>` içermelidir. İstem karanlık zeminde açık/orta tonlar, belirgin konturlar, ışık ve konuya uygun somut anatomi ister; göz sahneleri için sklera, iris lifleri, kornea/mercek, retina ve ışınlar örneklenir.
- Arka planın tam çerçeveli rengi hesaplanabiliyorsa yeni çizimde en az iki kalıcı ve görünür ana yol için 3:1 kontrast aranır; küçük parlak ayrıntıların çok büyük koyu özneyi gizleyememesi için yaklaşık alan kontrolü de uygulanır. Açıkça kutu veya boş eşmerkezli halkalardan ibaret göz sahnesi onarıma gönderilir. Yerel gradyan, saydamlık ve dönüşümler hesaba katılır. Desenler, karmaşık arka planlar ve maskeler için bu yaklaşık bir denetimdir; tüm karelerde yerel kontrastı veya bilimsel doğruluğu garanti etmez. Storyboard’u gözle kontrol edin. Kayıtlı eski çizimler bu yeni kalite denetimine yeniden sokulmaz.
- İlk eksik sahne hemen başlar; sonraki eksik sahneden önce tamamlanan dosya kaydedilir ve 5 saniye beklenir. OpenRouter HTTP 429 yanıtında aynı istek 10/20/35 saniye aralıklarıyla en fazla üç kez tekrarlanır; 503 hatası doğrudan bildirilir. İçerik onarımları ayrı olup en fazla ikidir. Gemini 429/503 için model yedeklerini beklemeden dener. Belirsiz bağlantı hatasında ulaşmış olabilecek POST otomatik tekrarlanmaz.
- **Durdur** zamanlayıcıyı, isteği veya render’ı iptal eder ve temizliği bekler. Hazır sahneler saklanır; **Eksik sahneleri tamamla** yalnız eksikleri işler.

## Çizim ve güvenli alan

Portre sahne `viewBox="0 0 1080 1920"` veya eşdeğer koordinatlar kullanır. `layer-bg` ve statik ortam tüm kareyi doldurur; üstte başlık bandı yoktur. Özne ve hareketli katmanlar çıkış koordinatlarında y=0–1460 bölgesine kırpılır. Statik eski `set` grupları arka plan olarak tam kare kalır.

İsteğe bağlı en fazla iki küçük bilimsel etiket, `layer-fx` grubunun doğrudan çocuğu olarak eklenebilir:

```xml
<text data-keyword="true" x="120" y="600" font-size="28" fill="#fff">Yalıtım</text>
```

Her etiket 1–2 sözcük ve en fazla 28 karakterdir; çıkışta 14–40 piksel boyunda ve y=1200 üzerinde kalır. Konum ve ölçek dönüşümleri, uzun cümleler, sahne başlığı ve işaretlenmemiş metin temizlenir. Önizleme ve MP4 aynı görüntüleme listesini kullanır. Geçişte yalnız görseller karışır: giden ve gelen etiketler örtüşme süresince gizlenir, yeni etiket kendi sahnesinin ilk karesinde gösterilir. Önceki klip ve sessiz taslak önbellek anahtarları bu değişiklik için yenilendi; eski MP4 dosyaları kendiliğinden değiştirilmez. Eski katmanlı çizimlerde sınırsız konum/boyut taşıyan metinler yeniden render’da gösterilmez; eski diyagramların da yalnız iki küçük etiketi korunur. Uzun altyazılar görüntüde küçük sayfalara bölünerek altta tutulur; kayıtlı hizalama ve SRT değiştirilmez.

## Hareket protokolü

| `data-anim`       | Nesne pozu                                                      |
| ----------------- | --------------------------------------------------------------- |
| `move`            | Gecikmeden sonra yerel `dx`, `dy` kadar ilerler, sonunda durur. |
| `fall`, `rise`    | Fazı kaydırılabilen sürekli iniş/çıkış.                         |
| `draw`            | Görünür stroke’lu çizgiyi `pathLength=1` ve dash ile açar.      |
| `pulse`           | Yerel merkezde genişleyip sönümlenen halka.                     |
| `swing`, `wiggle` | Eklem noktasında periyodik dönüş.                               |
| `pop`             | `spring()` ile gecikmeli giriş.                                 |

`dx/dy` yerel SVG birimi; `delay/duration` saniye; `phase` 0–1; `angle` derece; `pivot-x/y` yerel merkezdir. Poz yalnız Remotion karesine ve FPS’ye bağlıdır. En az üç ayrı hareket ve ilk kareden süren bir döngü gerekir. Yeni çizimlerde `move` mesafesi dönüşümler ve viewBox uyarlaması sonrası en fazla 240 çıkış pikselidir. İstem, daha kısa hareketleri, iki uç noktanın da tünel/odacık içinde kalmasını, kontrastı, tutarlı anatomiyi ve doğal gölgeli toprak kenarlarını ayrıca ister; bu anlamsal koşullar otomatik geometri denetiminin garantisi değildir.

## Sessiz taslak ve normal üretim

Storyboard’daki **Sessiz taslağı oluştur**, onaylı senaryodan en az bir doğrulanmış çizim varsa hazır sahneleri sırayla render eder; eksik, değiştirilmiş veya doğrulanamayan çizimler atlanır. Süre sahnenin tahmini saniyesinden (yoksa 5 sn) alınır ve altyazılar tahminidir. TTS, Whisper, ses, müzik ve efekt çağrılmadan ses kanalı içermeyen H.264 MP4 doğrulanır. Taslak ve geçici klipler normal `final`, sahne klibi, ses ve altyazı önbelleklerinden ayrıdır. İlgili görsel veya süre değiştiğinde taslak bağlantısı geçersizleşir; eski dosya proje geçmişi için korunur.

Normal üretim hâlâ tam storyboard onayı ister. Tüm sahneler açıkça anlatımsızsa ve kullanıcı sesi, müzik veya efekt eklememişse normal MP4 de sessizdir. Sesli projelerin TTS, hizalama ve miksaj akışı korunur.

## Güvenlik ve saklama

`layered-svg.ts` / `motion-svg.ts` SVG’yi sınırlı bir geometri listesine ayrıştırır (96 KiB, sınırlı düğüm ve derinlik, sonlu sayılar). `script`, `iframe`, `foreignObject`, `image`, JS olay öznitelikleri ve dış bağlantılar çıkarılır; CSS, SMIL ve desteklenmeyen dekor sahneyi reddetmeden temizlenir. Yerel tanımsız başvurular kaldırılır. React, ham XML veya `innerHTML` yerine doğrulanmış öğeleri üretir.

Sahne `choreography` referansı anlatımı, başlığı ve kanonik SVG’yi içerik özetiyle bağlar. Başarısız işler `motionWork` kuyruğunda kalır. Kayıtlı eski çizimler ve ölçülmüş sesler görsel revizyonda silinmez.
