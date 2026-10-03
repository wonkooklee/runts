const test = require('node:test');
const assert = require('node:assert');
const { runCode } = require('./helpers');

const at = (outputs, line) => outputs.filter((o) => o.line === line).map((o) => o.text);

test('reports expression results on their line', async () => {
  const { outputs } = await runCode("const a = [1, 2]\na.map(x => x * 2)\n'hi'");
  assert.deepStrictEqual(at(outputs, 2), ['[ 2, 4 ]']);
  assert.deepStrictEqual(at(outputs, 3), ["'hi'"]);
});

test('hides undefined results by default', async () => {
  const { outputs } = await runCode('const f = () => {}\nf()');
  assert.deepStrictEqual(outputs, []);
});

test('groups console.log calls in a loop on the calling line', async () => {
  const { outputs } = await runCode('for (let i = 0; i < 3; i++) {\n  console.log(i)\n}');
  assert.deepStrictEqual(at(outputs, 2), ['0', '1', '2']);
});

test('distinguishes console.warn and console.error', async () => {
  const { outputs } = await runCode("console.warn('w')\nconsole.error('e')");
  assert.deepStrictEqual(outputs.map((o) => o.kind), ['warn', 'error']);
});

test('maps runtime errors back to the original TypeScript line', async () => {
  const { outputs } = await runCode("type A = { x: number }\n\nconst a: any = null\na.x", { lang: 'typescript' });
  const err = outputs.find((o) => o.kind === 'error');
  assert.strictEqual(err.line, 4);
  assert.match(err.text, /TypeError/);
});

test('supports top-level await and unwraps Promise results', async () => {
  const { outputs } = await runCode('const v = await Promise.resolve(3)\nv\nPromise.resolve(5)');
  assert.deepStrictEqual(at(outputs, 2), ['3']);
  assert.deepStrictEqual(at(outputs, 3), ['5']);
});

test('locates output from inside timers', async () => {
  const { outputs } = await runCode("setTimeout(() => {\n  console.log('later')\n}, 10)", { settleMs: 200 });
  assert.deepStrictEqual(at(outputs, 2), ['later']);
});

test('locates aliased console calls through the stack', async () => {
  const { outputs } = await runCode("const log = console.log\n\nlog('via alias')");
  assert.deepStrictEqual(at(outputs, 3), ['via alias']);
});

test('imports Node built-in modules', async () => {
  const { outputs } = await runCode("import path from 'node:path'\npath.join('a', 'b')", { lang: 'typescript' });
  assert.deepStrictEqual(at(outputs, 2), ["'a/b'"]);
});

test('injects configured environment variables', async () => {
  const { outputs } = await runCode('process.env.RUNTS_TEST', { env: { RUNTS_TEST: 'ok' } });
  assert.deepStrictEqual(at(outputs, 1), ["'ok'"]);
});
