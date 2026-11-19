// Exercise the BUILT interface and real backend with isolated app data. No provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import express from 'express';
import { chromium } from 'playwright-core';
import studio from '../build/server.cjs';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-ui-qa-'));
// All provider responses in this control come from memory. No traffic to Google or Pollinations.
const textModel = 'gemini-2.5-flash';
const fixtureScript = 'Hava soğuduğunda birçok karınca türü yuvanın derinlerine çekilir.';
const voiceCalls = [],
  plannerCalls = [],
  imageCalls = [],
  imageCredential = 'sk_isolated-ui-fixture';
let enableTextFixture = false,
  scriptAttempts = 0;
const ctx = studio.createStudio(
  { root: home, pythonDir: path.resolve('python'), composition: path.resolve('build/composition') },
  {
    transport: async (url, opts) => {
      const host = new URL(url).host;
      if (host === 'api.iconify.design') {
        const u = new URL(url);
        if (u.pathname === '/search')
          return Response.json({ icons: ['tabler:' + u.searchParams.get('query')] });
        return new Response(
          '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v20H2Z"/></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } },
        );
      }
      if (host === 'openrouter.ai') {
        plannerCalls.push(host);
        return new Response(null, { status: 503 });
      }
      if (['gen.pollinations.ai', 'image.pollinations.ai'].includes(host)) {
        imageCalls.push([host, new Headers(opts.headers).get('authorization')]);
        return host === 'gen.pollinations.ai'
          ? new Response(fs.readFileSync('ui/public/art/ocean.jpg'), {
              headers: { 'content-type': 'image/jpeg' },
            })
          : new Response(null, { status: 503 });
      }
      if (!enableTextFixture) throw new Error('Network deliberately disabled in UI control');
      const base = 'https://generativelanguage.googleapis.com/v1/models';
      if (
        opts.method === 'GET' &&
        url === 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000'
      )
        return Response.json({
          models: [
            { name: 'models/gemini-test-tts', supportedGenerationMethods: ['generateContent'] },
          ],
        });
      if (
        opts.method === 'POST' &&
        url === 'https://generativelanguage.googleapis.com/v1beta/interactions'
      ) {
        const b = JSON.parse(opts.body);
        voiceCalls.push(b.input[0].content[0].text);
        return Response.json({
          status: 'completed',
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'audio',
                  mime_type: 'audio/wav',
                  data: fs.readFileSync('tests/fixtures/forest.wav').toString('base64'),
                },
              ],
            },
          ],
        });
      }
      if (opts.method === 'GET' && url === `${base}?pageSize=1000`)
        return Response.json({
          models: [
            { name: `models/${textModel}`, supportedGenerationMethods: ['generateContent'] },
          ],
        });
      if (
        opts.method === 'POST' &&
        url === `${base}/${textModel}:generateContent` &&
        JSON.parse(opts.body).contents?.[0]?.parts?.[0]?.text
      ) {
        if (++scriptAttempts === 1) return new Response(null, { status: 503 });
        return Response.json({
          candidates: [
            { finishReason: 'STOP', content: { role: 'model', parts: [{ text: fixtureScript }] } },
          ],
        });
      }
      return Response.json({ error: { status: 'NOT_FOUND' } }, { status: 404 });
    },
  },
);
ctx.app.use(express.static(path.resolve('build/ui')));
const server = ctx.app.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const exe =
  process.env.STUDIO_BROWSER ||
  (process.platform === 'win32'
    ? path.join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe')
    : '/usr/bin/chromium');
const browser = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(10000);
const errors = [],
  browserProviderRequests = [];
