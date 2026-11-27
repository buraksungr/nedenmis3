// Exercise the BUILT interface and real backend with isolated app data. No provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import express from 'express';
import { chromium } from 'playwright-core';
import studio from '../build/server.cjs';
import { planReply } from '../tests/template-test-data.ts';
import { safeFrameBrowserControl } from '../tests/safe-frame-browser.ts';
import { centeredMotionBrowserControl } from '../tests/centered-motion-browser.ts';
import { templateBrowserControl } from '../tests/template-browser-control.ts';
import { themeBrowserControl } from '../tests/theme-browser-control.ts';
import { probe } from '../server/media.ts';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-ui-qa-'));
// All provider responses in this control come from memory. No traffic to Google or Pollinations.
const textModel = 'gemini-2.5-flash';
const fixtureScript = 'Hava soğuduğunda birçok karınca türü yuvanın derinlerine çekilir.';
const voiceCalls = [],
  plannerCalls = [],
  routerModels = [],
  claudeModels = [];
let quotaOnSecond = true;
let enableTextFixture = false,
  scriptAttempts = 0,
  routerScripts = 0,
  claudeScripts = 0;
const ctx = studio.createStudio(
  { root: home, pythonDir: path.resolve('python'), composition: path.resolve('build/composition') },
  {
    transport: async (url, opts) => {
      const host = new URL(url).host;
      if (host === 'openrouter.ai') {
        const body = JSON.parse(opts.body);
        routerModels.push(body.model);
        if (body.messages.length === 1) {
          routerScripts++;
          return Response.json({
            model: body.model,
            choices: [{ finish_reason: 'stop', message: { content: fixtureScript } }],
          });
        }
        const q = JSON.parse(body.messages[1].content);
        plannerCalls.push(q);
        if (q.sahne === 2 && quotaOnSecond) return new Response(null, { status: 429 });
        const result = planReply(q.sahne - 1, !!q.yönlendirme);
        return Response.json({
          model: 'offline-object-QA',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }],
        });
      }
      if (host === 'api.anthropic.com') {
        const body = JSON.parse(opts.body);
        claudeModels.push(body.model);
        assert.equal(new Headers(opts.headers).get('x-api-key'), 'isolated-anthropic-fixture');
        claudeScripts++;
        return Response.json({
          model: body.model,
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: fixtureScript }],
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
        url.includes('/models/') &&
        url.endsWith(':generateContent') &&
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
  await safeFrameBrowserControl(browser);
  await centeredMotionBrowserControl(browser);
  await templateBrowserControl(browser);
  await themeBrowserControl(browser);
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
  // Rig'siz akışta üretim asenkron başlar (setImmediate ile). Editör sayfasına
  // navigasyonu ve generateScript'in store'a yazmasını bekle.
  await page.waitForURL(/#\/script\//, { timeout: 15000 });
  await editor.waitFor({ timeout: 15000 });
  const projectId = page.url().split('/').at(-1);
  let retries = 0;
  while (ctx.store.get(projectId)?.script !== fixtureScript && retries++ < 400) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(scriptAttempts, 2);
  assert.ok(await editor.isEditable());
  assert.equal(ctx.store.get(projectId).script, fixtureScript);
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
  // Select a direct Claude model/key, reload the UI, and generate an actual script.
  await page.getByRole('button', { name: 'Sahne planlayıcı', exact: true }).click();
  await page.getByLabel('Planlama kaynağı').selectOption('anthropic');
  await page.getByLabel('Anthropic Claude model kimliği').fill('claude-test-20250101');
  await page.getByLabel('Anthropic Claude API anahtarı').fill('isolated-anthropic-fixture');
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/svg-planner/key/anthropic') && r.ok()),
    page.getByRole('button', { name: 'Anahtarı kaydet', exact: true }).click(),
  ]);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/settings/svg-planner') && r.ok()),
    page.getByRole('button', { name: 'Planlayıcıyı kaydet' }).click(),
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Sahne planlayıcı', exact: true }).click();
  assert.equal(await page.getByLabel('Planlama kaynağı').inputValue(), 'anthropic');
  assert.equal(
    await page.getByLabel('Anthropic Claude model kimliği').inputValue(),
    'claude-test-20250101',
  );
  assert.equal(await page.getByLabel('Anthropic Claude API anahtarı').inputValue(), '');
  async function autoScript(topic) {
    await page.locator('.sidebar').getByRole('button', { name: 'Yeni Video' }).click();
    await page.getByLabel('Belgesel konusu').fill(topic);
    await page.getByRole('button', { name: 'Proje oluştur', exact: true }).click();
    await page.waitForURL(/#\/script\//, { timeout: 15000 });
    await editor.waitFor({ timeout: 15000 });
    const projectId = page.url().split('/').at(-1);
    let tries = 0;
    while (ctx.store.get(projectId)?.script !== fixtureScript && tries++ < 400)
      await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(ctx.store.get(projectId).script, fixtureScript);
  }
  await autoScript('Karıncalar kışın nasıl yaşar?');
  assert.equal(claudeScripts, 1);
  assert.deepEqual(claudeModels, ['claude-test-20250101']);
  await page.locator('.sidebar').getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await page.getByRole('button', { name: 'Sahne planlayıcı', exact: true }).click();
  await page.getByLabel('Planlama kaynağı').selectOption('openrouter');
  const routerModel = 'meta-llama/llama-3.3-8b-instruct:free';
  await page.getByLabel('OpenRouter model kimliği').fill(routerModel);
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
  await page.reload();
  await page.getByRole('button', { name: 'Sahne planlayıcı', exact: true }).click();
  assert.equal(await page.getByLabel('OpenRouter model kimliği').inputValue(), routerModel);
  assert.equal(await page.getByLabel('OpenRouter API anahtarı').inputValue(), '');
  assert.equal(ctx.store.setting('vector-model', {}).anthropicModel, 'claude-test-20250101');
  await autoScript('Karıncalar soğukta nereye gider?');
  assert.equal(routerScripts, 1);
  assert.deepEqual(routerModels, [routerModel]);
  // From own script to an actual all-SVG export with no image or TTS key.
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
  await card.locator('[data-fixed-camera]').first().waitFor();
  const id = page.url().split('/').at(-1),
    initial = ctx.store.get(id),
    first = initial.scenes[0].choreography.digest;
  assert.equal(initial.scenes[0].visualMode, 'motion-svg');
  assert.equal(initial.scenes[1].choreography, undefined);
  async function stopWhile(label) {
    // Önce exact label ile dene; uyuşmazsa herhangi bir working job-notedaki
    // 'Durdur' butonuna bas (label akış sırasında değişebilir: 'Sonraki sahne...'
    // → 'Sahne X/5 çiziliyor · HTTP 429...').
    const exact = page
      .locator('.job-note.working')
      .filter({ hasText: label })
      .getByRole('button', { name: 'Durdur', exact: true });
    const any = page
      .locator('.job-note.working')
      .getByRole('button', { name: 'Durdur', exact: true });
    const count = await exact.count();
    if (count > 0) {
      await exact.first().click();
    } else {
      await any.first().click();
    }
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
  // Export a genuinely silent partial film directly from the unapproved board.
  const draftPanel = page.getByRole('region', { name: 'Sessiz taslak' });
  await draftPanel.getByText('1/2 hazır sahne • Sessiz taslak', { exact: true }).waitFor();
  assert.equal(await card.locator('[data-shot-title]').count(), 0);
  await draftPanel.getByRole('button', { name: 'Sessiz taslağı oluştur' }).click();
  await draftPanel.locator('video').waitFor({ timeout: 180000 });
  await page.waitForFunction(
    () => !document.querySelector('.job-note.working, .job-note.stopping'),
    null,
    { timeout: 180000 },
  );
  const partial = ctx.store.get(id);
  assert.equal(partial.boardApproval, null);
  assert.equal(partial.final, undefined);
  assert.deepEqual(partial.assets, {});
  assert.equal(partial.draft.scenes.length, 1);
  assert.equal(partial.draft.total, 2);
  assert.equal(partial.draft.scenes[0].id, partial.scenes[0].id);
  assert.equal(partial.draft.asset.hasAudio, false);
  const partialStreams = (await probe(path.join(ctx.store.dir(id), partial.draft.asset.file)))
    .streams;
  assert.ok(!partialStreams.some((s) => s.codec_type === 'audio'));
  assert.deepEqual(voiceCalls, []);
  const draftHref = await draftPanel
    .getByRole('link', { name: 'Sessiz taslağı indir' })
    .getAttribute('href');
  const download = await page.request.get(new URL(draftHref, origin).href);
  assert.equal(download.status(), 200);
  await page.getByRole('button', { name: 'Hareketli sahneleri planla' }).click();
  await stopWhile(/HTTP 429 - Kota\/Hız Sınırı.*10 sn.*1\/3/);
  assert.deepEqual(
    plannerCalls.map((q) => q.sahne ?? 0),
    [1, 2],
  ); // no retry POST
  assert.equal(ctx.store.get(id).scenes[0].choreography.digest, first);
  quotaOnSecond = false;
  await second.getByRole('button', { name: 'Bu sahneyi tamamla' }).click();
  await second.locator('[data-motion-stage]').waitFor();
  assert.equal(
    ctx.store.get(id).draft,
    undefined,
    'new drawing must invalidate the old partial draft',
  );
  assert.deepEqual(
    plannerCalls.map((q) => q.sahne ?? 0),
    [1, 2, 2],
  );
  assert.ok(routerModels.every((model) => model === routerModel));
  const f = second.locator('[data-object="tunnel-ant-a"] > g').first(),
    prev = await f.getAttribute('transform'),
    cam = second.locator('[data-fixed-camera]').first(),
    box = await cam.getAttribute('viewBox');
  await second.getByLabel('Nesne animasyonu karesi').press('End');
  assert.notEqual(await f.getAttribute('transform'), prev);
  assert.equal(await cam.getAttribute('viewBox'), box);
  assert.equal(await cam.getAttribute('transform'), null);
  assert.equal(await second.locator('svg use').count(), 0); // Templates do not depend on a duplicated rig.
  assert.equal(await second.locator('[id$="tpl-v175-ant-tunnel"]').count(), 1);
  const old = ctx.store.get(id).scenes[1].choreography.digest;
  await second
    .getByLabel('Çizim yönlendirmesi (isteğe bağlı)')
    .fill('Daha sıcak renkler ve yavaş hareket.');
  await second.getByRole('button', { name: 'Bu sahneyi yeniden üret' }).click();
  await page.waitForFunction((x) => {
    const next = document
      .querySelectorAll('.scene-card [data-motion-stage]')[1]
      ?.getAttribute('data-motion-stage');
    return next && next !== x;
  }, old);
  assert.equal(ctx.store.get(id).scenes[0].choreography.digest, first);
  assert.notEqual(ctx.store.get(id).scenes[1].choreography.digest, old);
  assert.equal(plannerCalls.at(-1).yönlendirme, 'Daha sıcak renkler ve yavaş hareket.');
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
      const video = page.locator('video').first();
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
    'PASS: actual object SVG board, partial 1/2 silent MP4 without approval or TTS, two approvals, cancellation and retry, fixed camera, directed redraw, speaker selection, one-click spoken MP4, subtitle editing, local playback and mobile navigation.',
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  ctx.store.db.close();
  fs.rmSync(home, { recursive: true, force: true });
}
