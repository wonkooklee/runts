import './style.css';
import { monaco, setTypeLibs } from './monaco-setup.js';
import { layoutOutput } from './output.js';
import { setupDialogs } from './dialogs.js';

const api = window.runts;
const $ = (id) => document.getElementById(id);

const LANG_LABEL = { typescript: 'TypeScript', javascript: 'JavaScript' };
const LANG_SHORT = { typescript: 'TS', javascript: 'JS' };
const FONT_FAMILY = "'SF Mono', Menlo, Monaco, 'D2Coding', monospace";
const DEFAULT_FONT_SIZE = 14;

let settings;
let tabs = [];
let activeId = null;
const models = new Map();
const viewStates = new Map();
const outputs = new Map();

let currentRunId = 0;
let runTabId = null;
let running = false;
let pendingClear = false;
let clearTimer = null;
let autoRunTimer = null;
let saveTimer = null;
let renderQueued = false;

const active = () => tabs.find((t) => t.id === activeId);
const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function lineHeight() {
  return Math.round(settings.fontSize * 1.6);
}

function sharedOptions() {
  return {
    fontSize: settings.fontSize,
    lineHeight: lineHeight(),
    fontFamily: FONT_FAMILY,
    padding: { top: 12, bottom: 12 },
    scrollBeyondLastLine: true,
    automaticLayout: true,
    stickyScroll: { enabled: false },
    minimap: { enabled: settings.minimap },
    wordWrap: settings.wordWrap ? 'on' : 'off',
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
    overviewRulerBorder: false,
    editContext: false,
  };
}

let editorInstance;
let outEditor;
let outModel;
let outDecorations;

function createEditors() {
  editorInstance = monaco.editor.create($('editor-pane'), {
    ...sharedOptions(),
    model: null,
    lineNumbers: settings.lineNumbers ? 'on' : 'off',
    tabSize: 2,
    renderLineHighlight: 'line',
    fixedOverflowWidgets: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: false, indentation: true },
    suggest: { showStatusBar: false },
    quickSuggestionsDelay: 50,
  });

  outModel = monaco.editor.createModel('', 'runts-output');
  outEditor = monaco.editor.create($('output-pane'), {
    ...sharedOptions(),
    model: outModel,
    readOnly: true,
    domReadOnly: true,
    lineNumbers: 'off',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 16,
    lineNumbersMinChars: 0,
    renderLineHighlight: 'none',
    matchBrackets: 'never',
    occurrencesHighlight: 'off',
    selectionHighlight: false,
    guides: { indentation: false },
    hideCursorInOverviewRuler: true,
    overviewRulerLanes: 0,
    contextmenu: false,
    readOnlyMessage: { value: '출력 영역은 편집할 수 없습니다' },
  });
  outDecorations = outEditor.createDecorationsCollection([]);

  let syncing = false;
  const sync = (from, to) =>
    from.onDidScrollChange((e) => {
      if (!settings.alignResults || syncing || !e.scrollTopChanged) return;
      syncing = true;
      to.setScrollTop(e.scrollTop);
      syncing = false;
    });
  sync(editorInstance, outEditor);
  sync(outEditor, editorInstance);

  editorInstance.onDidChangeModelContent(() => {
    const tab = active();
    if (!tab) return;
    tab.code = editorInstance.getValue();
    if (tab.filePath && tab.saved) {
      tab.saved = false;
      renderTabs();
    }
    scheduleSave();
    if (settings.autoRun) {
      clearTimeout(autoRunTimer);
      autoRunTimer = setTimeout(run, settings.autoRunDelay);
    }
  });

  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);
}

function modelUri(tab) {
  return monaco.Uri.parse(`file:///tabs/${tab.id}.${tab.lang === 'typescript' ? 'ts' : 'js'}`);
}

function modelFor(tab) {
  let model = models.get(tab.id);
  if (model && model.getLanguageId() !== tab.lang) {
    model.dispose();
    model = null;
  }
  if (!model) {
    model = monaco.editor.createModel(tab.code, tab.lang, modelUri(tab));
    models.set(tab.id, model);
  }
  return model;
}

function selectTab(id, { runNow = true } = {}) {
  const prev = active();
  if (prev && models.has(prev.id)) viewStates.set(prev.id, editorInstance.saveViewState());
  activeId = id;
  const tab = active();
  editorInstance.setModel(modelFor(tab));
  const view = viewStates.get(id);
  if (view) editorInstance.restoreViewState(view);
  editorInstance.focus();
  renderTabs();
  updateLangButton();
  queueRender();
  scheduleSave();
  if (runNow && settings.autoRun) run();
}

