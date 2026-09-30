const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel) => (fn) => {
  const listener = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('runts', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: (partial) => ipcRenderer.send('state:save', partial),
  setTheme: (theme) => ipcRenderer.send('theme:set', theme),

  run: (payload) => ipcRenderer.send('run', payload),
  stop: () => ipcRenderer.send('stop'),
  onRunStart: on('run:start'),
  onRunOutput: on('run:output'),
  onRunDone: on('run:done'),
  onRunExit: on('run:exit'),
  onRunStopped: on('run:stopped'),

  listPackages: () => ipcRenderer.invoke('packages:list'),
  packageTypes: () => ipcRenderer.invoke('packages:types'),
  installPackages: (names) => ipcRenderer.invoke('packages:install', names),
  uninstallPackage: (name) => ipcRenderer.invoke('packages:uninstall', name),
  revealPackages: () => ipcRenderer.invoke('packages:reveal'),
  onPackagesLog: on('packages:log'),

  openFile: () => ipcRenderer.invoke('file:open'),
  readDroppedFile: (file) => ipcRenderer.invoke('file:read', webUtils.getPathForFile(file)),
  saveFile: (payload) => ipcRenderer.invoke('file:save', payload),
  onFileOpened: on('file:opened'),

  onMenu: on('menu'),
});
