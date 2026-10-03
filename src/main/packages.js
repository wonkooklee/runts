const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const NAME_RE = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(@[\w.^~<>=*|+ -]+)?$/i;
const TYPES_LIMIT = 8 * 1024 * 1024;

class Packages {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    const manifest = path.join(dir, 'package.json');
    if (!fs.existsSync(manifest)) {
      fs.writeFileSync(manifest, JSON.stringify({ name: 'runts-packages', private: true, dependencies: {} }, null, 2));
    }
  }

  readJson(file) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  list() {
    const deps = (this.readJson(path.join(this.dir, 'package.json')) || {}).dependencies || {};
    return Object.keys(deps)
      .sort()
      .map((name) => {
        const pkg = this.readJson(path.join(this.dir, 'node_modules', name, 'package.json'));
        return { name, range: deps[name], version: pkg ? pkg.version : null };
      });
  }

  npm(args, onLog) {
    return new Promise((resolve) => {
      const script = 'cd "$RUNTS_PKG_DIR" && npm "$@" --no-fund --no-audit --no-progress';
      const child = spawn('/bin/zsh', ['-lc', script, 'runts', ...args], {
        env: { ...process.env, RUNTS_PKG_DIR: this.dir },
      });
      const forward = (chunk) => onLog(chunk.toString());
      child.stdout.on('data', forward);
      child.stderr.on('data', forward);
      child.on('error', (err) => {
        onLog(`${err.message}\n`);
        resolve(false);
      });
      child.on('close', (code) => resolve(code === 0));
    });
  }

  async install(names, onLog) {
    const valid = names.map((n) => n.trim()).filter(Boolean);
    const invalid = valid.filter((n) => !NAME_RE.test(n));
    if (invalid.length) {
      onLog(`Invalid package name: ${invalid.join(', ')}\n`);
      return false;
    }
    if (!valid.length) return false;
    onLog(`$ npm install ${valid.join(' ')}\n`);
    return this.npm(['install', ...valid], onLog);
  }

  async uninstall(name, onLog) {
    if (!NAME_RE.test(name)) return false;
    onLog(`$ npm uninstall ${name}\n`);
    return this.npm(['uninstall', name], onLog);
  }

  typeFiles() {
    const libs = [];
    let total = 0;
    const nodeModules = path.join(this.dir, 'node_modules');
    const names = new Set(this.list().map((p) => p.name));
    for (const name of [...names]) {
      if (!name.startsWith('@types/')) names.add(`@types/${name.replace(/^@/, '').replace('/', '__')}`);
    }
    for (const name of names) {
      const root = path.join(nodeModules, name);
      if (!fs.existsSync(root)) continue;
      total = collectDts(root, `file:///node_modules/${name}`, libs, total);
      if (total > TYPES_LIMIT) break;
    }
    return libs;
  }
}

function collectDts(root, virtualRoot, libs, total = 0) {
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (total > TYPES_LIMIT) return;
      const abs = path.join(dir, entry.name);
      const virtual = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) walk(abs, virtual);
      } else if (/\.d\.(c|m)?ts$/.test(entry.name) || (entry.name === 'package.json' && dir === root)) {
        const content = fs.readFileSync(abs, 'utf8');
        total += content.length;
        libs.push({ path: virtual, content });
      }
    }
  };
  walk(root, virtualRoot);
  return total;
}

module.exports = { Packages, collectDts };