function newTab({ lang, name, code = '', filePath = null } = {}) {
  const tab = {
    id: uid(),
    name: name || nextUntitled(),
    lang: lang || (active() ? active().lang : 'typescript'),
    code,
    filePath,
    saved: !!filePath,
  };
  const index = tabs.findIndex((t) => t.id === activeId);
  tabs.splice(index + 1, 0, tab);
  selectTab(tab.id);
  return tab;
}

function nextUntitled() {
  const used = new Set(tabs.map((t) => t.name));
  if (!used.has('Untitled')) return 'Untitled';
  let n = 2;
  while (used.has(`Untitled ${n}`)) n++;
  return `Untitled ${n}`;
}

function closeTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  const unsavedFile = tab.filePath && !tab.saved;
  const scratch = !tab.filePath && tab.code.trim();
  if ((unsavedFile || scratch) && !window.confirm(`'${tab.name}' 탭을 닫을까요? 저장하지 않은 내용은 사라집니다.`)) return;
  const index = tabs.indexOf(tab);
  tabs.splice(index, 1);
  models.get(id)?.dispose();
  models.delete(id);
  viewStates.delete(id);
  outputs.delete(id);
  if (!tabs.length) {
    activeId = null;
    newTab({ lang: tab.lang });
    return;
  }
  if (activeId === id) selectTab(tabs[Math.min(index, tabs.length - 1)].id);
  else renderTabs();
  scheduleSave();
}

function renameTab(id, el) {
  const tab = tabs.find((t) => t.id === id);
  const input = document.createElement('input');
  input.className = 'tab-rename';
  input.value = tab.name;
  input.spellcheck = false;
  el.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (commit && value) tab.name = value;
    renderTabs();
    scheduleSave();
    editorInstance.focus();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
    e.stopPropagation();
  });
  input.addEventListener('blur', () => finish(true));
}

let dragId = null;

function renderTabs() {
  const container = $('tabs');
  container.replaceChildren(
    ...tabs.map((tab) => {
      const el = document.createElement('div');
      el.className = `tab${tab.id === activeId ? ' active' : ''}`;
      el.role = 'tab';
      el.draggable = true;
      el.title = tab.filePath || tab.name;

      const lang = document.createElement('span');
      lang.className = `tab-lang ${tab.lang}`;
      lang.textContent = LANG_SHORT[tab.lang];
      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = tab.name;
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.textContent = tab.filePath && !tab.saved ? '●' : '×';
      close.title = '탭 닫기 (⌘W)';

      el.append(lang, name, close);
      el.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          closeTab(tab.id);
        } else if (e.button === 0 && e.target !== close && tab.id !== activeId) {
          selectTab(tab.id);
        }
      });
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });
      name.addEventListener('dblclick', () => renameTab(tab.id, name));
      el.addEventListener('dragstart', (e) => {
        dragId = tab.id;
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragover', (e) => {
        if (!dragId) return;
        e.preventDefault();
        el.classList.add('drop-target');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragId || dragId === tab.id) return;
        const from = tabs.findIndex((t) => t.id === dragId);
        const [moved] = tabs.splice(from, 1);
        tabs.splice(tabs.indexOf(tab), 0, moved);
        dragId = null;
        renderTabs();
        scheduleSave();
      });
      el.addEventListener('dragend', () => {
        dragId = null;
      });
      return el;
    }),
  );
  container.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function updateLangButton() {
  const tab = active();
  $('lang-btn').textContent = tab ? LANG_LABEL[tab.lang] : '';
}

function setLang(lang) {
  const tab = active();
  if (!tab || tab.lang === lang) return;
  viewStates.set(tab.id, editorInstance.saveViewState());
  tab.lang = lang;
  selectTab(tab.id);
}

function run() {
  clearTimeout(autoRunTimer);
  const tab = active();
  if (!tab) return;
  runTabId = tab.id;
  api.run({ code: editorInstance.getValue(), lang: tab.lang, filePath: tab.filePath });
}

function stop() {
  api.stop();
}

function entriesFor(id) {
  if (!outputs.has(id)) outputs.set(id, []);
  return outputs.get(id);
}

function applyPendingClear() {
  if (!pendingClear) return;
  pendingClear = false;
  clearTimeout(clearTimer);
  outputs.set(runTabId, []);
}

function setRunning(value) {
  running = value;
  $('run-btn').hidden = value;
  $('stop-btn').hidden = !value;
}

function setStatus(text, kind = '') {
  const el = $('run-status');
  el.textContent = text;
  el.className = `status-text ${kind}`;
}

function errorCount(id) {
  return entriesFor(id).filter((e) => e.kind === 'error').length;
}

