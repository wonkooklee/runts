const { fork } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { transform } = require('../src/main/transform');

const WORKER = path.join(__dirname, '../src/main/worker.js');

function runCode(code, { lang = 'javascript', settleMs = 150, ...opts } = {}) {
  const t = transform(code, lang);
  if (t.diagnostics.length) return Promise.resolve({ diagnostics: t.diagnostics, outputs: [] });
  return new Promise((resolve) => {
    const child = fork(WORKER, [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    const outputs = [];
    child.on('message', (m) => {
      if (m.type === 'ready') {
        child.send({
          type: 'run',
          code: t.code,
          sourceMap: t.sourceMap,
          cwd: os.tmpdir(),
          packagesDir: os.tmpdir(),
          ...opts,
        });
      } else if (m.type === 'output') {
        outputs.push({ line: m.line, kind: m.kind, text: m.text });
      } else if (m.type === 'done') {
        setTimeout(() => {
          child.kill();
          resolve({ diagnostics: [], outputs, ms: m.ms });
        }, settleMs);
      }
    });
  });
}

module.exports = { runCode };
