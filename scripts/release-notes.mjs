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
const notes = `**Nedenmiş Studio ${version} — sabit kameralı, nesne bazlı hareketli SVG**

Windows x64 kurucusu. Yayıncı sertifikası yoktur. FFmpeg, FFprobe ve Remotion paketlidir; güncel Edge veya Chrome gerekir.

- Kurucu: \`${name}\` (${(installer.length / 1024 / 1024).toFixed(1)} MB)
- SHA-256: \`${sha256}\`
- Kaynak: [\`${process.env.GITHUB_SHA.slice(0, 12)}\`](https://github.com/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA})
- Ölçülen storyboard sahne aralığı: **${clock.observedMs.join(' / ')} ms** (Gemini model yedekleri bekleme olmadan denenir).
- Temiz Windows’a kuruldu, kurulu uygulama Edge ile kompozisyonu açtı. Rapor: \`install-report.json\` (iş artefaktında).

- Windows’ta geçici \`EPERM\`, \`EBUSY\` ve \`EACCES\` yeniden adlandırma hataları kısa artan aralıklarla yeniden denenir; son çare kopyalama atomik değildir. İlerleme kayıtları seyreltilir; kalıcı disk hatası bildirilir ve proje güvenli biçimde yeniden denenir.
- Yeni çizim istemi yüksek kontrast ve konuya uygun somut bilimsel anatomi ister. Göz sahnelerinde iris lifleri, sklera, kornea/mercek, retina ve ışınlar örneklenir. Yeni sahnelerde tespit edilebilir çok düşük kontrast ve boş göz halkaları/kutuları onarıma gönderilir; karmaşık çizimlerde görsel ve bilimsel doğruluk yine kullanıcı kontrolü gerektirir. Eski imzalı çizimler okunmaya devam eder.
- Geçişte giden ve gelen anahtar kelimeler gizlenir; yeni etiket kendi sahnesinde görünür. Klip ve sessiz taslak önbelleği yeniden render için güncellendi. Çevrimdışı göz çizimiyle kodlanmış MP4’ün geçiş pikselleri ve gerçek render ilerlemesinde benzetilmiş \`EPERM\` sınanır; bu canlı sağlayıcı kalite testi değildir.
- Sabit üst başlık kaldırıldı; arka plan 1080 × 1920 kareyi doldurur. Sahne başlığı yalnız proje bilgisidir; isteğe bağlı küçük, 1–2 sözcüklük bilimsel etiketler güvenli alanda kalır. Yeni \`move\` hareketlerinin dönüşümler sonrası toplam mesafesi sınırlanır.
- Storyboard’da **Sessiz taslağı oluştur**: en az bir hazır sahne varsa eksikler atlanır, süreler sahne ayarlarından tahmin edilir ve ses kanalı olmayan MP4 üretilir. TTS, Whisper, müzik ve efekt kullanılmaz; normal üretim kayıtları korunur.
- Tümü anlatımsız ve kullanıcı sesi/müziği/efekti olmayan onaylı SVG projeleri de gerçekten sessiz MP4 üretir. Sesli tam üretim, altyazı, **Durdur** ve tek tıkla MP4 akışı korunur.

\`title\`, \`desc\`, \`style\`, SMIL, işaretlenmemiş \`text\` ve \`metadata\` gibi dekorlar temizlenir. Yalnız sınırlandırılmış \`data-keyword="true"\` metni kabul edilir. \`script\`, \`iframe\`, \`foreignObject\`, \`image\`, JS olay öznitelikleri ve dış bağlantılar güvenlik gerekçesiyle çıkarılır.
`;
fs.writeFileSync('out/render-control/release-notes.md', notes);
console.log(`release notes: ${name} ${sha256}`);