function bindRunEvents() {
  api.onRunStart(({ runId }) => {
    currentRunId = runId;
    pendingClear = true;
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      applyPendingClear();
      queueRender();
    }, 250);
    setRunning(true);
    setStatus('실행 중…', 'running');
  });

  api.onRunOutput(({ runId, items }) => {
    if (runId !== currentRunId) return;
    applyPendingClear();
    entriesFor(runTabId).push(...items);
    queueRender();
  });

  api.onRunDone(({ runId, ms, syntaxError }) => {
    if (runId !== currentRunId) return;
    applyPendingClear();
    setRunning(false);
    const errors = errorCount(runTabId);
    if (syntaxError) setStatus('구문 오류', 'error');
    else if (errors) setStatus(`오류 ${errors}개 · ${ms}ms`, 'error');
    else setStatus(`완료 · ${ms}ms`, 'ok');
    queueRender();
  });

  api.onRunExit(({ runId, exitCode }) => {
    if (runId !== currentRunId) return;
    setRunning(false);
    setStatus(`프로세스 종료 (코드 ${exitCode})`, 'error');
  });

  api.onRunStopped(() => {
    applyPendingClear();
    setRunning(false);
    setStatus('중지됨', '');
    queueRender();
  });
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderOutput();
  });
}

function renderOutput() {
  const tab = active();
  if (!tab) return;
  const entries = outputs.get(tab.id) || [];
  const { text, kinds } = layoutOutput(entries, { align: settings.alignResults });

  const sourceLines = editorInstance.getModel()?.getLineCount() || 0;
  const padded = settings.alignResults && kinds.length < sourceLines ? text + '\n'.repeat(sourceLines - Math.max(kinds.length, 1)) : text;
  if (outModel.getValue() !== padded) {
    outModel.applyEdits([{ range: outModel.getFullModelRange(), text: padded }]);
  }

  const decorations = [];
  kinds.forEach((kind, i) => {
    if (kind === 'error' || kind === 'warn' || kind === 'info') {
      decorations.push({
        range: new monaco.Range(i + 1, 1, i + 1, 1),
        options: { isWholeLine: true, className: `out-line-${kind}`, inlineClassName: `out-text-${kind}` },
      });
    }
  });
  outDecorations.set(decorations);

  if (settings.alignResults) outEditor.setScrollTop(editorInstance.getScrollTop());

  const model = models.get(tab.id);
  if (model) {
    const markers = entries
      .filter((e) => e.kind === 'error' && e.line <= model.getLineCount())
      .map((e) => ({
        severity: monaco.MarkerSeverity.Error,
        message: e.text,
        startLineNumber: e.line,
        startColumn: model.getLineFirstNonWhitespaceColumn(e.line) || 1,
        endLineNumber: e.line,
        endColumn: model.getLineMaxColumn(e.line),
      }));
    monaco.editor.setModelMarkers(model, 'runts', markers);
  }
}

function clearOutput() {
  const tab = active();
  if (!tab) return;
  outputs.set(tab.id, []);
  setStatus('');
  queueRender();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    api.saveState({
      tabs: tabs.map(({ id, name, lang, code, filePath, saved }) => ({ id, name, lang, code, filePath, saved })),
      activeId,
    });
  }, 400);
}

