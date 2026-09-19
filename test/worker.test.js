const test = require('node:test');
const assert = require('node:assert');
const { runCode } = require('./helpers');

const at = (outputs, line) => outputs.filter((o) => o.line === line).map((o) => o.text);

test('표현식 결과를 해당 줄에 낸다', async () => {
  const { outputs } = await runCode("const a = [1, 2]\na.map(x => x * 2)\n'hi'");
  assert.deepStrictEqual(at(outputs, 2), ['[ 2, 4 ]']);
  assert.deepStrictEqual(at(outputs, 3), ["'hi'"]);
});

test('undefined 결과는 기본으로 숨긴다', async () => {
  const { outputs } = await runCode('const f = () => {}\nf()');
  assert.deepStrictEqual(outputs, []);
});

test('반복문 안 console.log 를 호출 줄에 모은다', async () => {
  const { outputs } = await runCode('for (let i = 0; i < 3; i++) {\n  console.log(i)\n}');
  assert.deepStrictEqual(at(outputs, 2), ['0', '1', '2']);
});

test('console.warn/error 의 종류를 구분한다', async () => {
  const { outputs } = await runCode("console.warn('w')\nconsole.error('e')");
  assert.deepStrictEqual(outputs.map((o) => o.kind), ['warn', 'error']);
});

test('런타임 오류를 원래 줄에 표시한다 (TS)', async () => {
  const { outputs } = await runCode("type A = { x: number }\n\nconst a: any = null\na.x", { lang: 'typescript' });
  const err = outputs.find((o) => o.kind === 'error');
  assert.strictEqual(err.line, 4);
  assert.match(err.text, /TypeError/);
});

test('최상위 await 와 Promise 결과를 푼다', async () => {
  const { outputs } = await runCode('const v = await Promise.resolve(3)\nv\nPromise.resolve(5)');
  assert.deepStrictEqual(at(outputs, 2), ['3']);
  assert.deepStrictEqual(at(outputs, 3), ['5']);
});

test('타이머 안의 출력도 줄을 찾는다', async () => {
  const { outputs } = await runCode("setTimeout(() => {\n  console.log('later')\n}, 10)", { settleMs: 200 });
  assert.deepStrictEqual(at(outputs, 2), ['later']);
});

test('console 을 우회한 호출도 스택에서 줄을 찾는다', async () => {
  const { outputs } = await runCode("const log = console.log\n\nlog('via alias')");
  assert.deepStrictEqual(at(outputs, 3), ['via alias']);
});

test('Node 내장 모듈을 require/import 할 수 있다', async () => {
  const { outputs } = await runCode("import path from 'node:path'\npath.join('a', 'b')", { lang: 'typescript' });
  assert.deepStrictEqual(at(outputs, 2), ["'a/b'"]);
});

test('설정한 환경 변수를 주입한다', async () => {
  const { outputs } = await runCode('process.env.RUNTS_TEST', { env: { RUNTS_TEST: 'ok' } });
  assert.deepStrictEqual(at(outputs, 1), ["'ok'"]);
});
