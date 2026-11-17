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
const ctx = studio.createStudio(
  { root: home, pythonDir: path.resolve('python'), composition: path.resolve('build/composition') },
  {
    transport: async () => {
      throw new Error('Network deliberately disabled in UI control');
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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Son projeler' }).waitFor();
  assert.equal(await page.locator('.project-card').count(), 3);
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Stüdyoda ara' }).fill('satürn');
  await page.getByRole('button', { name: 'Satürn’ün halkaları', exact: true }).click();
  await page.getByRole('textbox', { name: 'Senaryo metni' }).waitFor();
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
  await page.getByRole('button', { name: 'Sahne ekle' }).click();
  await page.getByLabel('Anlatım', { exact: true }).fill('Karıncalar kışın toprak altına çekilir.');
  await page
    .getByLabel('Görsel betimleme', { exact: true })
    .fill('Kışın toprağın altında korunaklı bir karınca yuvası.');
  await page.getByLabel('Görsel istemi', { exact: true }).fill('Dokulu sinematik 2D yuva kesiti.');
  await page
    .getByLabel('Animasyon talimatı', { exact: true })
    .fill('Kamera sıcak odacığa yaklaşır.');
  await page.getByRole('button', { name: 'Onayla ve üret' }).click();
  await page.getByRole('heading', { name: 'Sahne istasyonları' }).waitFor();
  await page.locator('.job-note.config').waitFor();
  const id = page.url().split('/').at(-1);
  let p = ctx.store.get(id);
  assert.ok(p.scriptApproval && p.boardApproval);
  assert.equal(p.final, undefined);
  await page.getByRole('button', { name: 'Sahne üretim araçları' }).click();
  const fileEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Görsel değiştir' }).click();
  await (await fileEvent).setFiles('ui/public/art/ants.jpg');
  await page.locator('.station-art').waitFor();
  assert.ok(ctx.store.get(id).assets[p.scenes[0].id].image);
  await page.locator('.sidebar').getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await page.getByLabel('Gemini API anahtarı').fill('only-a-local-ui-test-value');
  await page.getByRole('button', { name: 'Anahtarı kaydet' }).click();
  await page.getByRole('button', { name: 'Anahtarı güncelle' }).waitFor();
  assert.equal(await page.getByLabel('Gemini API anahtarı').inputValue(), '');
  await page.getByRole('button', { name: 'Bağlantıyı test et' }).click();
  await page.getByText('Servis kullanılamıyor', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Sil', exact: true }).click();
  await page.getByRole('button', { name: 'Anahtarı sil', exact: true }).click();
  await page.getByRole('button', { name: 'Anahtarı kaydet' }).waitFor();
  assert.equal(ctx.g.settings().hasKey, false);
  await page.getByRole('button', { name: 'Yerel servisler', exact: true }).click();
  await page.getByRole('button', { name: 'Servisleri kontrol et' }).click();
  await page.getByText('Kullanılabilir', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('Kullanılabilir', { exact: true }).count(), 2);
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
  console.log(
    'PASS: creation, auto-save/reopen, both approvals, cost guard, manual media import, secure-entry UI, real local checks, player and mobile navigation.',
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  ctx.store.db.close();
  fs.rmSync(home, { recursive: true, force: true });
}
