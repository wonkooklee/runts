const path = require('node:path');
const { utilityProcess } = require('electron');
const { transform } = require('./transform');

const WORKER = path.join(__dirname, 'worker.js');
const FLUSH_MS = 30;

class Runner {
  constructor({ send }) {
    this.send = send;
    this.runId = 0;
    this.child = null;
    this.spare = null;
    this.queue = [];
    this.flushTimer = null;
    this.lastLine = 1;
    this.warmUp();
  }

  spawn() {
    const child = utilityProcess.fork(WORKER, [], { serviceName: 'RunTS Runner', stdio: 'pipe' });
    child.ready = new Promise((resolve) => {
      const onReady = (m) => {
        if (m && m.type === 'ready') {
          child.removeListener('message', onReady);
          resolve();
        }
      };
      child.on('message', onReady);
    });
    return child;
  }

  warmUp() {
    if (!this.spare) this.spare = this.spawn();
  }

  push(item) {
    this.queue.push(item);
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), FLUSH_MS);
  }

  flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.queue.length) return;
    this.send('run:output', { runId: this.runId, items: this.queue });
    this.queue = [];
  }

  async run({ code, lang, cwd, packagesDir, env, filePath, showUndefined, inspectDepth }) {
    this.stop();
    const runId = ++this.runId;
    this.lastLine = 1;
    this.send('run:start', { runId });

    const t = transform(code, lang);
    if (t.diagnostics.length) {
      for (const d of t.diagnostics) this.push({ line: d.line, kind: 'error', text: `SyntaxError: ${d.message}` });
      this.flush();
      this.send('run:done', { runId, ms: null, syntaxError: true });
      return;
    }

    const child = this.spare || this.spawn();
    this.spare = null;
    this.child = child;
    const current = () => runId === this.runId && this.child === child;

    child.on('message', (m) => {
      if (!current()) return;
      if (m.type === 'output') {
        this.lastLine = m.line;
        this.push({ line: m.line, kind: m.kind, text: m.text });
      } else if (m.type === 'done') {
        this.flush();
        this.send('run:done', { runId, ms: m.ms });
      }
    });
    const pipe = (stream, kind) =>
      stream &&
      stream.on('data', (chunk) => {
        if (!current()) return;
        const text = chunk.toString().replace(/\n$/, '');
        if (text) this.push({ line: this.lastLine, kind, text });
      });
    pipe(child.stdout, 'log');
    pipe(child.stderr, 'error');
    child.on('exit', (exitCode) => {
      if (!current()) return;
      this.flush();
      this.child = null;
      if (exitCode) this.send('run:exit', { runId, exitCode });
    });

    await child.ready;
    if (!current()) return;
    child.postMessage({
      type: 'run',
      code: t.code,
      sourceMap: t.sourceMap,
      cwd,
      packagesDir,
      env,
      filePath,
      showUndefined,
      inspectDepth,
    });
    setTimeout(() => this.warmUp(), 0);
  }

  stop() {
    this.flush();
    if (this.child) {
      this.child.kill();
      this.child = null;
      return true;
    }
    return false;
  }

  dispose() {
    this.stop();
    if (this.spare) this.spare.kill();
    this.spare = null;
  }
}

module.exports = { Runner };
