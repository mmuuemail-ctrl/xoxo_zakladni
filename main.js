const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store({ name: 'xoxo-store' });

const TRIAL_DAYS = 7;
const STORE_KEYS = {
  firstRunAt: 'firstRunAt',
  licenseKey: 'licenseKey',
  items: 'items',         // [{name, note, url, selector, lastValue}]
  autoIntervalSec: 'autoIntervalSec'
};

function isTrialValid() {
  const license = store.get(STORE_KEYS.licenseKey, "");
  if (license && typeof license === 'string' && license.trim().length >= 12) return true;

  let first = store.get(STORE_KEYS.firstRunAt, null);
  if (!first) {
    first = Date.now();
    store.set(STORE_KEYS.firstRunAt, first);
  }
  const days = (Date.now() - first) / (1000 * 60 * 60 * 24);
  return days <= TRIAL_DAYS;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
      webviewTag: true
    },
    title: 'xoxo'
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// IPC
ipcMain.handle('get-state', async () => {
  return {
    licenseOk: isTrialValid(),
    daysLeft: (() => {
      const license = store.get(STORE_KEYS.licenseKey, "");
      if (license && license.trim().length >= 12) return 9999;
      const first = store.get(STORE_KEYS.firstRunAt, Date.now());
      const left = TRIAL_DAYS - ((Date.now() - first) / (1000 * 60 * 60 * 24));
      return Math.max(0, Math.ceil(left));
    })(),
    items: store.get(STORE_KEYS.items, []),
    autoIntervalSec: store.get(STORE_KEYS.autoIntervalSec, 0),
  };
});

ipcMain.handle('save-items', async (e, items) => {
  store.set(STORE_KEYS.items, items);
  return true;
});

ipcMain.handle('set-interval', async (e, seconds) => {
  store.set(STORE_KEYS.autoIntervalSec, Number(seconds || 0));
  return true;
});

ipcMain.handle('set-license', async (e, key) => {
  store.set(STORE_KEYS.licenseKey, (key || "").trim());
  return { ok: isTrialValid() };
});

ipcMain.handle('export-csv', async (e, items) => {
  try {
    const res = await dialog.showSaveDialog({
      title: 'Export CSV',
      defaultPath: 'xoxo_export.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (res.canceled) return { ok: false };
    const p = res.filePath;
    const rows = [['Nazev', 'Poznamka', 'Hodnota', 'URL', 'Selector']];
    for (const it of items) {
      rows.push([it.name || '', it.note || '', it.lastValue || '', it.url || '', it.selector || '']);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    fs.writeFileSync(p, csv, 'utf8');
    return { ok: true, path: p };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// --- nový browser ---
ipcMain.on("open-url-in-window", (event, url) => {
  let child = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webviewTag: true,
      partition: 'nopersist:browser'   // ✅ žádná cache, opraví chyby s diskem
    }
  });

  child.loadFile(path.join(__dirname, "browser.html"));

  child.webContents.on("did-finish-load", () => {
    child.webContents.send("start-url", url);
  });
});
