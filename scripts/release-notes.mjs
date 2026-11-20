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
- Ölçülen storyboard aralıkları (sahne, 1./2./3. yeniden deneme): **${clock.observedMs.join(' / ')} ms**
- Temiz Windows’a kuruldu, kurulu uygulama Edge ile kompozisyonu açtı. Rapor: \`install-report.json\` (iş artefaktında).

Sabit kamera ve nesne bazlı \`data-anim\` hareketi, tek katmanlı sarı altyazı, **Durdur** ve tek tıkla MP4 akışı korunur. "Hareketli sahneleri planla" artık zararsız veya desteklenmeyen SVG etiketlerini (\`title\`, \`desc\`, \`style\`, SMIL, \`text\`, \`metadata\`…) sahneden koddan temizleyip geri kalanı kabul eder. Yalnız \`script\`, \`iframe\`, \`foreignObject\`, \`image\`, JS olay öznitelikleri ve dış bağlantılar güvenlik gerekçesiyle çıkarılır. Hata mesajı sorunlu etiketi adlandırır.
`;
fs.writeFileSync('out/render-control/release-notes.md', notes);
console.log(`release notes: ${name} ${sha256}`);
