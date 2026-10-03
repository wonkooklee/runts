const { Menu, app } = require('electron');

function buildMenu({ send, getWindow, createWindow }) {
  const cmd = (command) => () => {
    if (!getWindow()) createWindow();
    send('menu', command);
  };

  const tabShortcuts = Array.from({ length: 9 }, (_, i) => ({
    label: `Tab ${i + 1}`,
    accelerator: `CmdOrCtrl+${i + 1}`,
    click: cmd(`selectTab:${i}`),
    visible: false,
  }));

  return Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: cmd('settings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: cmd('newTab') },
        { label: 'New JavaScript Tab', accelerator: 'CmdOrCtrl+Shift+J', click: cmd('newTab:javascript') },
        { label: 'New TypeScript Tab', accelerator: 'CmdOrCtrl+Shift+T', click: cmd('newTab:typescript') },
        { type: 'separator' },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: cmd('open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: cmd('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: cmd('saveAs') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: cmd('closeTab') },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Format Document', accelerator: 'Shift+Alt+F', click: cmd('format') },
      ],
    },
    {
      label: 'Run',
      submenu: [
        { label: 'Run', accelerator: 'CmdOrCtrl+R', click: cmd('run') },
        { label: 'Stop', accelerator: 'CmdOrCtrl+.', click: cmd('stop') },
        { type: 'separator' },
        { label: 'Toggle Auto-Run', accelerator: 'CmdOrCtrl+Shift+R', click: cmd('toggleAutoRun') },
        { label: 'Clear Output', accelerator: 'CmdOrCtrl+K', click: cmd('clearOutput') },
        { type: 'separator' },
        { label: 'JavaScript ↔ TypeScript', accelerator: 'CmdOrCtrl+Shift+L', click: cmd('toggleLang') },
        { label: 'npm Packages…', accelerator: 'CmdOrCtrl+Shift+P', click: cmd('packages') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Layout', accelerator: 'CmdOrCtrl+\\', click: cmd('toggleLayout') },
        { label: 'Increase Font Size', accelerator: 'CmdOrCtrl+=', click: cmd('fontUp') },
        { label: 'Decrease Font Size', accelerator: 'CmdOrCtrl+-', click: cmd('fontDown') },
        { label: 'Reset Font Size', accelerator: 'CmdOrCtrl+0', click: cmd('fontReset') },
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: cmd('nextTab') },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: cmd('prevTab') },
        ...tabShortcuts,
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ]);
}

module.exports = { buildMenu };
