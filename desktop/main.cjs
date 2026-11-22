const { app, BrowserWindow, safeStorage, session, shell, dialog } = require('electron');
const express = require('express');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { randomBytes } = require('node:crypto');
let win,
  server,
  stopActive,
  draining = false;
const verify = process.argv.includes('--verify-install');
const scratch = verify ? fs.mkdtempSync(path.join(os.tmpdir(), 'Nedenmis-verify-')) : null;
if (scratch) app.setPath('userData', scratch);
app.setName('Nedenmiş Studio');
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    win?.restore();
    win?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      const { createStudio, parseSubjectRig, parseStage } = require('../build/server.cjs');
      const state = app.getPath('userData');
      const resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
      // Local OS association lookup; does not open the URL or contact the network.
      const defaultBrowser =
        process.platform === 'win32'
          ? await app
              .getApplicationInfoForProtocol('https://example.invalid/')
              .then((info) => info.path)
              .catch(() => undefined)
          : undefined;
      function vaultFor(provider) {
        const secret = path.join(state, provider + '.credential');
        return {
          mode: 'encrypted',
          has: () => fs.existsSync(secret),
          get: () =>
            fs.existsSync(secret) ? safeStorage.decryptString(fs.readFileSync(secret)) : undefined,
          set: (key) => {
            if (
              !safeStorage.isEncryptionAvailable() ||
              (process.platform === 'linux' &&
                safeStorage.getSelectedStorageBackend() === 'basic_text')
            )
              throw new Error('Güvenli kimlik deposu kullanılamıyor.');
            fs.mkdirSync(state, { recursive: true });
            fs.writeFileSync(secret + '.tmp', safeStorage.encryptString(key), { mode: 0o600 });
            fs.renameSync(secret + '.tmp', secret);
          },
          clear: () => fs.rmSync(secret, { force: true }),
        };
      }
      const vault = vaultFor('gemini'),
        plannerVaults = { groq: vaultFor('groq'), openrouter: vaultFor('openrouter') };
      const token = randomBytes(32).toString('hex'),
        studio = createStudio(
          {
            root: path.join(scratch || app.getPath('documents'), 'NedenmisStudio'),
            pythonDir: path.join(resources, 'python'),
            composition: path.join(resources, app.isPackaged ? 'composition' : 'build/composition'),
            defaultBrowser,
          },
          { vault, plannerVaults, desktopToken: token },
        );
      stopActive = studio.stopActive;
      studio.app.use((_q, r, n) => {
        r.set(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        );
        n();
      });
      const ui = path.join(__dirname, '../build/ui');
      studio.app.use(express.static(ui));
      studio.app.get('/{*splat}', (_q, r) => r.sendFile(path.join(ui, 'index.html')));
      server = await new Promise((resolve) => {
        const s = studio.app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const origin = `http://127.0.0.1:${server.address().port}`;
      session.defaultSession.webRequest.onBeforeSendHeaders((d, cb) => {
        if (new URL(d.url).origin === origin) d.requestHeaders['x-studio-session'] = token;
        cb({ requestHeaders: d.requestHeaders });
      });
      session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
      win = new BrowserWindow({
        width: 1440,
        height: 950,
        minWidth: 850,
        minHeight: 620,
        show: !verify,
        backgroundColor: '#101211',
        title: 'Nedenmiş Studio',
        autoHideMenuBar: true,
        icon: path.join(resources, app.isPackaged ? 'studio.ico' : 'resources/studio.ico'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      });
      win.webContents.on('will-navigate', (e, url) => {
        if (new URL(url).origin !== origin) e.preventDefault();
      });
      win.webContents.setWindowOpenHandler(({ url }) => {
        const u = new URL(url);
        if (
          u.protocol === 'https:' &&
          ['ai.google.dev', 'aistudio.google.com', 'www.python.org'].includes(u.host)
        )
          void shell.openExternal(url);
        return { action: 'deny' };
      });
      await win.loadURL(origin);
      if (verify) {
        // Isolated native install test: never read a real user's projects or credentials.
        const geminiProbe = randomBytes(26).toString('hex');
        for (const [name, candidate, key] of [
          ['gemini', vault, geminiProbe],
          ['groq', plannerVaults.groq, randomBytes(26).toString('hex')],
          ['openrouter', plannerVaults.openrouter, randomBytes(26).toString('hex')],
        ]) {
          candidate.set(key);
          if (
            vaultFor(name).get() !== key ||
            fs.readFileSync(path.join(state, name + '.credential')).includes(key)
          )
            throw new Error('Credential encryption round trip failed: ' + name);
        }
        plannerVaults.openrouter.clear();
        if (plannerVaults.openrouter.has() || vault.get() !== geminiProbe)
          throw new Error('Credential stores are not isolated');
        plannerVaults.groq.clear();
        vault.clear();
        const loaded = await win.webContents.executeJavaScript(
          `(async()=>{const r=await fetch('/api/projects');return r.ok&&(await r.json()).length===3&&!!document.querySelector('main')})()`,
        );
        const rig = parseSubjectRig(
          '<svg viewBox="0 0 40 30"><defs><g id="subject-main"><path d="M0 8 Q15 0 28 9 L11 20Z" fill="#fca"/><circle cx="20" cy="9" r="3"/></g></defs></svg>',
        );
        const flat = parseStage(
          '<svg viewBox="0 0 200 320"><rect width="200" height="320" fill="#456789"/>' +
            [0, 1]
              .map(
                (i) =>
                  `<use x="${i * 70}" y="80" href="#subject-main" data-anim="move" data-dx="35"/>`,
              )
              .join('') +
            [0, 1, 2]
              .map((i) => `<circle cx="${15 + i * 45}" cy="20" r="4" data-anim="fall"/>`)
              .join('') +
            '</svg>',
          rig.root,
        );
        if (flat.actors !== 5 || flat.objects !== 5)
          throw Error('Installed object compositor input failed validation');
        if (!loaded) throw new Error('Installed renderer or SQLite unavailable');
        const r = await fetch(origin + '/api/settings/checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-studio-session': token },
          body: '{}',
        });
        const checks = await r.json();
        if (
          !checks.find((x) => x.id === 'ffmpeg')?.ok ||
          !checks.find((x) => x.id === 'remotion')?.ok
        )
          throw new Error('Native media check: ' + JSON.stringify(checks));
        fs.writeFileSync(
          path.join(os.tmpdir(), 'Nedenmis-install-report.json'),
          JSON.stringify(
            {
              installed: app.isPackaged,
              renderer: true,
              sqlite: true,
              fixedMotionStage: { actors: flat.actors, objects: flat.objects },
              secureStorage: true,
              plannerSecureStorage: true,
              checks,
            },
            null,
            2,
          ),
        );
        app.quit();
      }
    })
    .catch((e) => {
      if (verify) {
        fs.writeFileSync(
          path.join(os.tmpdir(), 'Nedenmis-install-report.json'),
          JSON.stringify({ error: e.message }),
        );
        app.exit(1);
      } else {
        dialog.showErrorBox(
          'Stüdyo başlatılamadı',
          'Yerel veri dizinini ve güvenli kimlik deposunu kontrol edin.',
        );
        app.quit();
      }
    });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (e) => {
    const pending = stopActive?.();
    if (!pending) {
      server?.close();
      return;
    }
    e.preventDefault();
    if (!draining) {
      draining = true;
      server?.close();
      void pending.then(() => app.quit());
    }
  });
}
