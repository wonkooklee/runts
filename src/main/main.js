const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, net, protocol, shell } = require('electron');
const { Runner } = require('./runner');
const { Packages, collectDts } = require('./packages');
const { Store, parseEnv } = require('./store');
const { buildMenu } = require('./menu');

const RENDERER_DIR = path.join(__dirname, '../../dist/renderer');
const EXT_LANG = { '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'typescript' };

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let store;
let runner;
let packages;
const pendingFiles = [];

const send = (channel, payload) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

function readFileTab(filePath) {
  return {
    name: path.basename(filePath),
    code: fs.readFileSync(filePath, 'utf8'),
    lang: EXT_LANG[path.extname(filePath)] || 'javascript',
    filePath,
  };
}

function openFiles(paths) {
  for (const p of paths) {
    try {
      const tab = readFileTab(p);
      if (win) send('file:opened', tab);
      else pendingFiles.push(tab);
    } catch (err) {
      dialog.showErrorBox('파일을 열 수 없습니다', `${p}\n${err.message}`);
    }
  }
}

function nodeTypeLibs() {
  const libs = [];
  for (const name of ['@types/node', 'undici-types']) {
    const root = path.dirname(require.resolve(`${name}/package.json`));
    collectDts(root, `file:///node_modules/${name}`, libs);
  }
  return libs;
}

function createWindow() {
  const { settings } = store.get();
  nativeTheme.themeSource = settings.theme;
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 400,
    title: 'RunTS',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 13 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('did-finish-load', () => {
    pendingFiles.splice(0).forEach((tab) => send('file:opened', tab));
  });
  win.on('closed', () => {
    win = null;
  });
  win.loadURL('app://runts/index.html');
}

function registerIpc() {
  ipcMain.handle('state:get', () => ({
    state: store.get(),
    versions: { node: process.versions.node, electron: process.versions.electron, app: app.getVersion() },
  }));
  ipcMain.on('state:save', (_e, partial) => store.save(partial));
  ipcMain.on('theme:set', (_e, theme) => {
    nativeTheme.themeSource = theme;
  });

  ipcMain.on('run', (_e, { code, lang, filePath }) => {
    const { settings } = store.get();
    runner.run({
      code,
      lang,
      filePath,
      cwd: filePath ? path.dirname(filePath) : os.homedir(),
      packagesDir: packages.dir,
      env: parseEnv(settings.env),
      showUndefined: settings.showUndefined,
      inspectDepth: settings.inspectDepth,
    });
  });
  ipcMain.on('stop', () => {
    if (runner.stop()) send('run:stopped', {});
  });

  ipcMain.handle('types:node', () => nodeTypeLibs());
  ipcMain.handle('packages:list', () => packages.list());
  ipcMain.handle('packages:types', () => packages.typeFiles());
  ipcMain.handle('packages:install', (_e, names) => packages.install(names, (s) => send('packages:log', s)));
  ipcMain.handle('packages:uninstall', (_e, name) => packages.uninstall(name, (s) => send('packages:log', s)));
  ipcMain.handle('packages:reveal', () => shell.openPath(packages.dir));

  ipcMain.handle('file:open', async () => {
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'JavaScript / TypeScript', extensions: ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx'] }],
    });
    return res.canceled ? [] : res.filePaths.map(readFileTab);
  });
  ipcMain.handle('file:save', async (_e, { code, filePath, name, lang, saveAs }) => {
    let target = filePath;
    if (!target || saveAs) {
      const ext = lang === 'typescript' ? 'ts' : 'js';
      const base = /\.[cm]?[jt]sx?$/.test(name) ? name : `${name || 'untitled'}.${ext}`;
      const res = await dialog.showSaveDialog(win, { defaultPath: path.join(os.homedir(), base) });
      if (res.canceled || !res.filePath) return null;
      target = res.filePath;
    }
    fs.writeFileSync(target, code);
    return { filePath: target, name: path.basename(target), lang: EXT_LANG[path.extname(target)] || 'javascript' };
  });
}

app.on('open-file', (e, filePath) => {
  e.preventDefault();
  openFiles([filePath]);
});

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  store = new Store(userData);
  packages = new Packages(path.join(userData, 'packages'));
  runner = new Runner({ send });

  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(RENDERER_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(RENDERER_DIR)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  registerIpc();
  Menu.setApplicationMenu(buildMenu({ send, getWindow: () => win, createWindow }));
  createWindow();

  app.on('activate', () => {
    if (!win) createWindow();
  });
});

app.on('window-all-closed', () => {
  runner.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => runner && runner.dispose());
