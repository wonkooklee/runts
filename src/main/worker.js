const vm = require('node:vm');
const path = require('node:path');
const util = require('node:util');
const { Console } = require('node:console');
const { Writable } = require('node:stream');
const { createRequire, SourceMap } = require('node:module');

const FILENAME = 'runts-input.js';
const MAX_OUTPUTS = 5000;

const port = process.parentPort;
const send = port ? (msg) => port.postMessage(msg) : (msg) => process.send(msg);
const onMessage = port
  ? (fn) => port.on('message', (e) => fn(e.data))
  : (fn) => process.on('message', fn);

let sourceMap = null;
let outputCount = 0;
let truncated = false;
let lastLine = 1;
let showUndefined = false;
let inspectOptions = { depth: 4, maxArrayLength: 100, breakLength: 80, compact: 3 };

function emit(line, kind, text) {
  if (truncated) return;
  if (++outputCount > MAX_OUTPUTS) {
    truncated = true;
    send({ type: 'output', line, kind: 'warn', text: `… 출력이 ${MAX_OUTPUTS}개를 넘어 이후 출력은 생략합니다` });
    return;
  }
  lastLine = line;
  send({ type: 'output', line, kind, text });
}

function originalLine(genLine, genColumn) {
  if (!sourceMap) return genLine;
  try {
    const entry = sourceMap.findEntry(genLine - 1, Math.max(0, genColumn - 1));
    if (entry && typeof entry.originalLine === 'number') return entry.originalLine + 1;
  } catch {}
  return genLine;
}

const FRAME_RE = new RegExp(`${FILENAME.replace('.', '\\.')}:(\\d+):(\\d+)`);
const FRAME_RE_G = new RegExp(FRAME_RE.source, 'g');

function lineFromStack(stack) {
  if (typeof stack !== 'string') return null;
  const m = stack.match(FRAME_RE);
  return m ? originalLine(Number(m[1]), Number(m[2])) : null;
}

function callerLine() {
  const holder = {};
  Error.captureStackTrace(holder, callerLine);
  return lineFromStack(holder.stack) || lastLine;
}

function cleanStack(text) {
  return text
    .split('\n')
    .filter((l) => !/^\s+at /.test(l) || FRAME_RE.test(l))
    .map((l) => l.replace(FRAME_RE_G, (_, ln, col) => `${FILENAME.replace('.js', '')}:${originalLine(Number(ln), Number(col))}`))
    .join('\n');
}

function makeSink() {
  const sink = new Writable({
    write(chunk, _enc, cb) {
      sink.buffer += chunk.toString();
      cb();
    },
  });
  sink.buffer = '';
  return sink;
}

const stdoutSink = makeSink();
const stderrSink = makeSink();
let capture = new Console({ stdout: stdoutSink, stderr: stderrSink, colorMode: false, inspectOptions });

const KIND = { warn: 'warn', error: 'error', trace: 'error', assert: 'error', info: 'info' };

function consoleCall(line, method, args) {
  const fn = typeof capture[method] === 'function' ? method : 'log';
  stdoutSink.buffer = '';
  stderrSink.buffer = '';
  capture[fn](...args);
  const text = (stdoutSink.buffer + stderrSink.buffer).replace(/\n$/, '');
  if (!stdoutSink.buffer && !stderrSink.buffer) return;
  emit(line, KIND[fn] || 'log', cleanStack(text));
}

function formatError(err) {
  if (err instanceof Error || (err && typeof err === 'object' && 'message' in err && 'stack' in err)) {
    return `${err.name || 'Error'}: ${err.message}`;
  }
  return util.inspect(err, inspectOptions);
}

function reportError(err, fallbackLine) {
  const line = (err && lineFromStack(err.stack)) || fallbackLine || lastLine;
  emit(line, 'error', `Uncaught ${formatError(err)}`);
}

function isThenable(v) {
  return v !== null && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function';
}

function result(line, value) {
  if (isThenable(value)) {
    Promise.resolve(value).then(
      (v) => {
        if (v === undefined && !showUndefined) return;
        emit(line, 'result', util.inspect(v, inspectOptions));
      },
      (err) => emit(line, 'error', `Uncaught (in promise) ${formatError(err)}`),
    );
    return value;
  }
  if (value === undefined && !showUndefined) return value;
  emit(line, 'result', util.inspect(value, inspectOptions));
  return value;
}

function installGlobalConsole() {
  const proxy = {};
  for (const key of Object.keys(Console.prototype).concat(['log', 'info', 'warn', 'error', 'debug', 'dir', 'table', 'trace', 'assert', 'count', 'countReset', 'time', 'timeEnd', 'timeLog', 'group', 'groupCollapsed', 'groupEnd', 'dirxml'])) {
    proxy[key] = function (...args) {
      consoleCall(callerLine(), key, args);
    };
  }
  globalThis.console = proxy;
}

function makeRequire(cwd, packagesDir) {
  const fromPackages = createRequire(path.join(packagesDir, '__runts__.js'));
  const fromCwd = createRequire(path.join(cwd, '__runts__.js'));
  const req = (id) => {
    try {
      return fromPackages(id);
    } catch (e) {
      if (e && e.code === 'MODULE_NOT_FOUND' && String(e.message).includes(`'${id}'`)) {
        try {
          return fromCwd(id);
        } catch (e2) {
          if (e2 && e2.code === 'MODULE_NOT_FOUND' && String(e2.message).includes(`'${id}'`)) {
            const err = new Error(`Cannot find module '${id}'. 패키지 창(⌘⇧P)에서 설치하세요.`);
            err.code = 'MODULE_NOT_FOUND';
            throw err;
          }
          throw e2;
        }
      }
      throw e;
    }
  };
  req.resolve = (id) => {
    try {
      return fromPackages.resolve(id);
    } catch {
      return fromCwd.resolve(id);
    }
  };
  req.cache = fromPackages.cache;
  return req;
}

async function run(msg) {
  showUndefined = !!msg.showUndefined;
  if (msg.inspectDepth != null) {
    inspectOptions = { ...inspectOptions, depth: msg.inspectDepth };
    capture = new Console({ stdout: stdoutSink, stderr: stderrSink, colorMode: false, inspectOptions });
  }
  sourceMap = msg.sourceMap ? new SourceMap(msg.sourceMap) : null;
  Object.assign(process.env, msg.env || {});
  try {
    process.chdir(msg.cwd);
  } catch {}
  installGlobalConsole();

  const filename = msg.filePath || path.join(msg.cwd, FILENAME);
  const mod = { exports: {}, id: '.', filename, loaded: false, children: [], paths: [] };
  const req = makeRequire(msg.cwd, msg.packagesDir);
  const wrapped = `(async function (exports, require, module, __filename, __dirname, __runts_result, __runts_console) {${msg.code}\n})`;

  const started = performance.now();
  try {
    const script = new vm.Script(wrapped, {
      filename: FILENAME,
      importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
    });
    const fn = script.runInThisContext();
    await fn.call(mod.exports, mod.exports, req, mod, filename, path.dirname(filename), result, (line, method, ...args) =>
      consoleCall(line, method, args),
    );
  } catch (err) {
    reportError(err, 1);
  }
  send({ type: 'done', ms: Math.round((performance.now() - started) * 10) / 10 });
}

process.on('uncaughtException', (err) => reportError(err));
process.on('unhandledRejection', (err) => {
  const line = (err && lineFromStack(err.stack)) || lastLine;
  emit(line, 'error', `Uncaught (in promise) ${formatError(err)}`);
});

onMessage((msg) => {
  if (msg && msg.type === 'run') run(msg);
});

send({ type: 'ready' });
