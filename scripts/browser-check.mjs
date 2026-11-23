// Exercise the BUILT interface and real backend with isolated app data. No provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import express from 'express';
import { chromium } from 'playwright-core';
import studio from '../build/server.cjs';
import { rigReply, stageReply } from '../tests/ant-motion-art.ts';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-ui-qa-'));
// All provider responses in this control come from memory. No traffic to Google or Pollinations.
const textModel = 'gemini-2.5-flash';
const fixtureScript = 'Hava soğuduğunda birçok karınca türü yuvanın derinlerine çekilir.';
const voiceCalls = [],
  plannerCalls = [];
let quotaOnSecond = true;
let enableTextFixture = false,
  scriptAttempts = 0;
const ctx = studio.createStudio(
  { root: home, pythonDir: path.resolve('python'), composition: path.resolve('build/composition') },
  {
    transport: async (url, opts) => {
      const host = new URL(url).host;
      if (host === 'openrouter.ai') {
        const q = JSON.parse(JSON.parse(opts.body).messages[1].content);
        plannerCalls.push(q);
        if (q.sahne === 2 && quotaOnSecond) return new Response(null, { status: 429 });
        const result = q.sahne ? stageReply(q.sahne - 1, !!q.yönlendirme) : rigReply();
        return Response.json({
          model: 'offline-object-QA',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }],
        });
      }
      assert.equal(host, 'generativelanguage.googleapis.com');
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
  assert.equal(ctx.store.get(page.url().split('/').at(-1)).voice, 'Puck');
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
  await page.getByRole('button', { name: 'Sahne planlayıcı', exact: true }).click();
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
  await page.getByLabel('Belgesel konusu').fill('Karıncalar kışın nereye gider?');
  await page.getByLabel('Kendi senaryomu kullanacağım').check();
  const lines = ['Karıncalar ormanda ilerler.', 'İşçiler yuvalarına döner.'];
  await page.getByLabel('Mevcut senaryo').fill(lines.join(' '));
  await page.getByRole('button', { name: 'Proje oluştur', exact: true }).click();
  await page.getByText('Sabit kamera · Hareketli SVG', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Onayla ve devam et' }).click();
  const card = page.locator('.scene-card').first(),
    second = page.locator('.scene-card').nth(1);
  await card.locator('[data-fixed-camera]').waitFor();
  const id = page.url().split('/').at(-1),
    initial = ctx.store.get(id),
    first = initial.scenes[0].choreography.digest;
  assert.equal(initial.scenes[0].visualMode, 'motion-svg');
  assert.equal(initial.scenes[1].choreography, undefined);
  async function stopWhile(label) {
    await page
      .locator('.job-note.working')
      .filter({ hasText: label })
      .getByRole('button', { name: 'Durdur', exact: true })
      .click();
    await page.locator('.job-note.cancelled').waitFor();
  }
  await stopWhile('Sonraki sahne için bekleniyor...');
  // Production starts directly with Sahne 1; no common rig (scene 0) call anymore.
  assert.deepEqual(
    plannerCalls.map((q) => q.sahne ?? 0),
    [1],
  ); // no second POST
  await page.reload();
  await card.locator('[data-motion-stage]').waitFor();
  await page.getByRole('button', { name: 'Eksik sahneleri tamamla' }).click();
  await stopWhile(/HTTP 429 - Kota\/Hız Sınırı.*10 sn.*1\/3/);
  assert.deepEqual(
    plannerCalls.map((q) => q.sahne ?? 0),
    [1, 2],
  ); // no retry POST
  assert.equal(ctx.store.get(id).scenes[0].choreography.digest, first);
  quotaOnSecond = false;
  await second.getByRole('button', { name: 'Bu sahneyi tamamla' }).click();
  await second.locator('[data-motion-stage]').waitFor();
  assert.deepEqual(
    plannerCalls.map((q) => q.sahne ?? 0),
    [1, 2, 2],
  );
  const f = second.locator('[data-object="ant-lead"] > g').first(),
    prev = await f.getAttribute('transform'),
    cam = second.locator('[data-fixed-camera]').first(),
    box = await cam.getAttribute('viewBox');
  await second.getByLabel('Nesne animasyonu karesi').press('End');
  assert.notEqual(await f.getAttribute('transform'), prev);
  assert.equal(await cam.getAttribute('viewBox'), box);
  assert.equal(await cam.getAttribute('transform'), null);
  assert.equal(await second.locator('svg use').count(), 5);
  const old = ctx.store.get(id).scenes[1].choreography.digest;
  await second
    .getByLabel('Çizim yönlendirmesi (isteğe bağlı)')
    .fill('Öncü karıncayı daha büyük göster.');
  await second.getByRole('button', { name: 'Bu sahneyi yeniden üret' }).click();
  await page.waitForFunction((x) => {
    const next = document
      .querySelectorAll('.scene-card [data-motion-stage]')[1]
      ?.getAttribute('data-motion-stage');
    return next && next !== x;
  }, old);
  assert.equal(ctx.store.get(id).scenes[0].choreography.digest, first);
  assert.notEqual(ctx.store.get(id).scenes[1].choreography.digest, old);
  assert.equal(plannerCalls.at(-1).yönlendirme, 'Öncü karıncayı daha büyük göster.');
  await page.getByRole('button', { name: 'Onayla ve üret' }).click();
  await page.locator('.job-note.config').filter({ hasText: 'Seslendirme' }).waitFor();
  assert.deepEqual(voiceCalls, []);
  ctx.g.key('isolated-browser-fixture');
  await ctx.g.test();
  ctx.g.configure('tts', { model: 'gemini-test-tts', consent: 'free' });
  await page.getByRole('button', { name: 'Videoyu üret', exact: true }).click();
  await page.getByRole('button', { name: 'Videoyu izle' }).waitFor({ timeout: 150000 });
  const finished = ctx.store.get(id);
  assert.deepEqual(voiceCalls, lines);
  for (const shot of Object.values(finished.assets)) {
    assert.ok(shot.voice && shot.align && shot.clip && !shot.image);
    assert.equal(shot.align.method, 'estimated');
  }
  assert.ok(finished.final);
  assert.deepEqual(
    plannerCalls.map((q) => q.sahne ?? 0),
    [1, 2, 2, 2],
  );
  await page.getByRole('button', { name: 'Sahne üretim araçları' }).first().click();
  await page.getByRole('button', { name: 'Altyazıyı düzenle' }).click();
  const sentence = page.getByRole('textbox', { name: '1. cümle', exact: true });
  await sentence.fill('Bu altyazı düzenlendi.');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/subtitles') && r.ok()),
    page.getByRole('button', { name: 'Kaydet', exact: true }).click(),
  ]);
  assert.equal(
    ctx.store.get(id).assets[finished.scenes[0].id].edits[0].text,
    'Bu altyazı düzenlendi.',
  );
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
    'PASS: actual default object SVG board, two approvals, stop in the 5s cooldown (no scene POST), reopen, stop in the 429 backoff (no retry POST), resume only the missing drawing, fixed camera while an ant moves, directed redraw, speaker selection, consent, one-click spoken MP4 and subtitle editing, local playback and mobile navigation.',
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  ctx.store.db.close();
  fs.rmSync(home, { recursive: true, force: true });
}