page.on('request', (r) => {
  if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin)
    browserProviderRequests.push(r.url());
});
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Son projeler' }).waitFor();
  await page.locator('.project-card').nth(2).waitFor(); // heading can mount before the project list arrives
  assert.equal(await page.locator('.project-card').count(), 3);
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Stüdyoda ara' }).fill('satürn');
  await page.getByRole('button', { name: 'Satürn’ün halkaları', exact: true }).click();
  await page.getByRole('textbox', { name: 'Senaryo metni' }).waitFor();
  await page.locator('.sidebar').getByRole('button', { name: 'Ayarlar', exact: true }).click();
  const speaker = page.getByRole('combobox', { name: 'Konuşmacı (Speaker) seçimi' });
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/settings/speaker') && r.ok()),
    speaker.selectOption('Kore'),
  ]);
  await page.reload();
  assert.equal(await speaker.inputValue(), 'Kore');
  await page.getByText('Eski uç · anahtarsız', { exact: true }).waitFor();
  assert.ok(
    await page.getByLabel('Toplu üretimde eksik görselleri Pollinations ile üret').isChecked(),
  );
  await page.locator('.sidebar').getByRole('button', { name: 'Yeni Video' }).click();
  await page.getByLabel('Belgesel konusu').fill('Karıncalar kışın neden ortadan kaybolur?');
  await page.getByLabel('Kendi senaryomu kullanacağım').check();
  await page.getByLabel('Mevcut senaryo').fill('Karıncalar toprağın altında kalır.');
  await page.getByRole('button', { name: 'Proje oluştur', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Senaryo metni' });
  await editor.waitFor();
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/script') && r.request().method() === 'POST' && r.ok(),
  );
  await editor.fill('Karıncalar kışın toprak altına çekilir.');
  await saved;
  await page.reload();
  await editor.waitFor();
  assert.equal(await editor.inputValue(), 'Karıncalar kışın toprak altına çekilir.');
  await page.getByRole('button', { name: 'Onayla ve devam et' }).click();
  await page.getByRole('heading', { name: 'Sahne planı' }).waitFor();
  await page.locator('.job-note.config').waitFor();
  assert.equal(await speaker.inputValue(), 'Kore');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/preferences') && r.ok()),
    speaker.selectOption('Puck'),
  ]);
  await page.getByRole('button', { name: 'Sahne ekle' }).click();
  await page.getByText('Sabit kadraj · Yumuşak geçiş', { exact: true }).waitFor();
  await page.getByLabel('Anlatım', { exact: true }).fill('Karıncalar kışın toprak altına çekilir.');
  await page
    .getByLabel('Görsel betimleme', { exact: true })
    .fill('Kışın toprağın altında korunaklı bir karınca yuvası.');
  assert.equal(await page.getByLabel('Görsel istemi (isteğe bağlı)').inputValue(), '');
  await page.getByText('Görsel bekleniyor', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Onayla ve üret' }).click();
  await page.getByRole('heading', { name: 'Sahne istasyonları' }).waitFor();
  await page.locator('.job-note.config').waitFor();
  const id = page.url().split('/').at(-1);
  let p = ctx.store.get(id);
  assert.ok(p.scriptApproval && p.boardApproval);
  assert.equal(p.final, undefined);
  await page.getByRole('button', { name: 'Sahne üretim araçları' }).click();
  assert.equal(p.voice, 'Puck');
  assert.match(await page.locator('.job-note.config').innerText(), /Seslendirme/);
  assert.equal(imageCalls.length, 0);
  await page.getByRole('button', { name: 'Görsel üret', exact: true }).click();
  await page.locator('.job-note.waiting').filter({ hasText: 'Pollinations: HTTP 503' }).waitFor();
  assert.deepEqual(imageCalls, [['image.pollinations.ai', null]]);
  assert.ok(await page.getByRole('button', { name: 'Görsel yükle' }).isEnabled());
  const voiceEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Anlatım yükle' }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/import/voice?') && r.ok()),
    (await voiceEvent).setFiles('tests/fixtures/forest.wav'),
  ]);
  await page.locator('.job-note.waiting').waitFor();
  await page.getByRole('button', { name: 'Storyboard', exact: true }).first().click();
  const fileEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Görsel yükle' }).click();
  await (await fileEvent).setFiles('ui/public/art/ants.jpg');
  await page.locator('.scene-card .station-art').waitFor();
  assert.equal(ctx.store.get(id).assets[p.scenes[0].id].image.source, 'import');
  await page.locator('.sidebar').getByRole('button', { name: 'Ayarlar', exact: true }).click();
  const keyInput = page.getByLabel('Pollinations API anahtarı (isteğe bağlı)');
  assert.equal(await keyInput.getAttribute('type'), 'password');
  await keyInput.fill(imageCredential);
  await page.getByRole('button', { name: 'Pollinations anahtarını kaydet', exact: true }).click();
  await page.getByText('Güncel API · anahtarlı', { exact: true }).waitFor();
  await page.reload();
  assert.equal(await keyInput.inputValue(), '');
  await page.locator('.sidebar').getByRole('button', { name: 'Storyboard', exact: true }).click();
  await page.getByRole('button', { name: 'Görseli yeniden üret', exact: true }).click();
  const localImage = page.locator('.scene-card img[src*="/media/storyboard/"]');
  await localImage.waitFor();
  await localImage.evaluate((img) => img.decode());
  assert.equal(ctx.store.get(id).assets[p.scenes[0].id].image.source, 'pollinations');
  assert.deepEqual(imageCalls, [
    ['image.pollinations.ai', null],
    ['gen.pollinations.ai', 'Bearer ' + imageCredential],
  ]);
  await page.reload();
  await localImage.waitFor();
  await localImage.evaluate((img) => img.decode());
  // The isolated project has no Whisper runtime. The shipped UI must allow viewing and editing its estimate.
  await page
    .locator('.sidebar')
    .getByRole('button', { name: 'Üretim Merkezi', exact: true })
    .click();
  await page.getByRole('button', { name: 'Sahne üretim araçları' }).click();
  await page.getByRole('button', { name: 'Sesi hizala' }).click();
  await page.getByText('Tahmini altyazı', { exact: true }).waitFor();
  await page.getByText('Hizalama günlüğü · tahmini cümle zamanları', { exact: true }).click();
  assert.match(await page.locator('.alignment-detail').innerText(), /python|Whisper/i);
  await page.getByRole('button', { name: 'Altyazıyı düzenle' }).click();
  const sentence = page.getByRole('textbox', { name: '1. cümle', exact: true });
  assert.equal(await sentence.inputValue(), 'Karıncalar kışın toprak altına çekilir.');
  const corrected = 'Bu altyazı, ses dinlenerek düzenlendi.';
  await sentence.fill(corrected);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/subtitles') && r.ok()),
    page.getByRole('button', { name: 'Kaydet', exact: true }).click(),
  ]);
  assert.equal(ctx.store.get(id).assets[p.scenes[0].id].edits[0].text, corrected);
  await page.locator('.sidebar').getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await page.getByLabel('Gemini API anahtarı').fill('only-a-local-ui-test-value');
  await page.getByRole('button', { name: 'Anahtarı kaydet' }).click();
  await page.getByRole('button', { name: 'Anahtarı güncelle' }).waitFor();
  assert.equal(await page.getByLabel('Gemini API anahtarı').inputValue(), '');
  await page.getByRole('button', { name: 'Bağlantıyı test et' }).click();
  await page.getByText('Servis kullanılamıyor', { exact: true }).first().waitFor();
  enableTextFixture = true;
  await page.getByRole('button', { name: 'Bağlantıyı test et' }).click();
  await page.getByLabel('Metin modeli', { exact: true }).selectOption(textModel);
  await page.getByLabel('Metin kullanım izni').selectOption('free');
  await page
    .locator('.model-row')
    .filter({ has: page.getByLabel('Metin modeli', { exact: true }) })
    .getByRole('button', { name: 'Uygula' })
    .click();
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/settings/model') && r.ok()),
    page.getByRole('button', { name: 'Faturalandırma kapalı, doğruladım' }).click(),
  ]);
  await page.locator('.sidebar').getByRole('button', { name: 'Yeni Video' }).click();
  await page.getByLabel('Belgesel konusu').fill('Karıncalar kışın neden ortadan kaybolur?');
  await page.getByRole('button', { name: 'Proje oluştur', exact: true }).click();
  await page.waitForFunction(
    (expected) =>
      document.querySelector('textarea[aria-label="Senaryo metni"]')?.value === expected,
    fixtureScript,
  );
  assert.equal(scriptAttempts, 2);
  assert.ok(await editor.isEditable());
  assert.equal(ctx.store.get(page.url().split('/').at(-1)).script, fixtureScript);
  await page.locator('.sidebar').getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await page.getByRole('button', { name: 'Pollinations anahtarını kaldır', exact: true }).click();
  await page.getByRole('button', { name: 'Kaldır', exact: true }).click();
  await page.getByText('Eski uç · anahtarsız', { exact: true }).waitFor();
  assert.equal(ctx.g.settings().models.text.consent, 'free');
  await page.getByRole('button', { name: 'Sil', exact: true }).click();
  await page.getByRole('button', { name: 'Anahtarı sil', exact: true }).click();
  await page.getByRole('button', { name: 'Anahtarı kaydet' }).waitFor();
  assert.equal(ctx.g.settings().hasKey, false);
  await page.getByRole('button', { name: 'Yerel servisler', exact: true }).click();
  await page.getByRole('button', { name: 'Servisleri kontrol et' }).click();
  await page.getByText('Kullanılabilir', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('Kullanılabilir', { exact: true }).count(), 2);
  // From own script to an actual all-SVG export with no image or TTS key.
  await page.getByRole('button', { name: 'SVG planlayıcı', exact: true }).click();
  await page.getByLabel('Planlama kaynağı').selectOption('openrouter');
  const svgKey = page.getByLabel('OpenRouter API anahtarı');
  await svgKey.fill('isolated-openrouter-fixture');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/svg-planner/key/openrouter') && r.ok()),
    page.getByRole('button', { name: 'Anahtarı kaydet', exact: true }).click(),
  ]);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/settings/svg-planner') && r.ok()),
    page.getByRole('button', { name: 'Planlayıcıyı kaydet' }).click(),
  ]);
  await page.locator('.sidebar').getByRole('button', { name: 'Yeni Video' }).click();
  await page.getByLabel('Belgesel konusu').fill('Kök kesiti');
  await page.getByLabel('Kendi senaryomu kullanacağım').check();
  await page.getByLabel('Mevcut senaryo').fill('Karıncalar ormanda ilerler.');
  await page.getByRole('button', { name: 'Proje oluştur', exact: true }).click();
  await page.getByLabel('Storyboard biçimi').selectOption('svg');
  await page.getByRole('button', { name: 'Onayla ve devam et' }).click();
  await page.locator('.job-note.waiting').filter({ hasText: 'OpenRouter: HTTP 503' }).waitFor();
  const card = page.locator('.scene-card').first(),
    mode = card.getByLabel('Sahne türü');
  assert.equal(await mode.inputValue(), 'svg');
  await mode.selectOption('photo');
  await card.getByText('Sabit kadraj · Yumuşak geçiş').waitFor();
  await mode.selectOption('svg');
  const templateSelect = card.getByLabel('SVG şablonu');
  await templateSelect.waitFor(); // SVG editor is lazy-loaded.
  assert.equal(await templateSelect.locator('option').count(), 12);
  assert.equal(await card.getByLabel('Bilim ikonu').locator('option').count(), 20);
  const keyword = card.getByLabel('Iconify anahtar kelimesi');
  await keyword.fill('lungs');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/scene-art') && r.ok()),
    card.getByRole('button', { name: 'İkon ara', exact: true }).click(),
  ]);
  await card.locator('.svg-paper [data-atlas-source="iconify"] image').first().waitFor();
  await card.getByText('Iconify · tabler:lungs', { exact: true }).first().waitFor();
  await templateSelect.selectOption('CycleLoopScene');
  await card.getByLabel('Aşama sayısı').selectOption('4');
  await card.getByLabel('Adım 4').fill('Yuvaya dönüş');
  await templateSelect.selectOption('LayerStackScene');
  await card.getByLabel('Katman 2').fill('');
  assert.ok(await page.getByRole('button', { name: 'Onayla ve üret' }).isDisabled());
  await templateSelect.selectOption('RatioGaugeScene');
  await card.getByLabel('Gösterge birimi').selectOption('×');
  await card.getByLabel('Kat sayısı').fill('50');
  await card.getByLabel('Şema etiketi 1').click();
  assert.match(await card.locator('.svg-paper').textContent(), /50×/);
  await templateSelect.selectOption('TimelineScaleScene');
  await card.getByLabel('Gösterge birimi').selectOption('km');
  await card.getByLabel('Bitiş değeri').fill('10');
  await card.getByLabel('Orta değer').fill('4');
  await card.getByLabel('Şema etiketi 1').click();
  assert.match(await card.locator('.svg-paper').textContent(), /4 km/);
  await card.getByLabel('SVG şablonu').selectOption('FocusCalloutScene');
  await card.getByLabel('Bilim ikonu').selectOption('cell');
  await card.locator('[data-science-icon="cell"]').first().waitFor();
  await card.getByLabel('Şema etiketi 1').fill('Hücre zarı');
  await card.getByLabel('Şema etiketi 2').fill('Su geçişi');
  await card
    .getByLabel('Şema başlığı')
    .fill('Bu cümle başlık olarak kullanılamayacak kadar uzundur');
  assert.ok(await page.getByRole('button', { name: 'Onayla ve üret' }).isDisabled());
  await card.getByLabel('SVG şablonu').selectOption('ThermometerGaugeScene');
  await card.getByLabel('Şema başlığı').fill('Toprak sıcaklığı');
  await card.getByLabel('Başlangıç değeri').fill('-5');
  await card.getByLabel('Bitiş değeri').fill('4');
  await card.getByLabel('Tahmini süre (sn)').fill('1.2');
  await card.getByRole('button', { name: 'Şemayı oynat' }).click();
  await page.waitForFunction(
    () => +document.querySelector('input[aria-label="Şema önizleme karesi"]').value > 0,
  );
  await page.getByRole('button', { name: 'Onayla ve üret' }).click();
  await page.locator('.job-note.config').filter({ hasText: 'Seslendirme' }).waitFor();
  assert.deepEqual(voiceCalls, []);
  // Test an already authorised model; pressing the production button is the only job action.
  ctx.g.key('isolated-browser-fixture');
  await ctx.g.test();
  ctx.g.configure('tts', { model: 'gemini-test-tts', consent: 'free' });
  await page.getByRole('button', { name: 'Videoyu üret', exact: true }).click();
  await page.getByRole('button', { name: 'Videoyu izle' }).waitFor({ timeout: 120000 });
  const svgResult = ctx.store.get(page.url().split('/').at(-1));
  assert.deepEqual(voiceCalls, ['Karıncalar ormanda ilerler.']);
  const shot = svgResult.assets[svgResult.scenes[0].id];
  assert.ok(shot.voice && shot.align && shot.clip);
  assert.equal(shot.align.method, 'estimated');
  assert.equal(svgResult.final.duration, Math.ceil(shot.voice.duration * 30) / 30);
  assert.equal(svgResult.scenes[0].svgPlan.icon, 'cell');
  assert.equal(svgResult.scenes[0].svgPlan.title, 'Toprak sıcaklığı');
  assert.equal(svgResult.scenes[0].svgPlan.fromValue, -5);
  assert.equal(svgResult.scenes[0].svgPlan.toValue, 4);
  assert.ok(!shot.image);
  assert.deepEqual(plannerCalls, ['openrouter.ai']);
  assert.equal(imageCalls.length, 2);
  // Play an already FFprobe-validated control, never a fabricated render in the dashboard.
  const previous = path.resolve('out/render-control/Projects');
  if (fs.existsSync(previous)) {
    const rendered = fs
      .readdirSync(previous)
      .map((n) => JSON.parse(fs.readFileSync(path.join(previous, n, 'project.json'), 'utf8')))
      .filter((p) => p.final)
      .sort((a, b) => b.updated.localeCompare(a.updated))[0];
    if (rendered) {
      fs.cpSync(path.join(previous, rendered.id), ctx.store.dir(rendered.id), { recursive: true });
      ctx.store.index(rendered);
      await page.goto(origin + '/#/preview/' + rendered.id);
      const video = page.locator('video');
      await video.waitFor();
      const info = await video.evaluate(async (vid) => {
        vid.muted = true;
        await vid.play();
        await new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Video did not advance')), 8000);
          vid.addEventListener(
            'timeupdate',
            () => {
              if (vid.currentTime > 0.1) {
                clearTimeout(t);
                resolve();
              }
            },
            { once: false },
          );
        });
        vid.pause();
        return [vid.videoWidth, vid.videoHeight, vid.currentTime];
      });
      assert.equal(info[0], 1080);
      assert.equal(info[1], 1920);
      console.log('Browser playback:', info);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Menüyü aç' }).click();
  await page.locator('.sidebar').getByRole('button', { name: 'Projeler', exact: true }).click();
  await page.getByRole('heading', { name: 'Projeler', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  assert.deepEqual(browserProviderRequests, []);
  console.log(
    'PASS: creation, auto-save/reopen, both approvals, speaker defaults/override, cost guard, both Pollinations routes (offline contract), failed image → manual upload → keyed regeneration and reloaded local thumbnail, generateContent draft in editor (offline contract), secure-entry UI, real local checks, player and mobile navigation; 503 → editable SVG icon/labels/title → one-click TTS, alignment attempt and MP4.',
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  ctx.store.db.close();
  fs.rmSync(home, { recursive: true, force: true });
}
