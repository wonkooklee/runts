const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../src/renderer/output.js');

test('정렬 모드에서 결과를 코드 줄에 맞춘다', async () => {
  const { layoutOutput } = await load();
  const { text } = layoutOutput(
    [
      { line: 3, kind: 'result', text: '3' },
      { line: 1, kind: 'result', text: '1' },
    ],
    { align: true },
  );
  assert.strictEqual(text, '1\n\n3');
});

test('같은 줄의 여러 출력과 여러 줄 출력은 아래로 밀어낸다', async () => {
  const { layoutOutput } = await load();
  const { text, kinds } = layoutOutput(
    [
      { line: 2, kind: 'log', text: 'a' },
      { line: 2, kind: 'log', text: 'b' },
      { line: 3, kind: 'error', text: 'x' },
      { line: 5, kind: 'result', text: '{\n  a: 1\n}' },
    ],
    { align: true },
  );
  assert.strictEqual(text, '\na\nb\nx\n{\n  a: 1\n}');
  assert.deepStrictEqual(kinds, [null, 'log', 'log', 'error', 'result', 'result', 'result']);
});

test('정렬을 끄면 도착 순서대로 쌓는다', async () => {
  const { layoutOutput } = await load();
  const { text } = layoutOutput(
    [
      { line: 5, kind: 'log', text: 'first' },
      { line: 1, kind: 'log', text: 'second' },
    ],
    { align: false },
  );
  assert.strictEqual(text, 'first\nsecond');
});