function resolvedDark() {
  if (settings.theme === 'dark') return true;
  if (settings.theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme() {
  const dark = resolvedDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  monaco.editor.setTheme(dark ? 'runts-dark' : 'runts-light');
}

function applyLayout() {
  const ws = $('workspace');
  ws.classList.toggle('horizontal', settings.layout !== 'vertical');
  ws.classList.toggle('vertical', settings.layout === 'vertical');
  $('editor-pane').style.flexBasis = `${settings.split * 100}%`;
  $('layout-btn').textContent = settings.layout === 'vertical' ? '⇅' : '⇆';
}

function applyEditorSettings() {
  const shared = sharedOptions();
  editorInstance.updateOptions({ ...shared, lineNumbers: settings.lineNumbers ? 'on' : 'off' });
  outEditor.updateOptions(shared);
  $('autorun-toggle').checked = settings.autoRun;
}

function updateSettings(partial) {
  settings = { ...settings, ...partial };
  api.saveState({ settings });
  if ('theme' in partial) {
    api.setTheme(settings.theme);
    applyTheme();
  }
  if ('layout' in partial || 'split' in partial) applyLayout();
  applyEditorSettings();
  if ('alignResults' in partial) queueRender();
  if (['showUndefined', 'inspectDepth', 'env'].some((k) => k in partial)) run();
}

function setupDivider() {
  const divider = $('divider');
  const ws = $('workspace');
  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = ws.getBoundingClientRect();
    const vertical = settings.layout === 'vertical';
    document.body.classList.add(vertical ? 'resizing-row' : 'resizing-col');
    const onMove = (ev) => {
      const ratio = vertical ? (ev.clientY - rect.top) / rect.height : (ev.clientX - rect.left) / rect.width;
      settings.split = Math.min(0.85, Math.max(0.15, ratio));
      applyLayout();
    };
    const onUp = () => {
      document.body.classList.remove('resizing-row', 'resizing-col');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      updateSettings({ split: settings.split });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
  divider.addEventListener('dblclick', () => updateSettings({ split: 0.5 }));
}

async function loadTypes() {
  const [nodeLibs, pkgLibs] = await Promise.all([fetch('./node-types.json').then((r) => r.json()), api.packageTypes()]);
  setTypeLibs([...nodeLibs, ...pkgLibs]);
}

async function openFiles() {
  const files = await api.openFile();
  files.forEach(openFileTab);
}

function openFileTab(file) {
  const existing = tabs.find((t) => t.filePath && t.filePath === file.filePath);
  if (existing) {
    selectTab(existing.id);
    return;
  }
  newTab({ ...file });
}

async function save(saveAs = false) {
  const tab = active();
  if (!tab) return;
  const result = await api.saveFile({ code: editorInstance.getValue(), filePath: tab.filePath, name: tab.name, lang: tab.lang, saveAs });
  if (!result) return;
  tab.filePath = result.filePath;
  tab.name = result.name;
  tab.saved = true;
  if (result.lang !== tab.lang) setLang(result.lang);
  renderTabs();
  scheduleSave();
}

function cycleTab(delta) {
  const index = tabs.findIndex((t) => t.id === activeId);
  selectTab(tabs[(index + delta + tabs.length) % tabs.length].id);
}

function bindCommands(dialogs) {
  const commands = {
    run,
    stop,
    newTab: () => newTab(),
    'newTab:javascript': () => newTab({ lang: 'javascript' }),
    'newTab:typescript': () => newTab({ lang: 'typescript' }),
    open: openFiles,
    save: () => save(false),
    saveAs: () => save(true),
    closeTab: () => (dialogs.isOpen() ? dialogs.close() : closeTab(activeId)),
    format: () => editorInstance.getAction('editor.action.formatDocument')?.run(),
    toggleAutoRun: () => updateSettings({ autoRun: !settings.autoRun }),
    clearOutput,
    toggleLang: () => setLang(active().lang === 'typescript' ? 'javascript' : 'typescript'),
    packages: () => dialogs.openPackages(),
    settings: () => dialogs.openSettings(),
    toggleLayout: () => updateSettings({ layout: settings.layout === 'vertical' ? 'horizontal' : 'vertical' }),
    fontUp: () => updateSettings({ fontSize: Math.min(32, settings.fontSize + 1) }),
    fontDown: () => updateSettings({ fontSize: Math.max(9, settings.fontSize - 1) }),
    fontReset: () => updateSettings({ fontSize: DEFAULT_FONT_SIZE }),
    nextTab: () => cycleTab(1),
    prevTab: () => cycleTab(-1),
  };

  api.onMenu((command) => {
    if (command.startsWith('selectTab:')) {
      const tab = tabs[Number(command.split(':')[1])];
      if (tab) selectTab(tab.id);
      return;
    }
    commands[command]?.();
  });

  $('run-btn').addEventListener('click', run);
  $('stop-btn').addEventListener('click', stop);
  $('new-tab').addEventListener('click', () => newTab());
  $('lang-btn').addEventListener('click', commands.toggleLang);
  $('layout-btn').addEventListener('click', commands.toggleLayout);
  $('packages-btn').addEventListener('click', commands.packages);
  $('settings-btn').addEventListener('click', commands.settings);
  $('autorun-toggle').addEventListener('change', (e) => updateSettings({ autoRun: e.target.checked }));
  $('titlebar').addEventListener('dblclick', (e) => {
    if (e.target.id === 'titlebar' || e.target.id === 'tabs') newTab();
  });

  api.onFileOpened(openFileTab);
  setupFileDrop();
}

function setupFileDrop() {
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener(
    'dragover',
    (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    },
    true,
  );
  window.addEventListener(
    'drop',
    async (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      for (const file of e.dataTransfer.files) {
        const tab = await api.readDroppedFile(file);
        if (tab) openFileTab(tab);
      }
    },
    true,
  );
}

async function main() {
  const { state, versions } = await api.getState();
  settings = { split: 0.5, ...state.settings };
  tabs = state.tabs.map((t) => ({ saved: !!t.filePath, ...t }));
  $('node-version').textContent = `Node ${versions.node}`;

  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  createEditors();
  applyLayout();
  applyEditorSettings();
  setupDivider();
  bindRunEvents();

  const dialogs = setupDialogs({
    api,
    getSettings: () => settings,
    onSettingsChange: updateSettings,
    onPackagesChanged: async () => {
      await loadTypes();
      run();
    },
    onClose: () => editorInstance.focus(),
  });
  bindCommands(dialogs);

  selectTab(state.activeId, { runNow: false });
  loadTypes();
  run();
}

main();
