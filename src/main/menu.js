const { Menu, app } = require('electron');

function buildMenu({ send, getWindow, createWindow }) {
  const cmd = (command) => () => {
    if (!getWindow()) createWindow();
    send('menu', command);
  };

  const tabShortcuts = Array.from({ length: 9 }, (_, i) => ({
    label: `탭 ${i + 1}`,
    accelerator: `CmdOrCtrl+${i + 1}`,
    click: cmd(`selectTab:${i}`),
    visible: false,
  }));

  return Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about', label: 'RunTS 정보' },
        { type: 'separator' },
        { label: '설정…', accelerator: 'CmdOrCtrl+,', click: cmd('settings') },
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
      label: '파일',
      submenu: [
        { label: '새 탭', accelerator: 'CmdOrCtrl+T', click: cmd('newTab') },
        { label: '새 JavaScript 탭', accelerator: 'CmdOrCtrl+Shift+J', click: cmd('newTab:javascript') },
        { label: '새 TypeScript 탭', accelerator: 'CmdOrCtrl+Shift+T', click: cmd('newTab:typescript') },
        { type: 'separator' },
        { label: '열기…', accelerator: 'CmdOrCtrl+O', click: cmd('open') },
        { label: '저장', accelerator: 'CmdOrCtrl+S', click: cmd('save') },
        { label: '다른 이름으로 저장…', accelerator: 'CmdOrCtrl+Shift+S', click: cmd('saveAs') },
        { type: 'separator' },
        { label: '탭 닫기', accelerator: 'CmdOrCtrl+W', click: cmd('closeTab') },
      ],
    },
    {
      label: '편집',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: '코드 정렬', accelerator: 'Shift+Alt+F', click: cmd('format') },
      ],
    },
    {
      label: '실행',
      submenu: [
        { label: '실행', accelerator: 'CmdOrCtrl+R', click: cmd('run') },
        { label: '중지', accelerator: 'CmdOrCtrl+.', click: cmd('stop') },
        { type: 'separator' },
        { label: '자동 실행 켜기/끄기', accelerator: 'CmdOrCtrl+Shift+R', click: cmd('toggleAutoRun') },
        { label: '출력 지우기', accelerator: 'CmdOrCtrl+K', click: cmd('clearOutput') },
        { type: 'separator' },
        { label: 'JavaScript ↔ TypeScript', accelerator: 'CmdOrCtrl+Shift+L', click: cmd('toggleLang') },
        { label: 'npm 패키지…', accelerator: 'CmdOrCtrl+Shift+P', click: cmd('packages') },
      ],
    },
    {
      label: '보기',
      submenu: [
        { label: '좌우/상하 배치 전환', accelerator: 'CmdOrCtrl+\\', click: cmd('toggleLayout') },
        { label: '글자 키우기', accelerator: 'CmdOrCtrl+=', click: cmd('fontUp') },
        { label: '글자 줄이기', accelerator: 'CmdOrCtrl+-', click: cmd('fontDown') },
        { label: '글자 크기 초기화', accelerator: 'CmdOrCtrl+0', click: cmd('fontReset') },
        { type: 'separator' },
        { label: '다음 탭', accelerator: 'Ctrl+Tab', click: cmd('nextTab') },
        { label: '이전 탭', accelerator: 'Ctrl+Shift+Tab', click: cmd('prevTab') },
        ...tabShortcuts,
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu', label: '윈도우' },
  ]);
}

module.exports = { buildMenu };
