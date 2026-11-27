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
- Model karmaşık SVG, XML veya koordinat üretmez; yalnız şablon ve sınırlı seçenek önerir. 33 kimliğin kategori, Türkçe/İngilizce sözcük ve kullanım kapsamı yereldir. Bilinmeyen veya ilgisiz kimlik, sahne ve proje konusuna göre güvenli seçeneğe düşer. Kara delikte olay ufku, yığılma diski ve ışık bükülmesi; kalp ve karıncada konuya özgü alternatifler vardır. Tanınmayan konuda ilgisiz göz/molekül yerine nötr şema kullanılır. Eşleme yaklaşık olduğu için storyboard’da gözle kontrol gerekir.
- Art arda aynı yerel şablon seçilmez; video genelinde kullanılmamış uygun görünüm varsa tercih edilir. Uygun seçenekler tükenirse ilgisiz konu eklemek yerine yeniden kullanım mümkündür. Eksik sahne yeniden denenirken ve tek sahne yenilenirken her iki komşu, kısmi taslak için de en yakın hazır sahneler dikkate alınır. Sıralama veya eksik dosya tekrar oluşturursa onay/taslak uyarır; sahneyi yeniden üretin.
- 1080 × 1920 arka plan tam kareyi doldurur; ayrık üst panel kaldırıldı. Yeni sahneler ortak ve sınırlı kamera nefesiyle hareket eder: bütün kalp ve damarları birlikte atar; karınca antenleri, yörüngeler ve akışlar bağımsız ama bağlıdır. En fazla iki küçük etiket altyazıdan ayrıdır ve geçişte hayalet bırakmaz. Eski imzalı sahneler (1.7.4 dahil), v1 hareket davranışı ve eski taslak önbelleği korunur.
- Senaryo ve şablon seçimi Gemini, model kimliği yazılabilen OpenRouter (varsayılan \`openrouter/free\`) veya ayrı anahtarlı doğrudan Anthropic Claude ile yapılır. Otomatik seçim kayıtlı OpenRouter’ı, yoksa Gemini’yi kullanır; hatada başka sağlayıcıya geçilmez. Model erişimini, kotayı ve olası ücretleri sağlayıcıda kontrol edin; Gemini seslendirme ayrı ayarlanır.
- **Sessiz taslak** hazır sahneleri storyboard onayı ve ses beklemeden dışa aktarır; eksikler atlanır, süre/altyazı tahmin edilir ve ses kanalı bulunmaz. Normal sesli üretim, tek altyazı, Durdur/devam ve mevcut ses/zamanları koruyan sahne yenileme akışı sürer.
- Windows’ta geçici \`EPERM\`, \`EBUSY\` ve \`EACCES\` kayıt hataları kısa aralıklarla yeniden denenir; son çare kopyalama atomik değildir. Kalıcı disk hatası bildirilir.
- Windows işi 33 şablonun tarayıcı karelerini, güvenli alanı ve gerçek altyazı ayrımını; kodlanmış kara delik/kalp filmlerindeki ışık, akış ve organ hareketini; karınca filminde sınırlı ortak kamerayı ve bağımsız hareketleri; eski sahneleri, kısmi taslağı, durdur/devamı, kurulum ve gerçek CPU Whisper’ı sınar. Testlerde sağlayıcı yanıtları kontrollü fixture’lardır; canlı model, kota veya ses kalitesi doğrulanmış değildir.

Kayıtlı SVG’ler güvenli geometri ayrıştırıcısıyla doğrulanır; etkin içerik ve harici bağlantılar temizlenir. Kurucu imzasızdır.
`;
fs.writeFileSync('out/render-control/release-notes.md', notes);
console.log(`release notes: ${name} ${sha256}`);
