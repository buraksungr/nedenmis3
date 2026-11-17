const { app, BrowserWindow, safeStorage, session, shell, dialog } = require('electron');
const express = require('express');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { randomBytes } = require('node:crypto');
let win, server;
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
      const { createStudio } = require('../build/server.cjs');
      const state = app.getPath('userData'),
        secret = path.join(state, 'gemini.credential');
      const resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
      const vault = {
        mode: 'encrypted',
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
      const token = randomBytes(32).toString('hex'),
        studio = createStudio(
          {
            root: path.join(scratch || app.getPath('documents'), 'NedenmisStudio'),
            pythonDir: path.join(resources, 'python'),
            composition: path.join(resources, app.isPackaged ? 'composition' : 'build/composition'),
          },
          { vault, desktopToken: token },
        );
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
      session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [origin + '/*'] }, (d, cb) => {
        d.requestHeaders['x-studio-session'] = token;
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
        const probe = randomBytes(26).toString('hex');
        vault.set(probe);
        if (vault.get() !== probe || fs.readFileSync(secret).includes(probe))
          throw new Error('Credential encryption round trip failed');
        vault.clear();
        const loaded = await win.webContents.executeJavaScript(
          `(async()=>{const r=await fetch('/api/projects');return r.ok&&(await r.json()).length===3&&!!document.querySelector('main')})()`,
        );
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
              secureStorage: true,
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
  app.on('before-quit', () => server?.close());
}
