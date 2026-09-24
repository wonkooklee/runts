import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === 'typescript' || label === 'javascript') return new Worker('./ts.worker.js');
    return new Worker('./editor.worker.js');
  },
};

const tsApi = monaco.typescript || monaco.languages.typescript;

const IGNORED_DIAGNOSTICS = [1375, 1378, 2307, 2792, 7016, 80001, 80005];

function configureLanguages() {
  const compilerOptions = {
    target: tsApi.ScriptTarget.ESNext,
    module: tsApi.ModuleKind.ESNext,
    moduleResolution: tsApi.ModuleResolutionKind.NodeJs,
    moduleDetection: 3,
    lib: ['esnext'],
    allowJs: true,
    checkJs: false,
    strict: false,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    allowNonTsExtensions: true,
    experimentalDecorators: true,
    jsx: tsApi.JsxEmit.React,
  };
  for (const defaults of [tsApi.typescriptDefaults, tsApi.javascriptDefaults]) {
    defaults.setCompilerOptions(compilerOptions);
    defaults.setDiagnosticsOptions({ diagnosticCodesToIgnore: IGNORED_DIAGNOSTICS });
    defaults.setEagerModelSync(true);
  }
}

let typeDisposables = [];

export function setTypeLibs(libs) {
  typeDisposables.forEach((d) => d.dispose());
  typeDisposables = [];
  for (const { path, content } of libs) {
    typeDisposables.push(tsApi.typescriptDefaults.addExtraLib(content, path));
    typeDisposables.push(tsApi.javascriptDefaults.addExtraLib(content, path));
  }
}

function registerOutputLanguage() {
  monaco.languages.register({ id: 'runts-output' });
  monaco.languages.setMonarchTokensProvider('runts-output', {
    tokenizer: {
      root: [
        [/^Uncaught.*$/, 'invalid'],
        [/^SyntaxError:.*$/, 'invalid'],
        [/'(?:[^'\\]|\\.)*'/, 'string'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/`(?:[^`\\]|\\.)*`/, 'string'],
        [/\[(?:Function|class|AsyncFunction|GeneratorFunction|AsyncGeneratorFunction)[^\]]*\]/, 'type'],
        [/\b(?:true|false|null|undefined|NaN|Infinity)\b/, 'keyword'],
        [/-?\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?n?\b/i, 'number'],
        [/\b[A-Z][\w$]*(?=\s*(?:\(\d+\))?\s*[{[]|\s*\[)/, 'type'],
        [/<[a-z ]+>/, 'comment'],
        [/[{}[\]()]/, '@brackets'],
        [/[\w$]+(?=:)/, 'variable'],
      ],
    },
  });
}

function defineThemes() {
  monaco.editor.defineTheme('runts-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'invalid', foreground: 'f47174' },
      { token: 'variable', foreground: '9cdcfe' },
    ],
    colors: {
      'editor.background': '#1b1d23',
      'editor.lineHighlightBackground': '#ffffff08',
      'editorLineNumber.foreground': '#4b5263',
      'editorGutter.background': '#1b1d23',
    },
  });
  monaco.editor.defineTheme('runts-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'invalid', foreground: 'd1242f' },
      { token: 'variable', foreground: '0550ae' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.lineHighlightBackground': '#00000006',
      'editorLineNumber.foreground': '#b0b4ba',
    },
  });
}

configureLanguages();
registerOutputLanguage();
defineThemes();

export { monaco, tsApi };
