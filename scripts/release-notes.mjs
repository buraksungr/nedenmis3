// Build GitHub release notes only from the verified installer on this runner.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
  name = `Nedenmis-Studio-${version}-Setup.exe`,
  exe = `dist/installer/${name}`,
  installer = fs.readFileSync(exe),
  sha256 = createHash('sha256').update(installer).digest('hex'),
  report = JSON.parse(fs.readFileSync('out/render-control/install-report.json', 'utf8')),
  clock = JSON.parse(fs.readFileSync('out/render-control/planner-clock.json', 'utf8'));
// The website build hash must match the installer bytes: a stale dist is not published.
if (process.env.EXPECTED_SHA256 && sha256 !== process.env.EXPECTED_SHA256)
  throw Error(`Installer hash mismatch: ${sha256} != ${process.env.EXPECTED_SHA256}`);
if (!report.installed || process.env.GITHUB_SHA === undefined)
  throw Error('No verified installation report for this runner.');
const notes = `**Nedenmiş Studio ${version} — yerel bilimsel infografik şablonları**

Windows x64 kurucusu. Yayıncı sertifikası yoktur. FFmpeg, FFprobe ve Remotion paketlidir; güncel Edge veya Chrome gerekir.

- Kurucu: \`${name}\` (${(installer.length / 1024 / 1024).toFixed(1)} MB)
- SHA-256: \`${sha256}\`
- Kaynak: [\`${process.env.GITHUB_SHA.slice(0, 12)}\`](https://github.com/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA})
- Ölçülen storyboard sahne aralığı: **${clock.observedMs.join(' / ')} ms** (Gemini model yedekleri bekleme olmadan denenir).
- Temiz Windows’a kuruldu; kurulu uygulama Edge ile kompozisyonu açtı. Rapor: \`install-report.json\` (iş artefaktında).

- **33 yerel katmanlı şablon:** göz ve kesiti, beyin/nöron, kalp/dolaşım, hücre/DNA, akciğer, kas/eklem; yeraltı kolonisi/tünel, atmosfer, okyanus, su döngüsü, bitki; ışık, manyetizma, elektrik, yörünge, yerçekimi, ses, ısı ve genel bilimsel karşılaştırma/süreç/denge görünümleri.
- Model artık karmaşık SVG, XML veya koordinat üretmez. Yalnız şablon kimliği, izinli palet/vurgu, hız/yön, sınırlı durum değeri ve isteğe bağlı kısa etiket önerir; çizim uygulamada oluşturulur. Etiket ve sayısal değer yalnız konuda veya anlatımda geçiyorsa gösterilir. Eşleşme yoksa nötr şema kullanılır; konu eşleşmesini ve bilimsel doğruluğu storyboard’da kontrol edin.
- Art arda aynı yerel şablon seçilmez, mümkün olduğunda farklı görünüm tercih edilir. Eksik sahne yeniden denenirken ve tek sahne yenilenirken her iki komşu, kısmi taslak için de en yakın hazır sahneler dikkate alınır. Sıralama veya eksik dosya tekrar oluşturursa onay/taslak uyarır; sahneyi yeniden üretin.
- 1080 × 1920 arka plan tam kareyi doldurur, sabit üst başlık yoktur. En fazla iki küçük etiket alttaki altyazıdan ayrıdır ve sahne geçişinde hayalet etiket bırakmaz. Anatomi merkezden ölçeklenir, akış yolu izler ve yer değiştirme sınırlıdır. Eski imzalı sahneler, v1 hareket davranışı ve eski taslak önbelleği korunur.
- Senaryo ve şablon seçimi Gemini, model kimliği yazılabilen OpenRouter (varsayılan \`openrouter/free\`) veya ayrı anahtarlı doğrudan Anthropic Claude ile yapılır. Otomatik seçim kayıtlı OpenRouter’ı, yoksa Gemini’yi kullanır; hatada başka sağlayıcıya geçilmez. Model erişimini, kotayı ve olası ücretleri sağlayıcıda kontrol edin; Gemini seslendirme ayrı ayarlanır.
- **Sessiz taslak** hazır sahneleri storyboard onayı ve ses beklemeden dışa aktarır; eksikler atlanır, süre/altyazı tahmin edilir ve ses kanalı bulunmaz. Normal sesli üretim, tek altyazı, Durdur/devam ve mevcut ses/zamanları koruyan sahne yenileme akışı sürer.
- Windows’ta geçici \`EPERM\`, \`EBUSY\` ve \`EACCES\` kayıt hataları kısa aralıklarla yeniden denenir; son çare kopyalama atomik değildir. Kalıcı disk hatası bildirilir.
- Windows işi 33 şablonun tarayıcı karelerini, güvenli alanı ve gerçek altyazı ayrımını; kodlanmış karınca filminde sabit dekoru ve bağımsız hareketleri; eski sahneleri, kısmi taslağı, durdur/devamı, kurulum ve gerçek CPU Whisper’ı sınar. Testlerde sağlayıcı yanıtları kontrollü fixture’lardır; canlı model, kota veya ses kalitesi doğrulanmış değildir.

Kayıtlı SVG’ler güvenli geometri ayrıştırıcısıyla doğrulanır; etkin içerik ve harici bağlantılar temizlenir. Kurucu imzasızdır.
`;
fs.writeFileSync('out/render-control/release-notes.md', notes);
console.log(`release notes: ${name} ${sha256}`);
