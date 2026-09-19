const test = require('node:test');
const assert = require('node:assert');
const { transform } = require('../src/main/transform');

test('최상위 표현식을 줄 번호와 함께 감싼다', () => {
  const { code } = transform('const a = 1\n\na + 1', 'javascript');
  assert.match(code, /__runts_result\(3, a \+ 1\)/);
});

test('중첩된 console 호출도 줄 번호를 붙인다', () => {
  const { code } = transform('for (const x of [1]) {\n  console.log(x)\n}', 'javascript');
  assert.match(code, /__runts_console\(2, "log", x\)/);
});

test('TypeScript 타입을 지운다', () => {
  const { code, diagnostics } = transform('const n: number = 1\nn', 'typescript');
  assert.deepStrictEqual(diagnostics, []);
  assert.doesNotMatch(code, /: number/);
});

test('구문 오류를 줄 번호와 함께 보고한다', () => {
  const { diagnostics } = transform('const a = 1\nconst = 2', 'javascript');
  assert.strictEqual(diagnostics[0].line, 2);
});

test('import 를 require 로 바꾼다', () => {
  const { code } = transform("import fs from 'node:fs'\nfs.existsSync('/')", 'typescript');
  assert.match(code, /require\("node:fs"\)/);
});
