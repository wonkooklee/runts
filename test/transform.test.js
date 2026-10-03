const test = require('node:test');
const assert = require('node:assert');
const { transform } = require('../src/main/transform');

test('wraps top-level expressions with their line number', () => {
  const { code } = transform('const a = 1\n\na + 1', 'javascript');
  assert.match(code, /__runts_result\(3, a \+ 1\)/);
});

test('tags nested console calls with their line number', () => {
  const { code } = transform('for (const x of [1]) {\n  console.log(x)\n}', 'javascript');
  assert.match(code, /__runts_console\(2, "log", x\)/);
});

test('strips TypeScript types', () => {
  const { code, diagnostics } = transform('const n: number = 1\nn', 'typescript');
  assert.deepStrictEqual(diagnostics, []);
  assert.doesNotMatch(code, /: number/);
});

test('reports syntax errors with their line number', () => {
  const { diagnostics } = transform('const a = 1\nconst = 2', 'javascript');
  assert.strictEqual(diagnostics[0].line, 2);
});

test('rewrites import to require', () => {
  const { code } = transform("import fs from 'node:fs'\nfs.existsSync('/')", 'typescript');
  assert.match(code, /require\("node:fs"\)/);
});
