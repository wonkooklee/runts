import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist/renderer');
const watch = process.argv.includes('--watch');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'src/renderer/index.html'), join(out, 'index.html'));

const require = createRequire(import.meta.url);
const { collectDts } = require('../src/main/packages.js');
const nodeTypes = [];
for (const name of ['@types/node', 'undici-types']) {
  collectDts(dirname(require.resolve(`${name}/package.json`)), `file:///node_modules/${name}`, nodeTypes);
}
writeFileSync(join(out, 'node-types.json'), JSON.stringify(nodeTypes));

const common = {
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  loader: { '.ttf': 'file' },
  target: 'chrome140',
};

const options = [
  {
    ...common,
    entryPoints: { app: join(root, 'src/renderer/app.js') },
    outdir: out,
    format: 'iife',
  },
  {
    ...common,
    entryPoints: {
      'editor.worker': 'monaco-editor/editor/editor.worker.js',
      'ts.worker': 'monaco-editor/language/typescript/ts.worker.js',
    },
    outdir: out,
    format: 'iife',
  },
];

if (watch) {
  for (const o of options) await (await context(o)).watch();
} else {
  await Promise.all(options.map((o) => build(o)));
}
