const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = {
  theme: 'system',
  fontSize: 14,
  autoRun: true,
  autoRunDelay: 300,
  alignResults: true,
  showUndefined: false,
  wordWrap: false,
  lineNumbers: true,
  minimap: false,
  inspectDepth: 4,
  layout: 'horizontal',
  env: '',
};

const WELCOME = `// RunTS — 입력하면 바로 실행됩니다 (⌘R 수동 실행)
const greet = (name: string) => \`Hello, \${name}!\`

greet('RunTS')

const nums = [1, 2, 3, 4]
nums.map((n) => n ** 2)

for (const n of nums) {
  console.log(n)
}

await new Promise((r) => setTimeout(r, 100))
new Date().toISOString()
`;

class Store {
  constructor(dir) {
    this.file = path.join(dir, 'state.json');
    this.state = this.load();
  }

  load() {
    let saved = {};
    try {
      saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {}
    const tabs = Array.isArray(saved.tabs) && saved.tabs.length
      ? saved.tabs
      : [{ id: 't1', name: 'Untitled', lang: 'typescript', code: WELCOME, filePath: null }];
    return {
      tabs,
      activeId: tabs.some((t) => t.id === saved.activeId) ? saved.activeId : tabs[0].id,
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) },
    };
  }

  get() {
    return this.state;
  }

  save(partial) {
    this.state = { ...this.state, ...partial };
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

function parseEnv(text) {
  const env = {};
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

module.exports = { Store, parseEnv, DEFAULT_SETTINGS };
