const $ = (id) => document.getElementById(id);

export function setupDialogs({ api, getSettings, onSettingsChange, onPackagesChanged, onClose }) {
  const backdrop = $('modal-backdrop');
  const modals = { packages: $('packages-modal'), settings: $('settings-modal') };
  let openName = null;

  function open(name) {
    for (const [key, el] of Object.entries(modals)) el.hidden = key !== name;
    backdrop.hidden = false;
    openName = name;
  }

  function close() {
    if (!openName) return;
    backdrop.hidden = true;
    Object.values(modals).forEach((el) => (el.hidden = true));
    openName = null;
    onClose();
  }

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  document.querySelectorAll('.modal-close').forEach((btn) => btn.addEventListener('click', close));
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && openName) {
        e.preventDefault();
        close();
      }
    },
    true,
  );

  const list = $('package-list');
  const log = $('package-log');
  const input = $('install-input');
  const installBtn = $('install-btn');
  let busy = false;

  api.onPackagesLog((chunk) => {
    log.hidden = false;
    log.textContent += chunk;
    log.scrollTop = log.scrollHeight;
  });

  function setBusy(value) {
    busy = value;
    installBtn.disabled = value;
    installBtn.textContent = value ? 'Installing…' : 'Install';
    list.querySelectorAll('button').forEach((b) => (b.disabled = value));
  }

  async function refreshList() {
    const pkgs = await api.listPackages();
    list.replaceChildren(
      ...(pkgs.length
        ? pkgs.map((p) => {
            const li = document.createElement('li');
            const name = document.createElement('span');
            name.className = 'pkg-name';
            name.textContent = p.name;
            const version = document.createElement('span');
            version.className = 'pkg-version';
            version.textContent = p.version ? `v${p.version}` : 'not installed';
            const remove = document.createElement('button');
            remove.className = 'link-btn danger';
            remove.textContent = 'Remove';
            remove.disabled = busy;
            remove.addEventListener('click', () => runNpm(() => api.uninstallPackage(p.name)));
            li.append(name, version, remove);
            return li;
          })
        : [Object.assign(document.createElement('li'), { className: 'empty', textContent: 'No packages installed' })]),
    );
  }

  async function runNpm(task) {
    if (busy) return;
    setBusy(true);
    log.textContent = '';
    log.hidden = false;
    const ok = await task();
    log.textContent += ok ? '\nDone\n' : '\nFailed. See the log above.\n';
    log.scrollTop = log.scrollHeight;
    setBusy(false);
    await refreshList();
    if (ok) onPackagesChanged();
    return ok;
  }

  $('install-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const names = input.value.split(/[\s,]+/).filter(Boolean);
    if (!names.length) return;
    const ok = await runNpm(() => api.installPackages(names));
    if (ok) input.value = '';
  });
  $('reveal-packages').addEventListener('click', () => api.revealPackages());

  const form = $('settings-form');

  function fillSettings() {
    const s = getSettings();
    for (const el of form.elements) {
      if (!el.name || !(el.name in s)) continue;
      if (el.type === 'checkbox') el.checked = !!s[el.name];
      else el.value = s[el.name];
    }
  }

  const readField = (el) => {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') {
      const n = Number(el.value);
      if (!Number.isFinite(n)) return undefined;
      return Math.min(Number(el.max || n), Math.max(Number(el.min || n), n));
    }
    return el.value;
  };

  form.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.name || el.type === 'number') return;
    onSettingsChange({ [el.name]: readField(el) });
  });
  form.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.name || el.type !== 'number') return;
    const value = readField(el);
    if (value !== undefined) onSettingsChange({ [el.name]: value });
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  return {
    openPackages() {
      open('packages');
      refreshList();
      setTimeout(() => input.focus(), 0);
    },
    openSettings() {
      fillSettings();
      open('settings');
    },
    close,
    isOpen: () => openName !== null,
  };
}
