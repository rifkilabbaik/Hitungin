const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const nf = new Intl.NumberFormat('id-ID');
const fmt = (n) => nf.format(Math.round(Number(n) || 0));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (name) => `<svg class="ic"><use href="#i-${name}"/></svg>`;
const pad = (n) => String(n).padStart(2, '0');
const DAY = 864e5;
const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

const Store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  json(k, fb) { try { return JSON.parse(this.get(k)) || fb; } catch (e) { return fb; } },
  setJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DOW = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const F = {
  num(x, d = 1) { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: d }).format(x); },
  dec(x) { return F.num(x, x >= 100 ? 0 : 1); },
  short(n) {
    const a = Math.abs(n);
    if (a >= 1e9) return F.dec(n / 1e9) + ' M';
    if (a >= 1e6) return F.dec(n / 1e6) + ' jt';
    if (a >= 1e4) return F.dec(n / 1e3) + ' rb';
    return fmt(n);
  },
  count(n) { return Math.abs(n) >= 1e5 ? F.short(n) : fmt(n); },
  rate(v) { return v >= 100 ? F.count(v) : F.num(v, 1); },
  time(t) { const d = new Date(t); return pad(d.getHours()) + '.' + pad(d.getMinutes()); },
  date(t) {
    const d = new Date(t);
    const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
    return d.getDate() + ' ' + MON[d.getMonth()] + y;
  },
  full(t) { const d = new Date(t); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); },
  day(t) {
    const t0 = sod(Date.now());
    const s = sod(t);
    if (s === t0) return 'Hari ini';
    if (s === t0 - DAY) return 'Kemarin';
    return DOW[new Date(t).getDay()] + ', ' + F.date(t);
  },
  ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' mnt lalu';
    if (sod(t) === sod(Date.now())) return 'hari ini ' + F.time(t);
    if (sod(t) === sod(Date.now()) - DAY) return 'kemarin ' + F.time(t);
    return F.date(t) + ' ' + F.time(t);
  },
  dur(ms) {
    if (ms < 60000) return Math.max(0, Math.round(ms / 1000)) + ' dtk';
    const m = Math.round(ms / 60000);
    if (m < 60) return m + ' mnt';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' jam' + (r ? ' ' + r + ' mnt' : '');
  },
  durShort(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + ' mnt';
    return F.num(m / 60, 1) + ' jam';
  },
  clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + '.' + pad(m) : pad(m)) + '.' + pad(x);
  },
  pct(x) { return F.dec(Math.abs(x) * 100) + '%'; },
  stamp(t, sec) { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + (sec ? ':' + pad(d.getSeconds()) : ''); },
  slug(s) { return String(s || 'sesi').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sesi'; },
  ymd(t) { const d = new Date(t); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
};

const Prefs = {
  load() {
    const cls = Store.json('cls', null);
    this.cls = Array.isArray(cls) && cls.length === CLASSES.length ? cls.map(Boolean) : CLASSES.map(c => c.on);
    const emp = Store.json('emp', null);
    this.emp = Array.isArray(emp) && emp.length === CLASSES.length ? emp.map(v => Math.max(0, Number(v) || 0)) : CLASSES.map(c => c.emp);
    this.model = CONFIG.MODELS[Store.get('model')] ? Store.get('model') : 'cepat';
    this.fps = CONFIG.FPS[Store.get('fps')] !== undefined ? Store.get('fps') : 'normal';
    this.thr = Math.min(80, Math.max(25, +Store.get('thr') || 45));
    this.dirs = [1, 2, 3].includes(+Store.get('dirs')) ? +Store.get('dirs') : 3;
    this.sound = Store.get('sound') !== '0';
    this.vib = Store.get('vib') !== '0';
    this.boxes = Store.get('boxes') !== '0';
    this.mode = Store.get('mode') === 'manual' ? 'manual' : 'auto';
    this.tapDir = [0, 1, 2].includes(+Store.get('tapDir')) ? +Store.get('tapDir') : 0;
    this.limit = [0, 5, 15, 30, 60].includes(+Store.get('limit')) ? +Store.get('limit') : 0;
    this.line = Store.json('line', null);
    this.proc = ['auto', 'gpu', 'cpu'].includes(Store.get('proc')) ? Store.get('proc') : 'auto';
  },
  put(k, v) {
    this[k] = v;
    if (typeof v === 'object') Store.setJson(k, v);
    else Store.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
};

const DB = {
  db: null, mem: null,
  async open() {
    if (this.db || this.mem) return;
    try {
      if (!window.indexedDB) throw new Error('no idb');
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('hitungin', 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('sessions')) r.result.createObjectStore('sessions', { keyPath: 'id' }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error('blocked'));
      });
    } catch (e) {
      this.mem = Store.json('sessions', []);
    }
  },
  run(mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction('sessions', mode);
      const r = fn(t.objectStore('sessions'));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Penyimpanan gagal'));
    });
  },
  syncMem() { Store.setJson('sessions', this.mem); },
  async all() { await this.open(); return this.mem ? this.mem.slice() : this.run('readonly', st => st.getAll()); },
  async put(s) {
    await this.open();
    const o = JSON.parse(JSON.stringify(s));
    if (this.mem) { this.mem = this.mem.filter(x => x.id !== o.id).concat([o]); this.syncMem(); return; }
    return this.run('readwrite', st => st.put(o));
  },
  async del(id) {
    await this.open();
    if (this.mem) { this.mem = this.mem.filter(x => x.id !== id); this.syncMem(); return; }
    return this.run('readwrite', st => st.delete(id));
  },
  async clear() {
    await this.open();
    if (this.mem) { this.mem = []; this.syncMem(); return; }
    return this.run('readwrite', st => st.clear());
  }
};

const STAT = new WeakMap();
const Ses = {
  dur(s, now) {
    let d = 0;
    for (const [a, b] of s.segs || []) d += Math.max(0, (b || now || Date.now()) - a);
    return d;
  },
  running(s) { const l = s && s.segs && s.segs[s.segs.length - 1]; return !!l && !l[1]; },
  name(s) { return (s.loc || '').trim() || 'Tanpa lokasi'; },
  stat(s) {
    const key = s.ev.length + ':' + (s.end || 0);
    const m = STAT.get(s);
    if (m && m.key === key) return m;
    const counts = new Array(CLASSES.length).fill(0), dir = [0, 0, 0];
    let manual = 0;
    for (const e of s.ev) { counts[e[1]]++; dir[e[2]]++; if (e[3]) manual++; }
    const o = { key, counts, dir, manual, total: s.ev.length };
    STAT.set(s, o);
    return o;
  },
  smp(counts) { return counts.reduce((a, n, i) => a + n * (Prefs.emp[i] || 0), 0); },
  perHour(n, ms) { return ms >= 60000 ? n / (ms / 36e5) : null; },
  last(s) { return s.end || (s.ev.length ? s.start + s.ev[s.ev.length - 1][0] : 0) || s.saved || s.start; },
  usesAi(s) { return s.ev.some(e => !e[3]) || s.mode === 'auto'; }
};

const Fx = {
  ac: null,
  unlock() {
    try {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ac.state === 'suspended') this.ac.resume();
    } catch (e) {}
  },
  beep(f, d = 0.12) {
    if (!this.ac) return;
    try {
      const t = this.ac.currentTime;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.ac.destination);
      o.start(t);
      o.stop(t + d + 0.02);
    } catch (e) {}
  },
  buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
};

const Wake = {
  lock: null, want: false,
  async set(on) {
    this.want = on;
    if (!('wakeLock' in navigator)) return;
    if (on && !this.lock && document.visibilityState === 'visible') {
      try {
        this.lock = await navigator.wakeLock.request('screen');
        this.lock.addEventListener('release', () => { this.lock = null; });
      } catch (e) {}
    } else if (!on && this.lock) {
      try { await this.lock.release(); } catch (e) {}
      this.lock = null;
    }
  }
};

const PERIODS = [['today', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['month', 'Bulan ini'], ['90', '90 hari'], ['all', 'Semua']];

function rangeOf(p, first) {
  const now = Date.now();
  const t0 = sod(now);
  const d = new Date(now);
  let from, pFrom, pTo;
  if (p === 'today') { from = t0; pFrom = t0 - DAY; pTo = now - DAY; }
  else if (p === 'month') {
    from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    pFrom = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    const lastPrev = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
    pTo = new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), lastPrev), d.getHours(), d.getMinutes()).getTime();
  } else if (p === 'all') { from = sod(Math.min(first || now, now)); pFrom = pTo = 0; }
  else { const n = Number(p) || 7; from = t0 - (n - 1) * DAY; pFrom = from - n * DAY; pTo = now - n * DAY; }
  return { from, to: now + 1, pFrom, pTo, days: Math.max(1, Math.round((t0 - from) / DAY) + 1) };
}

function delta(cur, prev) { return prev ? (cur - prev) / prev : null; }

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return s * p;
}

const Chart = {
  cols(el, items, opt = {}) {
    if (!items.length || !items.some(i => i.v > 0)) {
      el.innerHTML = `<div class="empty-state"><span>${ic('pulse')}</span></div>`;
      return;
    }
    const max = niceMax(Math.max(...items.map(i => i.v)));
    const peak = opt.peak ? items.reduce((a, b) => (b.v > a.v ? b : a), items[0]) : null;
    const grid = [0, .5, 1].map(f => `<i style="bottom:${f * 100}%"><b>${f ? F.short(max * f) : '0'}</b></i>`).join('');
    const bars = items.map((it, i) => {
      const h = it.v ? Math.max(2, (it.v / max) * 100) : 0;
      const cls = peak && it !== peak ? ' dim' : '';
      return `<div class="col${cls}" tabindex="0" data-v="${esc(it.tv)}" data-l="${esc(it.tl)}" style="--i:${i}"><span style="height:${h}%"></span></div>`;
    }).join('');
    const xs = items.map(it => `<b>${esc(it.x || '')}</b>`).join('');
    el.innerHTML = `<div class="cols-plot"><div class="cols-grid">${grid}</div>${bars}</div><div class="cols-x">${xs}</div>`;
  },

  spark(svg, vals) {
    if (vals.length < 2) { svg.innerHTML = ''; return; }
    const max = Math.max(...vals, 1);
    const n = vals.length - 1;
    const pts = vals.map((v, i) => [(i / n) * 100, 30 - (v / max) * 26]);
    const line = Chart.smooth(pts);
    svg.innerHTML = `<path class="area" d="${line} L100 32 L0 32 Z"/><path class="ln" d="${line}"/>`;
  },

  smooth(p) {
    const n = p.length, d = [], m = [];
    for (let i = 0; i < n - 1; i++) d[i] = (p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (!d[i]) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b;
      if (q > 9) { const t = 3 / Math.sqrt(q); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    const f = (v) => v.toFixed(2);
    let out = 'M' + f(p[0][0]) + ' ' + f(p[0][1]);
    for (let i = 0; i < n - 1; i++) {
      const h = (p[i + 1][0] - p[i][0]) / 3;
      out += ' C' + f(p[i][0] + h) + ' ' + f(p[i][1] + m[i] * h) + ' ' + f(p[i + 1][0] - h) + ' ' + f(p[i + 1][1] - m[i + 1] * h) + ' ' + f(p[i + 1][0]) + ' ' + f(p[i + 1][1]);
    }
    return out;
  },

  bars(el, items) {
    if (!items.length) { el.innerHTML = `<div class="empty-state"><span>${ic('pin')}</span></div>`; return; }
    const max = Math.max(...items.map(i => i.v), 1);
    el.innerHTML = items.map((it, i) => `
      <div class="bar-row">
        <span class="bar-rank">${i + 1}</span>
        <span class="bar-name">${esc(it.name)}</span>
        <span class="bar-val">${esc(it.tv)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(it.v / max) * 100}%;animation-delay:${i * 60}ms"></span></span>
      </div>`).join('');
  },

  // Komposisi per jenis: urutan & warna tetap per jenis, angka dan persen selalu tertulis.
  mix(el, counts, opt = {}) {
    const total = counts.reduce((a, b) => a + b, 0);
    const rows = CLASSES.map((c, i) => ({ c, i, n: counts[i] })).filter(r => r.n > 0 || (opt.show && opt.show[r.i]));
    if (!total) { el.innerHTML = `<div class="empty-state"><span>${ic('car')}</span></div>`; return; }
    const max = Math.max(...counts, 1);
    el.innerHTML = rows.map((r, k) => `
      <div class="mix-row" style="--cc:var(--c${r.i})">
        <span class="mix-ic">${ic(r.c.ic)}</span>
        <span class="mix-name">${esc(r.c.t)}</span>
        <span class="mix-val">${fmt(r.n)}<small>${total ? F.pct(r.n / total) : '0%'}</small></span>
        <span class="mix-track"><span class="mix-fill" style="width:${(r.n / max) * 100}%;animation-delay:${k * 50}ms"></span></span>
      </div>`).join('');
  }
};

class Menu {
  constructor(root, opt) {
    this.root = root; this.opt = opt; this.items = []; this.value = '';
    this.btn = $('.chip-btn', root); this.pop = $('.dd-pop', root); this.list = $('.dd-list', root);
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); this.isOpen ? this.close() : this.open(); });
    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('.dd-opt');
      if (!b) return;
      this.set(b.dataset.v);
      this.close();
      this.opt.onChange(this.value);
    });
    document.addEventListener('click', (e) => { if (this.isOpen && !root.contains(e.target)) this.close(); });
  }
  get isOpen() { return !this.pop.hidden; }
  setItems(items) { this.items = items; this.set(this.value); }
  set(v) {
    this.value = v;
    const it = this.items.find(i => i.v === v) || this.items[0];
    $('.dd-val', this.root).textContent = it ? it.t : '';
    this.root.classList.toggle('set', !!this.opt.markSet && !!v);
  }
  open() {
    Menu.closeAll();
    this.list.innerHTML = this.items.map((it, i) => `
      <button type="button" class="dd-opt${it.v === this.value ? ' sel' : ''}" role="option" data-v="${esc(it.v)}" style="--i:${i}">
        <span class="dd-ic">${ic(it.ic || this.opt.icon)}</span><span class="t">${esc(it.t)}</span><svg class="ic ck"><use href="#i-check"/></svg>
      </button>`).join('');
    this.pop.hidden = false;
    this.root.classList.add('open');
    this.btn.setAttribute('aria-expanded', 'true');
    const r = this.pop.getBoundingClientRect();
    if (r.right > innerWidth - 8) { this.pop.style.left = 'auto'; this.pop.style.right = '0'; }
  }
  close() {
    this.pop.hidden = true;
    this.pop.style.left = ''; this.pop.style.right = '';
    this.root.classList.remove('open');
    this.btn.setAttribute('aria-expanded', 'false');
  }
  static closeAll() { (App.menus || []).forEach(m => m.isOpen && m.close()); }
}

const TITLES = { home: 'Beranda', count: 'Hitung', history: 'Riwayat', places: 'Lokasi', session: '', settings: 'Pengaturan' };
const TABS = ['home', 'count', 'history', 'places', 'settings'];
const PAGE = 30;
const DIRS = ['–', 'A→B', 'B→A'];

const App = {
  view: '', base: 'home', period: Store.get('period') || '7', loc: Store.get('locFilter') || '',
  sessions: [], cur: null, hq: '', sesId: '', installEvt: null, menus: [], sheet: '', geo: null,
  camState: 'off', camErr: '',

  async init() {
    Prefs.load();
    this.mPeriod = new Menu($('#ddPeriod'), { icon: 'calendar', onChange: (v) => { this.period = v; Store.set('period', v); this.render(); } });
    this.mLoc = new Menu($('#ddLoc'), { icon: 'pin', markSet: true, onChange: (v) => { this.loc = v; Store.set('locFilter', v); this.render(); } });
    this.menus = [this.mPeriod, this.mLoc];
    this.mPeriod.setItems(PERIODS.map(p => ({ v: p[0], t: p[1] })));
    if (!PERIODS.some(p => p[0] === this.period)) this.period = '7';
    this.mPeriod.set(this.period);

    Engine.init($('#video'), $('#overlay'));
    if (Prefs.line) Engine.setLine(Prefs.line);
    this.applyEngine();
    Engine.onCount = (cls, dir) => this.addEvent(cls, dir, 0);
    Engine.onLine = (l) => { Prefs.put('line', l); if (this.cur) this.cur.line = l; };
    Engine.onSize = (w, h) => $('#stage').style.setProperty('--arn', (w / h).toFixed(4));
    Engine.onEnded = () => { if (this.cur && Ses.running(this.cur)) this.pause(); this.toast('Video selesai'); this.renderStage(); };
    Engine.onError = (e) => this.toast(e.message);
    Engine.onLineHint = () => this.lineHint(true);

    this.bind();
    this.initTip();
    this.applyTheme();
    this.buildTiles();
    this.renderSettings();

    try { this.sessions = await DB.all(); } catch (e) { this.sessions = []; this.toast('Penyimpanan tidak tersedia'); }
    this.sessions.forEach(s => { s.ev = s.ev || []; s.segs = s.segs || []; });
    this.sortSessions();
    const open = this.sessions.filter(s => !s.end).sort((a, b) => b.start - a.start);
    open.slice(1).forEach(s => this.closeStale(s));
    if (open[0]) {
      const s = open[0];
      const l = s.segs[s.segs.length - 1];
      if (l && !l[1]) { l[1] = Math.max(l[0], s.saved || Ses.last(s)); this.persist(s); }
      this.cur = s;
      this.toast('Sesi sebelumnya dilanjutkan (dijeda)');
    }
    this.refreshLocs();
    this.buildTiles();
    const want = new URLSearchParams(location.search).get('go');
    if (want) history.replaceState(null, '', location.pathname);
    this.show(this.cur ? 'count' : ['count', 'history', 'places'].includes(want) ? want : 'home', true);
    setTimeout(() => this.hideSplash(), 500);
    setInterval(() => this.tick(), 500);
  },

  closeStale(s) {
    const l = s.segs[s.segs.length - 1];
    if (l && !l[1]) l[1] = Math.max(l[0], s.saved || Ses.last(s));
    s.end = Ses.last(s);
    this.persist(s);
  },

  busy() { return !!(this.cur && Ses.running(this.cur)) || !!Engine.source; },

  bind() {
    $$('[data-go]').forEach(b => b.addEventListener('click', () => this.go(b.dataset.go)));
    $('#btnSettings').addEventListener('click', () => this.go('settings'));
    $('#btnBack').addEventListener('click', () => history.back());
    window.addEventListener('popstate', () => this.onPop());
    document.addEventListener('pointerdown', () => Fx.unlock(), { once: true });

    $$('#modeSeg button').forEach(b => b.addEventListener('click', () => this.setMode(b.dataset.mode)));
    $('#btnCam').addEventListener('click', () => this.camOn());
    $('#btnFile').addEventListener('click', () => $('#inFile').click());
    $('#inFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) this.openFile(f); });
    $('#btnCamOff').addEventListener('click', () => this.camOff());
    $('#btnFlip').addEventListener('click', () => this.flip());
    $('#btnLine').addEventListener('click', () => { Engine.rotateLine(); this.lineHint(false); this.toast('Garis diputar'); });
    $('#btnHintRotate').addEventListener('click', () => { Engine.rotateLine(); this.lineHint(false); this.toast('Garis diputar'); });
    $('#btnHintClose').addEventListener('click', () => this.lineHint(false));
    $('#lens').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) this.pickLens(+b.dataset.i); });
    $('#btnBoxes').addEventListener('click', () => { Prefs.put('boxes', !Prefs.boxes); this.applyEngine(); this.renderStage(); this.renderSettings(); });
    $('#btnFull').addEventListener('click', () => this.fullscreen());
    document.addEventListener('fullscreenchange', () => this.renderStage());
    document.addEventListener('webkitfullscreenchange', () => this.renderStage());
    $('#hudGo').addEventListener('click', () => this.goBtn());
    $('#btnGo').addEventListener('click', () => this.goBtn());
    $('#btnStop').addEventListener('click', () => this.finish(false));
    $('#btnUndo').addEventListener('click', () => this.undo());
    $('#cTiles').addEventListener('click', (e) => { const t = e.target.closest('.ctile'); if (t) this.tap(+t.dataset.c, t); });
    $$('#tapDirSeg button').forEach(b => b.addEventListener('click', () => { Prefs.put('tapDir', +b.dataset.dir); this.renderCount(); }));
    $('#cLoc').addEventListener('click', () => { if (this.cur) this.openEdit(this.cur.id); });

    $('#startForm').addEventListener('submit', (e) => { e.preventDefault(); this.start(); });
    $('#btnGps').addEventListener('click', () => this.getGps());
    $$('#limitSeg button').forEach(b => b.addEventListener('click', () => { Prefs.put('limit', +b.dataset.limit); this.renderLimitSeg(); }));
    $('#editForm').addEventListener('submit', (e) => { e.preventDefault(); this.saveEdit(); });
    $$('.sheet [data-close]').forEach(el => el.addEventListener('click', () => this.closeSheet()));
    $('#cYes').addEventListener('click', () => this.answer('yes'));
    $('#cNo').addEventListener('click', () => this.answer('no'));

    $('#hQ').addEventListener('input', (e) => { this.hq = e.target.value; this.renderHistory(); });
    $('#sesList').addEventListener('click', (e) => { const r = e.target.closest('[data-sid]'); if (r) this.openSession(r.dataset.sid); });
    $('#recentList').addEventListener('click', (e) => { const r = e.target.closest('[data-sid]'); if (r) this.openSession(r.dataset.sid); });
    $('#placeGrid').addEventListener('click', (e) => {
      const r = e.target.closest('[data-loc]');
      if (!r) return;
      this.loc = r.dataset.loc; Store.set('locFilter', this.loc); this.mLoc.set(this.loc);
      this.go('history');
    });
    document.addEventListener('click', (e) => { if (e.target.closest('[data-export]')) this.exportSummary(this.historyRows()); });
    $('#btnSesEdit').addEventListener('click', () => this.openEdit(this.sesId));
    $('#btnShare').addEventListener('click', () => this.share());
    $('#btnSesCsv').addEventListener('click', () => this.exportIntervals());
    $('#btnSesDel').addEventListener('click', () => this.deleteSession());
    $$('#intSeg button').forEach(b => b.addEventListener('click', () => { this.sInt = +b.dataset.int; this.renderSession(); }));

    $$('#swatches button').forEach(b => b.addEventListener('click', () => { Store.set('palette', b.dataset.palette); this.applyTheme(); }));
    $$('#themeSeg button').forEach(b => b.addEventListener('click', () => { Store.set('theme', b.dataset.theme); this.applyTheme(); }));
    $$('#modelSeg button').forEach(b => b.addEventListener('click', () => this.setModel(b.dataset.model)));
    $$('#fpsSeg button').forEach(b => b.addEventListener('click', () => { Prefs.put('fps', b.dataset.fps); this.applyEngine(); this.renderSettings(); }));
    $$('#procSeg button').forEach(b => b.addEventListener('click', () => this.setProc(b.dataset.proc)));
    $('#btnBench').addEventListener('click', () => this.rebench());
    $('#inThr').addEventListener('input', (e) => { Prefs.put('thr', +e.target.value); this.applyEngine(); this.renderThr(); });
    $('#clsToggles').addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      const c = Prefs.cls.slice();
      c[+b.dataset.c] = !c[+b.dataset.c];
      if (!c.some(Boolean)) { this.toast('Pilih minimal satu jenis'); return; }
      Prefs.put('cls', c);
      this.applyEngine(); this.buildTiles(); this.renderSettings();
    });
    $$('#dirSeg button').forEach(b => b.addEventListener('click', () => { Prefs.put('dirs', +b.dataset.dirs); this.applyEngine(); this.renderSettings(); }));
    $('#swSound').addEventListener('click', () => { Prefs.put('sound', !Prefs.sound); if (Prefs.sound) { Fx.unlock(); Fx.beep(880); } this.renderSettings(); });
    $('#swVib').addEventListener('click', () => { Prefs.put('vib', !Prefs.vib); if (Prefs.vib) Fx.buzz(30); this.renderSettings(); });
    $('#swBoxes').addEventListener('click', () => { Prefs.put('boxes', !Prefs.boxes); this.applyEngine(); this.renderSettings(); this.renderStage(); });
    $('#empGrid').addEventListener('change', (e) => {
      const i = e.target.closest('[data-c]');
      if (!i) return;
      const v = Math.max(0, Math.min(10, Number(String(e.target.value).replace(',', '.')) || 0));
      const emp = Prefs.emp.slice();
      emp[+i.dataset.c] = v;
      Prefs.put('emp', emp);
      e.target.value = F.num(v, 2);
    });
    $('#btnCsvAll').addEventListener('click', () => this.exportSummary(this.sessions));
    $('#btnCsvEv').addEventListener('click', () => this.exportEvents(this.sessions));
    $('#btnWipe').addEventListener('click', () => this.wipe());
    $('#btnInstall').addEventListener('click', () => this.install());
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.installEvt = e; $('#btnInstall').hidden = false; });
    window.addEventListener('appinstalled', () => { this.installEvt = null; $('#btnInstall').hidden = true; });

    document.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => { if (this.cur) this.persist(this.cur); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme());
  },

  hideSplash() {
    const s = $('#splash');
    if (!s || s.classList.contains('out')) return;
    s.classList.add('out');
    setTimeout(() => s.remove(), 400);
  },

  applyTheme() {
    const root = document.documentElement;
    const palette = Store.get('palette') || 'orange';
    const theme = Store.get('theme') || 'auto';
    const mode = theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    root.setAttribute('data-palette', palette);
    root.setAttribute('data-mode', mode);
    $$('#swatches button').forEach(b => b.classList.toggle('on', b.dataset.palette === palette));
    $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.theme === theme));
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    const meta = $('meta[name="theme-color"]');
    if (meta && bg) meta.setAttribute('content', bg);
    Engine.refreshColors();
  },

  applyEngine() {
    Engine.proc = Prefs.proc;
    Engine.interval = CONFIG.FPS[Prefs.fps];
    Engine.thr = Prefs.thr / 100;
    Engine.enabled = Prefs.cls.slice();
    Engine.showBoxes = Prefs.boxes;
    Engine.tracker.dirs = Prefs.dirs;
    Engine.armed = !!(this.cur && Ses.running(this.cur) && Prefs.mode === 'auto');
    document.body.classList.toggle('manual', Prefs.mode === 'manual');
  },

  // ---------- Navigasi ----------
  go(view) {
    if (view === this.view) { if (view !== 'settings') scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (view === 'settings') { history.pushState({ v: 'settings' }, ''); this.show('settings'); return; }
    if (this.view === 'session' || this.view === 'settings') history.replaceState(null, '');
    this.show(view, true);
  },

  openSession(id) {
    if (!this.byId(id)) return;
    this.sesId = id;
    if (this.view === 'session') history.replaceState({ v: 'session', id }, '');
    else history.pushState({ v: 'session', id }, '');
    this.show('session', true);
  },

  onPop() {
    if (this.sheet) { this.closeSheet(); }
    if (this.view === 'session' || this.view === 'settings') this.show(this.base || 'home', true);
  },

  show(view, top) {
    if (TABS.includes(view) && view !== 'settings') this.base = view;
    const prev = this.view;
    this.view = view;
    Menu.closeAll();
    this.hideTip();
    if (this.sheet) this.closeSheet();
    $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
    const b = document.body;
    b.classList.toggle('no-filter', ['count', 'session', 'settings'].includes(view) || (view === 'home' && !this.sessions.length));
    b.classList.toggle('on-count', view === 'count');
    const sub = view === 'session' || (view === 'settings' && innerWidth < 1040);
    $('#btnBack').hidden = !sub;
    $('#topLogo').hidden = sub;
    $('#pageTitle').textContent = TITLES[view] || '';
    $('#btnSettings').hidden = view === 'settings';
    const cur = view === 'session' ? this.base : view;
    $$('.tabbar button, .side-nav button').forEach(x => x.classList.toggle('on', x.dataset.go === cur));
    if (top) scrollTo(0, 0);
    if (prev === 'count' && view !== 'count' && !this.cur && Engine.source === 'camera') this.camOff();
    if (view === 'count' && prev !== 'count' && Prefs.mode === 'auto' && !Engine.source && Store.get('camOk') === '1' && this.camState !== 'loading') this.camOn();
    this.render();
  },

  render() {
    if (this.view === 'home') this.renderHome();
    else if (this.view === 'count') this.renderCount();
    else if (this.view === 'history') this.renderHistory();
    else if (this.view === 'places') this.renderPlaces();
    else if (this.view === 'session') this.renderSession();
    else if (this.view === 'settings') this.renderSettings();
  },

  // ---------- Data ----------
  byId(id) { return this.sessions.find(s => s.id === id); },
  sortSessions() { this.sessions.sort((a, b) => b.start - a.start); },
  persist(s) {
    s.saved = Date.now();
    return DB.put(s).catch(() => this.toast('Gagal menyimpan'));
  },
  saveSoon() {
    clearTimeout(this._sv);
    this._sv = setTimeout(() => { if (this.cur) this.persist(this.cur); }, 1200);
  },
  locNames() {
    const set = new Map();
    this.sessions.forEach(s => { const n = Ses.name(s); set.set(n, (set.get(n) || 0) + 1); });
    return Array.from(set.keys()).sort((a, b) => a.localeCompare(b, 'id'));
  },
  refreshLocs() {
    const names = this.locNames();
    this.mLoc.setItems([{ v: '', t: 'Semua lokasi', ic: 'pin' }].concat(names.map(n => ({ v: n, t: n }))));
    if (this.loc && !names.includes(this.loc)) { this.loc = ''; Store.set('locFilter', ''); }
    this.mLoc.set(this.loc);
    $('#locList').innerHTML = names.filter(n => n !== 'Tanpa lokasi').map(n => `<option value="${esc(n)}"></option>`).join('');
  },
  inLoc(s) { return !this.loc || Ses.name(s) === this.loc; },
  sessionsIn(from, to) { return this.sessions.filter(s => s.start >= from && s.start < to && this.inLoc(s)); },
  first() { return this.sessions.length ? Math.min(...this.sessions.map(s => s.start)) : Date.now(); },

  agg(list) {
    const counts = new Array(CLASSES.length).fill(0);
    let total = 0, dur = 0;
    list.forEach(s => { const st = Ses.stat(s); st.counts.forEach((n, i) => { counts[i] += n; }); total += st.total; dur += Ses.dur(s); });
    const rate = Ses.perHour(total, dur);
    const smp = Ses.perHour(Ses.smp(counts), dur);
    return { counts, total, dur, n: list.length, rate, smp };
  },

  // ---------- Beranda ----------
  setDelta(el, d, invert) {
    el.className = el.className.replace(/\s?(up|dn|flat)\b/g, '');
    if (d === null || !isFinite(d)) { el.innerHTML = ''; return; }
    const up = d >= 0;
    el.classList.add(Math.abs(d) < 0.005 ? 'flat' : (up !== !!invert ? 'up' : 'dn'));
    el.innerHTML = (Math.abs(d) < 0.005 ? '' : ic(up ? 'up' : 'dn')) + F.pct(d);
  },

  renderHome() {
    const empty = !this.sessions.length;
    $('#welcome').hidden = !empty;
    $('.home').hidden = empty;
    document.body.classList.toggle('no-filter', empty);
    if (empty) return;
    const r = rangeOf(this.period, this.first());
    const cur = this.sessionsIn(r.from, r.to);
    const prev = r.pFrom ? this.sessionsIn(r.pFrom, r.pTo) : [];
    const a = this.agg(cur), p = this.agg(prev);
    const hasPrev = !!r.pFrom;

    $('#hTotal').textContent = F.count(a.total);
    this.setDelta($('#hTotalD'), hasPrev ? delta(a.total, p.total) : null);
    $('#tSes').textContent = fmt(a.n);
    this.setDelta($('#tSesD'), hasPrev ? delta(a.n, p.n) : null);
    $('#tDur').textContent = a.dur ? F.durShort(a.dur) : '–';
    $('#tRate').textContent = a.rate !== null ? F.rate(a.rate) : '–';
    this.setDelta($('#tRateD'), hasPrev && a.rate !== null && p.rate ? delta(a.rate, p.rate) : null);
    $('#tSmp').textContent = a.smp !== null ? F.rate(a.smp) : '–';

    Chart.mix($('#hMix'), a.counts);
    const dom = a.counts.indexOf(Math.max(...a.counts));
    $('#mixSub').textContent = a.total ? 'terbanyak ' + CLASSES[dom].t.toLowerCase() : '';

    const evs = [];
    cur.forEach(s => s.ev.forEach(e => evs.push(s.start + e[0])));
    const buckets = this.buckets(r, evs);
    Chart.spark($('#hSpark'), buckets.map(b => b.v));
    Chart.cols($('#trendChart'), buckets);
    $('#trendSub').textContent = { hour: 'per jam', day: 'per hari', week: 'per minggu', month: 'per bulan' }[buckets.unit] || '';

    const showHours = this.period !== 'today';
    $('#hoursCard').hidden = !showHours;
    if (showHours) {
      const hc = new Array(24).fill(0);
      evs.forEach(t => { hc[new Date(t).getHours()]++; });
      const [h0, h1] = this.hourSpan(evs);
      const items = [];
      for (let h = h0; h <= h1; h++) items.push({ v: hc[h], tv: fmt(hc[h]) + ' kendaraan', tl: pad(h) + '.00–' + pad(h + 1) + '.00', x: h % 3 === 0 ? String(h) : '' });
      Chart.cols($('#hoursChart'), items, { peak: true });
      const top = items.reduce((x, y) => (y.v > x.v ? y : x), items[0]);
      $('#hoursSub').textContent = top && top.v ? top.tl : '';
    }

    const names = new Set(cur.map(s => Ses.name(s)));
    $('#locCard').hidden = !!this.loc || names.size < 2;
    if (!this.loc) {
      const by = new Map();
      cur.forEach(s => { const n = Ses.name(s); by.set(n, (by.get(n) || 0) + Ses.stat(s).total); });
      const items = Array.from(by, ([name, v]) => ({ name, v, tv: F.count(v) })).sort((x, y) => y.v - x.v).slice(0, 5);
      Chart.bars($('#locBars'), items);
    }
    const recent = cur.slice(0, 5);
    $('#recentList').innerHTML = recent.length ? recent.map(s => this.sesRow(s, true)).join('') : this.emptyRow('history');
  },

  hourSpan(evs) {
    if (!evs.length) return [6, 18];
    let lo = 23, hi = 0;
    evs.forEach(t => { const h = new Date(t).getHours(); if (h < lo) lo = h; if (h > hi) hi = h; });
    return [Math.min(6, lo), Math.max(18, hi)];
  },

  buckets(r, evs) {
    const out = [];
    const now = Date.now();
    const lab = (n) => fmt(n) + ' kendaraan';
    let unit;
    if (this.period === 'today') {
      unit = 'hour';
      const [h0, h1] = this.hourSpan(evs);
      const hv = new Array(24).fill(0);
      evs.forEach(t => { hv[new Date(t).getHours()]++; });
      for (let h = h0; h <= h1; h++) out.push({ v: hv[h], tv: lab(hv[h]), tl: pad(h) + '.00–' + pad(h + 1) + '.00', x: h % 3 === 0 ? String(h) : '' });
    } else if (r.days <= 45) {
      unit = 'day';
      const n = r.days;
      const v = new Array(n).fill(0);
      evs.forEach(t => { const i = Math.round((sod(t) - r.from) / DAY); if (i >= 0 && i < n) v[i]++; });
      const step = n <= 8 ? 1 : n <= 16 ? 2 : n <= 31 ? 5 : 7;
      for (let i = 0; i < n; i++) {
        const d = new Date(r.from + i * DAY + DAY / 2);
        out.push({ v: v[i], tv: lab(v[i]), tl: F.day(d.getTime()), x: (n - 1 - i) % step === 0 ? (n <= 8 ? DOW[d.getDay()].slice(0, 3) : String(d.getDate())) : '' });
      }
    } else if (r.days <= 180) {
      unit = 'week';
      const n = Math.ceil(r.days / 7);
      const start = sod(now) + DAY - n * 7 * DAY;
      const v = new Array(n).fill(0);
      evs.forEach(t => { const i = Math.floor((t - start) / (7 * DAY)); if (i >= 0 && i < n) v[i]++; });
      const step = n <= 8 ? 1 : n <= 14 ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const s = start + i * 7 * DAY;
        out.push({ v: v[i], tv: lab(v[i]), tl: F.date(s) + ' – ' + F.date(s + 6 * DAY), x: (n - 1 - i) % step === 0 ? new Date(s).getDate() + '/' + (new Date(s).getMonth() + 1) : '' });
      }
    } else {
      unit = 'month';
      const a = new Date(r.from), b = new Date(now);
      const n = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
      const v = new Array(n).fill(0);
      evs.forEach(t => { const d = new Date(t); const i = (d.getFullYear() - a.getFullYear()) * 12 + d.getMonth() - a.getMonth(); if (i >= 0 && i < n) v[i]++; });
      for (let i = 0; i < n; i++) {
        const d = new Date(a.getFullYear(), a.getMonth() + i, 1);
        out.push({ v: v[i], tv: lab(v[i]), tl: MON[d.getMonth()] + ' ' + d.getFullYear(), x: n <= 12 || i % 2 === 0 ? MON[d.getMonth()] : '' });
      }
    }
    out.unit = unit;
    return out;
  },

  emptyRow(icon) { return `<div class="empty-state"><span>${ic(icon)}</span></div>`; },

  sesRow(s, compact) {
    const st = Ses.stat(s);
    const live = s === this.cur;
    const dur = Ses.dur(s);
    const rate = Ses.perHour(st.total, dur);
    const auto = Ses.usesAi(s);
    const range = F.time(s.start) + '–' + (s.end ? F.time(s.end) : 'sekarang');
    const sub = (compact ? F.day(s.start) + ' · ' : '') + range + ' · ' + F.dur(dur);
    const pill = live
      ? `<span class="pt live-pt">${ic(Ses.running(s) ? 'play' : 'pause')}${Ses.running(s) ? 'Berjalan' : 'Dijeda'}</span>`
      : rate !== null ? `<span class="pt soft">${ic('pulse')}${F.rate(rate)}/jam</span>` : '';
    return `<button class="row" data-sid="${esc(s.id)}">
      <span class="av ${auto ? 'cam' : 'man'}">${ic(auto ? 'camera' : 'hand')}</span>
      <span class="row-main"><span class="row-t">${esc(Ses.name(s))}</span><span class="row-s">${ic('clock')}<span>${esc(sub)}</span></span></span>
      <span class="row-end"><span class="row-amt">${F.count(st.total)}</span>${pill}</span>
    </button>`;
  },

  paged(el, list, row, icon) {
    if (this._io) this._io.disconnect();
    if (!list.length) { el.innerHTML = this.emptyRow(icon); return; }
    let n = 0;
    const more = () => {
      const chunk = list.slice(n, n + PAGE);
      n += chunk.length;
      const s = $('.sentinel', el);
      if (s) s.remove();
      el.insertAdjacentHTML('beforeend', chunk.map(row).join('') + (n < list.length ? '<div class="sentinel"></div>' : ''));
      const ns = $('.sentinel', el);
      if (ns) this._io.observe(ns);
    };
    el.innerHTML = '';
    this._io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) more(); }, { rootMargin: '600px' });
    more();
  },

  // ---------- Riwayat ----------
  historyRows() {
    const r = rangeOf(this.period, this.first());
    let list = this.sessionsIn(r.from, r.to);
    const q = this.hq.trim().toLowerCase();
    if (q) list = list.filter(s => Ses.name(s).toLowerCase().includes(q) || (s.note || '').toLowerCase().includes(q));
    return list;
  },

  renderHistory() {
    const list = this.historyRows();
    const a = this.agg(list);
    $('#hSum').innerHTML = `<span class="pill">${ic('list')}${fmt(a.n)} sesi</span><span class="pill">${ic('car')}${F.count(a.total)}</span><span class="pill">${ic('timer')}${a.dur ? F.dur(a.dur) : '–'}</span><button class="pill pill-dl" data-export aria-label="Unduh CSV">${ic('download')}</button>`;
    const days = [];
    let g = null;
    list.forEach(s => {
      const d = sod(s.start);
      if (!g || g.d !== d) { g = { d, items: [], total: 0 }; days.push(g); }
      g.items.push(s);
      g.total += Ses.stat(s).total;
    });
    const group = (x) => `<div class="day"><div class="day-head"><h3>${esc(F.day(x.d))}</h3><span>${F.count(x.total)}</span></div>${x.items.map(s => this.sesRow(s)).join('')}</div>`;
    this.paged($('#sesList'), days, group, 'history');
  },

  // ---------- Lokasi ----------
  renderPlaces() {
    const r = rangeOf(this.period, this.first());
    const cur = this.sessionsIn(r.from, r.to);
    const prev = r.pFrom ? this.sessionsIn(r.pFrom, r.pTo) : [];
    const by = (list) => {
      const m = new Map();
      list.forEach(s => { const n = Ses.name(s); if (!m.has(n)) m.set(n, []); m.get(n).push(s); });
      return m;
    };
    const cm = by(cur), pm = by(prev);
    const total = cur.reduce((x, s) => x + Ses.stat(s).total, 0) || 1;
    const rows = Array.from(cm, ([name, list]) => {
      const a = this.agg(list);
      const p = pm.has(name) ? this.agg(pm.get(name)) : null;
      return { name, a, d: r.pFrom && p ? delta(a.total, p.total) : null };
    }).sort((x, y) => y.a.total - x.a.total);
    const max = Math.max(...rows.map(x => x.a.total), 1);
    $('#placeGrid').innerHTML = rows.length ? rows.map((x, i) => {
      const d = x.d;
      const dl = d === null || !isFinite(d) ? '' : `<span class="delta ${Math.abs(d) < 0.005 ? '' : d >= 0 ? 'up' : 'dn'}">${Math.abs(d) < 0.005 ? '' : ic(d >= 0 ? 'up' : 'dn')}${F.pct(d)}</span>`;
      const di = x.a.counts.indexOf(Math.max(...x.a.counts));
      const dom = x.a.total ? `<b style="--cc:var(--c${di})">${ic(CLASSES[di].ic)}${esc(CLASSES[di].t)}</b>` : '<b>–</b>';
      return `<button class="store" data-loc="${esc(x.name)}">
        <div class="store-head"><span class="store-rank">${i + 1}</span><span class="store-name">${esc(x.name)}</span><span class="store-share">${F.pct(x.a.total / total)}</span></div>
        <div class="store-omzet">${F.count(x.a.total)}${dl}</div>
        <span class="bar-track"><span class="bar-fill" style="width:${(x.a.total / max) * 100}%;animation-delay:${i * 60}ms"></span></span>
        <div class="store-stats">
          <div><span>Sesi</span><b>${fmt(x.a.n)}</b></div>
          <div><span>Per jam</span><b>${x.a.rate !== null ? F.rate(x.a.rate) : '–'}</b></div>
          <div><span>Terbanyak</span>${dom}</div>
        </div>
      </button>`;
    }).join('') : this.emptyRow('pin');
  },

  // ---------- Detail sesi ----------
  intervals(s, mins) {
    const step = mins * 60000;
    const end = Math.max(s.end || Date.now(), s.start + 1);
    const day0 = sod(s.start);
    const t0 = day0 + Math.floor((s.start - day0) / step) * step;
    const n = Math.max(1, Math.ceil((end - t0) / step));
    const rows = [];
    for (let i = 0; i < n; i++) rows.push({ a: t0 + i * step, b: t0 + (i + 1) * step, counts: new Array(CLASSES.length).fill(0), dir: [0, 0, 0], n: 0 });
    s.ev.forEach(e => {
      const i = Math.floor((s.start + e[0] - t0) / step);
      const r = rows[Math.max(0, Math.min(n - 1, i))];
      r.counts[e[1]]++; r.dir[e[2]]++; r.n++;
    });
    return rows;
  },

  renderSession() {
    const s = this.byId(this.sesId);
    if (!s) { history.back(); return; }
    const st = Ses.stat(s);
    const dur = Ses.dur(s);
    const auto = Ses.usesAi(s);
    $('#sDate').textContent = F.full(s.start);
    $('#sMode').innerHTML = ic(auto ? 'camera' : 'hand');
    $('#sLoc').textContent = Ses.name(s);
    $('#sTime').textContent = F.time(s.start) + '–' + (s.end ? F.time(s.end) : 'sekarang');
    $('#sTotal').textContent = fmt(st.total);
    const [d0, d1, d2] = st.dir;
    if (d1 + d2 > 0) {
      const tot = st.total || 1;
      const seg = (n) => n ? `<i style="flex:${n}"></i>` : '<i style="flex:0;min-width:0"></i>';
      $('#sDir').innerHTML = `<div class="dir-track">${seg(d1)}${seg(d2)}${seg(d0)}</div>
        <div class="dir-legend"><span><i></i>A→B ${fmt(d1)} · ${F.pct(d1 / tot)}</span><span><i></i>B→A ${fmt(d2)} · ${F.pct(d2 / tot)}</span>${d0 ? `<span><i></i>Tanpa arah ${fmt(d0)}</span>` : ''}</div>`;
    } else {
      $('#sDir').innerHTML = '';
    }
    const rate = Ses.perHour(st.total, dur);
    const smp = Ses.perHour(Ses.smp(st.counts), dur);
    $('#sDur').textContent = F.dur(dur);
    $('#sRate').textContent = rate !== null ? F.rate(rate) : '–';
    $('#sSmp').textContent = smp !== null ? F.rate(smp) : '–';

    const spanMin = ((s.end || Date.now()) - s.start) / 60000;
    const ok = (m) => spanMin / m <= 180;
    if (this.sIntFor !== s.id) { this.sIntFor = s.id; this.sInt = spanMin <= 20 ? 1 : spanMin <= 120 ? 5 : spanMin <= 720 ? 15 : 60; }
    if (!ok(this.sInt)) this.sInt = [5, 15, 60].find(ok) || 60;
    const int = this.sInt;
    $$('#intSeg button').forEach(b => { const m = +b.dataset.int; b.disabled = !ok(m); b.classList.toggle('on', m === int); });
    const rows = this.intervals(s, int);
    const peak = rows.reduce((x, y) => (y.n > x.n ? y : x), rows[0]);
    $('#sPeakL').textContent = 'Puncak ' + (int === 60 ? '1 jam' : int + ' mnt');
    $('#sPeak').textContent = peak && peak.n ? fmt(peak.n) + ' · ' + F.time(peak.a) : '–';
    const step = rows.length <= 12 ? 1 : rows.length <= 24 ? 2 : rows.length <= 48 ? 4 : Math.ceil(rows.length / 10);
    Chart.cols($('#sChart'), rows.map((r, i) => ({
      v: r.n, tv: fmt(r.n) + ' kendaraan', tl: F.time(r.a) + '–' + F.time(r.b),
      x: (rows.length - 1 - i) % step === 0 ? F.time(r.a) : ''
    })), { peak: true });
    $('#sIntSub').textContent = rows.length + ' interval';

    Chart.mix($('#sMix'), st.counts);
    $('#sMixSub').textContent = st.manual ? fmt(st.manual) + ' dari tap' : '';
    const meta = [];
    meta.push(`<span>${ic(auto ? 'camera' : 'hand')}<b>${auto ? 'Kamera AI' : 'Manual'}</b></span>`);
    if (auto && st.manual) meta.push(`<span>${ic('hand')}<b>+${fmt(st.manual)} tap</b></span>`);
    if (s.limit) meta.push(`<span>${ic('timer')}<b>Batas ${F.dur(s.limit)}</b></span>`);
    if (s.geo) meta.push(`<a href="https://www.google.com/maps?q=${s.geo.lat},${s.geo.lng}" target="_blank" rel="noopener"><span>${ic('gps')}<b>${s.geo.lat.toFixed(5)}, ${s.geo.lng.toFixed(5)}</b></span></a>`);
    if (s === this.cur) meta.push(`<span>${ic(Ses.running(s) ? 'play' : 'pause')}<b>${Ses.running(s) ? 'Sedang berjalan' : 'Dijeda'}</b></span>`);
    $('#sMeta').innerHTML = meta.join('');
    $('#sNoteCard').hidden = !s.note;
    $('#sNote').textContent = s.note || '';
    $('#btnSesDel').hidden = s === this.cur;
  },

  // ---------- Hitung ----------
  setMode(m) {
    if (m === Prefs.mode) return;
    Prefs.put('mode', m);
    if (this.cur && !this.cur.ev.length) this.cur.mode = m;
    this.applyEngine();
    if (m === 'manual' && Engine.source) this.camOff();
    if (m === 'auto' && !Engine.source && (this.cur || Store.get('camOk') === '1')) this.camOn();
    this.renderCount();
  },

  buildTiles() {
    const st = this.cur ? Ses.stat(this.cur) : null;
    let k = 0;
    $('#cTiles').innerHTML = CLASSES.map((c, i) => {
      if (!Prefs.cls[i] && !(st && st.counts[i])) return '';
      k++;
      return `<button class="ctile" data-c="${i}" style="--cc:var(--c${i})" aria-label="Tambah ${esc(c.t)}">
        <span class="ctile-ic">${ic(c.ic)}</span><span class="ctile-n">0</span><span class="ctile-t">${esc(c.t)}</span>
        <span class="ctile-plus">${ic('plus')}</span><span class="ctile-key">${k}</span>
      </button>`;
    }).join('');
    $('#hudChips').innerHTML = CLASSES.map((c, i) => (Prefs.cls[i] || (st && st.counts[i])) ? `<span style="--cc:var(--c${i})" data-c="${i}">${ic(c.ic)}<b>0</b></span>` : '').join('');
    this.renderCount();
  },

  renderCount() {
    const s = this.cur;
    const st = s ? Ses.stat(s) : { counts: new Array(CLASSES.length).fill(0), dir: [0, 0, 0], total: 0 };
    const run = s && Ses.running(s);
    $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === Prefs.mode));
    $$('#cTiles .ctile').forEach(t => { $('.ctile-n', t).textContent = F.count(st.counts[+t.dataset.c]); });
    $$('#hudChips span').forEach(t => { $('b', t).textContent = F.count(st.counts[+t.dataset.c]); });
    $('#cTotal').textContent = F.count(st.total);
    $('#hudTotal').textContent = F.count(st.total);
    $('#cA').textContent = fmt(st.dir[1]);
    $('#cB').textContent = fmt(st.dir[2]);
    const showDir = Prefs.mode === 'auto' || st.dir[1] + st.dir[2] > 0 || Prefs.tapDir > 0;
    $$('#liveHero .dir-a, #liveHero .dir-b').forEach(x => { x.hidden = !showDir; });
    $('#cLoc span').textContent = s ? Ses.name(s) : 'Belum mulai';
    $('#cLoc').disabled = !s;
    const state = $('#cState');
    state.className = 'state-chip' + (run ? ' rec' : s ? ' pause' : '');
    state.textContent = run ? 'Menghitung' : s ? 'Dijeda' : 'Siap';
    const go = $('#btnGo');
    go.className = 'btn btn-primary btn-go' + (run ? ' pause' : '');
    go.innerHTML = run ? `${ic('pause')}<span>Jeda</span>` : s ? `${ic('play')}<span>Lanjut</span>` : `${ic('play')}<span>Mulai</span>`;
    $('#hudGo').className = 'hud-go' + (run ? ' pause' : '');
    $('#hudGo').innerHTML = ic(run ? 'pause' : 'play');
    $('#btnStop').disabled = !s;
    $('#btnUndo').disabled = !s || !s.ev.length;
    $$('#tapDirSeg button').forEach(b => b.classList.toggle('on', +b.dataset.dir === Prefs.tapDir));
    $('#tapDir').hidden = Prefs.mode !== 'manual';
    this.renderTimer();
    this.renderStage();
    $$('.nav-live').forEach(x => { x.hidden = !run; });
  },

  renderTimer() {
    const s = this.cur;
    const dur = s ? Ses.dur(s) : 0;
    $('#cDur').textContent = F.clock(dur);
    $('#hudDur').textContent = F.clock(dur);
    const st = s ? Ses.stat(s) : null;
    const r = s ? Ses.perHour(st.total, dur) : null;
    $('#cRate').textContent = r !== null ? F.rate(r) : '0';
    const bar = $('#cLimit');
    bar.hidden = !(s && s.limit);
    if (s && s.limit) $('i', bar).style.width = Math.min(100, dur / s.limit * 100) + '%';
    const pill = $('#stState');
    const run = s && Ses.running(s);
    pill.className = 'st-pill' + (run ? ' rec' : s ? ' pause' : '');
    $('b', pill).textContent = run ? F.clock(dur) : s ? 'Jeda' : Engine.source === 'file' ? Engine.fileName : 'Pratinjau';
    const fps = $('#stFps');
    if (this.camState === 'ready' && Engine.det) fps.textContent = `AI ${Math.round(Engine.fps)} fps${Engine.delegate === 'CPU' ? ' · CPU' : ''}`;
    else fps.textContent = '';
    fps.classList.toggle('slow', this.camState === 'ready' && !!Engine.det && Engine.stamps.length > 4 && Engine.fps < 7);
  },

  renderStage() {
    const stage = $('#stage');
    const on = !!Engine.source;
    stage.classList.toggle('off', !on);
    $('#stEmpty').hidden = on && this.camState !== 'error';
    $('#stEmpty').classList.toggle('err', this.camState === 'error');
    if (this.camState === 'error') {
      $('#stEmptyT').textContent = this.camErrT || 'Gagal';
      $('#stEmptyS').textContent = this.camErr;
      $('#btnCam span').textContent = 'Coba lagi';
    } else {
      $('#stEmptyT').textContent = 'Kamera mati';
      $('#stEmptyS').textContent = 'Video tidak direkam dan tidak dikirim. Deteksi berjalan di HP ini.';
      $('#btnCam span').textContent = 'Nyalakan kamera';
    }
    $('#stLoad').hidden = this.camState !== 'loading';
    $('#btnFlip').hidden = Engine.source !== 'camera' || Engine.cams.length < 2;
    this.renderLens();
    const fsOk = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    $('#btnFull').hidden = !fsOk;
    $('#btnFull').innerHTML = ic(fs ? 'shrink' : 'expand');
    $('#btnBoxes').innerHTML = ic(Prefs.boxes ? 'eye' : 'eye-off');
    $('#btnBoxes').classList.toggle('on', !Prefs.boxes);
    $('#btnCamOff').title = Engine.source === 'file' ? 'Tutup video' : 'Matikan kamera';
    $('.stage-hint span').textContent = Engine.source === 'file' && !(this.cur && Ses.running(this.cur))
      ? 'Atur garis, lalu tekan Mulai untuk memutar video.'
      : 'Geser ujung garis. Kendaraan dihitung saat melewati garis.';
    this.renderTimer();
  },

  setLoad(p, s) {
    $('#stProg').style.width = Math.round(p * 100) + '%';
    $('#stLoadT').textContent = 'Memuat AI ' + Math.round(p * 100) + '%';
    $('#stLoadS').textContent = s || '';
  },

  async loadModel() {
    if (Engine.det && Engine.modelKey === Prefs.model) { this.camState = 'ready'; this.renderStage(); return; }
    this.camState = 'loading';
    this.setLoad(0, 'Menyiapkan mesin AI');
    this.renderStage();
    try {
      await Engine.load(Prefs.model, (p, s) => this.setLoad(p, s));
      this.camState = Engine.source ? 'ready' : 'off';
      this.syncFile();
    } catch (e) {
      this.camState = 'error';
      this.camErrT = 'AI belum siap';
      this.camErr = e.message;
    }
    this.renderStage();
    this.renderSettings();
  },

  async camOn() {
    if (this.camState === 'loading' || this.camState === 'starting') return;
    this.camState = 'starting';
    try {
      await Engine.startCamera({ deviceId: Store.get('camDevice') });
      Store.set('camOk', '1');
      const z = +Store.get('camZoom');
      if (z && Engine.zoom) await Engine.setZoom(z);
    } catch (e) {
      this.camState = 'error';
      this.camErrT = 'Kamera tidak bisa dibuka';
      this.camErr = e.message;
      this.renderStage();
      return;
    }
    Wake.set(true);
    await this.loadModel();
  },

  async openFile(file) {
    try { await Engine.openFile(file); } catch (e) { this.toast(e.message); return; }
    Wake.set(true);
    await this.loadModel();
  },

  camOff() {
    Engine.stopSource();
    this.lineHint(false);
    if (this.camState !== 'loading') this.camState = 'off';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.updateWake();
    this.renderStage();
  },

  async flip() {
    const front = Engine.facing !== 'user';
    try { await Engine.startCamera(front ? { facing: 'user' } : { facing: 'environment', deviceId: Store.get('camDevice') }); } catch (e) { this.toast(e.message); }
    this.renderStage();
  },

  // Pilihan lensa: zoom di bawah 1 (0,5x/0,6x) bila HP mendukung, atau daftar kamera belakang.
  lensOpts() {
    if (Engine.source !== 'camera' || Engine.facing === 'user') return [];
    const z = Engine.zoom;
    const zf = (v) => F.num(v, 1) + '×';
    const zoomOpts = (vals) => vals.filter((v, i) => v >= z.min - 1e-3 && v <= z.max + 1e-3 && vals.indexOf(v) === i)
      .map(v => ({ t: zf(v), zoom: v, on: Math.abs(z.cur - v) < 0.05 }));
    if (z && z.min < 0.95) return zoomOpts([Math.round(z.min * 10) / 10, 1, 2]);
    const back = Engine.cams.filter(c => !/front|depan|user/i.test(c.label) && !/dual|triple|ganda|tiga/i.test(c.label));
    if (back.length > 1) {
      const rank = (c) => /ultra|lebar|0[.,]5/i.test(c.label) ? 0 : /tele/i.test(c.label) ? 3 : /camera2 0\b|^back camera$|kamera belakang$/i.test(c.label) ? 1 : 2;
      let n = 0;
      return back.map(c => ({ c, r: rank(c) })).sort((p, q) => p.r - q.r).map(x => ({
        t: x.r === 0 ? '0,5×' : x.r === 1 ? '1×' : x.r === 3 ? 'Tele' : 'Lensa ' + (++n),
        id: x.c.id, label: x.c.label, on: x.c.id === Engine.deviceId
      }));
    }
    if (z && z.max >= 2) return zoomOpts([1, 2]);
    return [];
  },

  renderLens() {
    const opts = this.lensOpts();
    this._lens = opts;
    const el = $('#lens');
    el.hidden = opts.length < 2;
    el.innerHTML = opts.map((o, i) => `<button data-i="${i}" class="${o.on ? 'on' : ''}" aria-pressed="${o.on}">${esc(o.t)}</button>`).join('');
  },

  async pickLens(i) {
    const o = (this._lens || [])[i];
    if (!o || o.on) return;
    if (o.zoom) {
      if (await Engine.setZoom(o.zoom)) Store.set('camZoom', String(o.zoom));
      else this.toast('Zoom tidak didukung kamera ini');
    } else if (o.id) {
      Store.set('camDevice', o.id);
      Store.del('camZoom');
      try { await Engine.startCamera({ deviceId: o.id }); } catch (e) { this.toast(e.message); }
      if (/^Lensa/.test(o.t)) this.toast(o.t + ' aktif. Pilih lensa yang gambarnya paling lebar.');
    }
    this.renderStage();
  },

  lineHint(on) {
    $('#stHint').hidden = !on;
    clearTimeout(this._lh);
    if (on) {
      if (Prefs.vib) Fx.buzz([40, 60, 40]);
      this._lh = setTimeout(() => { $('#stHint').hidden = true; }, 20000);
    }
  },

  fullscreen() {
    const st = $('#stage');
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const req = st.requestFullscreen || st.webkitRequestFullscreen;
    if (req) Promise.resolve(req.call(st)).catch(() => this.toast('Layar penuh tidak didukung'));
  },

  updateWake() { Wake.set(!!Engine.source || !!(this.cur && Ses.running(this.cur))); },

  // Video file hanya diputar saat sesi berjalan dan AI siap, agar tidak ada kendaraan yang terlewat.
  syncFile() { Engine.playFile(!!(this.cur && Ses.running(this.cur) && Engine.det)); },

  goBtn() {
    Fx.unlock();
    if (!this.cur) { this.openStart(); return; }
    if (Ses.running(this.cur)) this.pause(); else this.resume();
  },

  openStart() {
    $('#inLoc').value = Store.get('lastLoc');
    this.geo = null;
    this.renderGps();
    this.renderLimitSeg();
    this.openSheet('startSheet');
  },

  renderLimitSeg() { $$('#limitSeg button').forEach(b => b.classList.toggle('on', +b.dataset.limit === Prefs.limit)); },

  renderGps() {
    const b = $('#btnGps');
    b.classList.toggle('set', !!this.geo);
    $('span', b).textContent = this.geo ? `Titik GPS tersimpan ±${Math.round(this.geo.acc)} m` : 'Simpan titik GPS';
  },

  getGps() {
    if (!navigator.geolocation) { this.toast('GPS tidak tersedia'); return; }
    $('span', $('#btnGps')).textContent = 'Mencari lokasi…';
    navigator.geolocation.getCurrentPosition((p) => {
      this.geo = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy || 0 };
      this.renderGps();
    }, (e) => {
      this.renderGps();
      this.toast(e.code === 1 ? 'Izin lokasi ditolak' : 'Lokasi tidak ditemukan');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  },

  async start() {
    const loc = $('#inLoc').value.replace(/\s+/g, ' ').trim();
    Store.set('lastLoc', loc);
    const now = Date.now();
    const s = {
      id: 's' + now.toString(36) + Math.random().toString(36).slice(2, 6),
      loc, note: '', geo: this.geo, mode: Prefs.mode, start: now, end: 0, segs: [[now, 0]],
      limit: Prefs.limit * 60000, ev: [], line: Object.assign({}, Engine.tracker.line), v: 1
    };
    this.closeSheet();
    this.cur = s;
    this.sessions.unshift(s);
    this.persist(s);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    this.refreshLocs();
    this.applyEngine();
    Engine.tracker.resync();
    this.buildTiles();
    this.updateWake();
    this.syncFile();
    Fx.beep(660, .1);
    if (Prefs.mode === 'auto' && !Engine.source) this.camOn();
  },

  pause(silent) {
    const s = this.cur;
    if (!s || !Ses.running(s)) return;
    s.segs[s.segs.length - 1][1] = Date.now();
    this.applyEngine();
    this.syncFile();
    this.persist(s);
    this.updateWake();
    this.renderCount();
    if (!silent) Fx.beep(440, .1);
  },

  resume() {
    const s = this.cur;
    if (!s || Ses.running(s)) return;
    s.segs.push([Date.now(), 0]);
    this.applyEngine();
    Engine.tracker.resync();
    this.syncFile();
    if (Engine.source === 'file' && Engine.video.ended) this.toast('Video sudah selesai. Tap kartu untuk menambah manual');
    this.persist(s);
    this.updateWake();
    this.renderCount();
    Fx.beep(660, .1);
    if (Prefs.mode === 'auto' && !Engine.source) this.camOn();
  },

  sesBox(s) {
    const st = Ses.stat(s);
    const dur = Ses.dur(s);
    const r = Ses.perHour(st.total, dur);
    const mix = CLASSES.map((c, i) => st.counts[i] ? `${c.t} ${fmt(st.counts[i])}` : '').filter(Boolean).join(' · ');
    return `<div class="c-row big"><span class="c-val">${fmt(st.total)}</span><span class="c-sub">kendaraan</span></div>
      <div class="c-row">${ic('pin')}<span class="c-val">${esc(Ses.name(s))}</span></div>
      <div class="c-row">${ic('timer')}<span class="c-val">${F.dur(dur)}</span><span class="c-sub">${r !== null ? F.rate(r) + '/jam' : ''}</span></div>
      ${mix ? `<div class="c-row">${ic('car')}<span class="c-val">${esc(mix)}</span></div>` : ''}`;
  },

  async finish(auto) {
    const s = this.cur;
    if (!s) return;
    if (!auto) {
      if (!s.ev.length) {
        const r = await this.confirm({ icon: 'trash', bad: true, title: 'Sesi masih kosong', rows: this.sesBox(s), warn: 'Belum ada kendaraan terhitung', no: { t: 'Lanjut' }, yes: { t: 'Buang', ic: 'trash', cls: 'btn-bad' } });
        if (r !== 'yes' || this.cur !== s) return;
        this.cur = null;
        this.sessions = this.sessions.filter(x => x !== s);
        await DB.del(s.id).catch(() => {});
        this.afterFinish();
        this.toast('Sesi dibuang');
        return;
      }
      const r = await this.confirm({ icon: 'stop', title: 'Selesai menghitung?', rows: this.sesBox(s), no: { t: 'Lanjut' }, yes: { t: 'Simpan', ic: 'check' } });
      if (r !== 'yes' || this.cur !== s) return;
    }
    const l = s.segs[s.segs.length - 1];
    if (l && !l[1]) l[1] = auto && s.limit ? Math.min(Date.now(), l[0] + s.limit - (Ses.dur(s, Date.now()) - (Date.now() - l[0]))) : Date.now();
    s.end = Math.max(l ? l[1] : Date.now(), Ses.last(s));
    this.cur = null;
    await this.persist(s);
    this.afterFinish();
    if (auto) {
      Fx.beep(520, .35); setTimeout(() => Fx.beep(780, .35), 380);
      Fx.buzz([90, 60, 90]);
      this.toast('Waktu habis · sesi disimpan');
    } else {
      this.toast('Sesi disimpan');
      this.openSession(s.id);
    }
  },

  afterFinish() {
    this.applyEngine();
    this.syncFile();
    this.refreshLocs();
    this.buildTiles();
    this.updateWake();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  },

  addEvent(cls, dir, src) {
    const s = this.cur;
    if (!s || !Ses.running(s)) return false;
    s.ev.push([Date.now() - s.start, cls, dir, src]);
    if (Prefs.sound) Fx.beep(dir === 2 ? 620 : dir === 1 ? 880 : 760, .09);
    if (Prefs.vib) Fx.buzz(25);
    if (!Prefs.cls[cls] && !$(`#cTiles .ctile[data-c="${cls}"]`)) this.buildTiles();
    this.renderCount();
    const t = $(`#cTiles .ctile[data-c="${cls}"]`);
    if (t) {
      t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump');
      const f = document.createElement('span');
      f.className = 'float'; f.textContent = '+1';
      t.appendChild(f);
      setTimeout(() => f.remove(), 700);
    }
    const tot = $('#cTotal');
    tot.classList.remove('bump'); void tot.offsetWidth; tot.classList.add('bump');
    this.saveSoon();
    return true;
  },

  tap(cls, el) {
    Fx.unlock();
    if (!this.cur) {
      const g = $('#btnGo');
      g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
      this.toast('Tekan Mulai dulu');
      return;
    }
    if (!Ses.running(this.cur)) { this.toast('Sesi dijeda. Tekan Lanjut'); return; }
    this.addEvent(cls, Prefs.mode === 'manual' ? Prefs.tapDir : 0, 1);
  },

  undo() {
    const s = this.cur;
    if (!s || !s.ev.length) return;
    const e = s.ev.pop();
    this.renderCount();
    this.saveSoon();
    if (Prefs.vib) Fx.buzz([15, 40, 15]);
    this.toast('Dibatalkan: ' + CLASSES[e[1]].t + (e[2] ? ' ' + DIRS[e[2]] : ''));
  },

  tick() {
    const s = this.cur;
    if (s && Ses.running(s)) {
      if (s.limit && Ses.dur(s) >= s.limit) { this.finish(true); return; }
      if (!this._lastSave || Date.now() - this._lastSave > CONFIG.AUTOSAVE_MS) { this._lastSave = Date.now(); this.persist(s); }
    }
    if (this.view === 'count') this.renderTimer();
    else if (this.view === 'session' && s && this.sesId === s.id && Ses.running(s) && (!this._sr || Date.now() - this._sr > 5000)) { this._sr = Date.now(); this.renderSession(); }
  },

  onVisibility() {
    if (document.hidden) {
      if (this.cur) {
        if (Ses.running(this.cur) && Prefs.mode === 'auto' && Engine.source === 'camera') { this.pause(true); this._autoPaused = true; }
        this.persist(this.cur);
      }
    } else {
      if (this._autoPaused) { this._autoPaused = false; this.toast('Dijeda karena aplikasi ditinggalkan'); }
      if (Engine.source === 'camera' && Engine.video.paused) Engine.video.play().catch(() => {});
      this.updateWake();
    }
  },

  onKey(e) {
    if (e.key === 'Escape') {
      if (this.sheet) this.closeSheet();
      else if (this.menus.some(m => m.isOpen)) Menu.closeAll();
      else if (this.view === 'session' || this.view === 'settings') history.back();
      return;
    }
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (this.view !== 'count' || this.sheet || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-6]$/.test(e.key)) {
      const t = $$('#cTiles .ctile')[+e.key - 1];
      if (t) { e.preventDefault(); this.tap(+t.dataset.c, t); }
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault(); this.goBtn();
    } else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') {
      e.preventDefault(); this.undo();
    }
  },

  // ---------- Sheet & dialog ----------
  openSheet(id) {
    if (this.sheet && this.sheet !== id) $('#' + this.sheet).hidden = true;
    this.sheet = id;
    $('#' + id).hidden = false;
    document.body.classList.add('has-sheet');
    if (id === 'startSheet' && innerWidth >= 640) setTimeout(() => $('#inLoc').focus(), 50);
  },

  closeSheet() {
    if (!this.sheet) return;
    $('#' + this.sheet).hidden = true;
    this.sheet = '';
    document.body.classList.remove('has-sheet');
    this.answer(null);
  },

  answer(v) {
    const r = this._ans;
    this._ans = null;
    if (v !== null && this.sheet === 'confirmSheet') { $('#confirmSheet').hidden = true; this.sheet = ''; document.body.classList.remove('has-sheet'); }
    if (r) r(v);
  },

  confirm(o) {
    this.answer(null);
    const icn = $('#cIcon');
    icn.className = 'confirm-ic' + (o.bad ? ' bad' : '');
    icn.innerHTML = ic(o.icon);
    $('#cTitle').textContent = o.title;
    $('#cBox').innerHTML = o.rows;
    $('#cWarn').hidden = !o.warn;
    $('#cWarn span').textContent = o.warn || '';
    const set = (b, x, cls) => {
      b.hidden = !x;
      if (!x) return;
      b.className = 'btn ' + (x.cls || cls);
      b.innerHTML = (x.ic ? ic(x.ic) : '') + `<span>${esc(x.t)}</span>`;
    };
    set($('#cNo'), o.no, 'btn-soft');
    set($('#cYes'), o.yes, 'btn-primary');
    $('#cActions').hidden = !o.no && !o.yes;
    $('#cActions').classList.toggle('one', !o.no || !o.yes);
    return new Promise(res => { this._ans = res; this.openSheet('confirmSheet'); });
  },

  openEdit(id) {
    const s = this.byId(id);
    if (!s) return;
    this.editId = id;
    $('#inELoc').value = s.loc || '';
    $('#inNote').value = s.note || '';
    this.openSheet('editSheet');
  },

  async saveEdit() {
    const s = this.byId(this.editId);
    if (!s) { this.closeSheet(); return; }
    s.loc = $('#inELoc').value.replace(/\s+/g, ' ').trim();
    s.note = $('#inNote').value.trim();
    this.closeSheet();
    await this.persist(s);
    this.refreshLocs();
    this.render();
    this.toast('Tersimpan');
  },

  async deleteSession() {
    const s = this.byId(this.sesId);
    if (!s || s === this.cur) return;
    const ok = await this.confirm({ icon: 'trash', bad: true, title: 'Hapus sesi?', rows: this.sesBox(s), no: { t: 'Tidak' }, yes: { t: 'Ya, hapus', ic: 'trash', cls: 'btn-bad' } });
    if (ok !== 'yes') return;
    try { await DB.del(s.id); } catch (e) { this.toast('Gagal menghapus'); return; }
    this.sessions = this.sessions.filter(x => x !== s);
    this.refreshLocs();
    history.back();
    this.toast('Sesi dihapus');
  },

  async wipe() {
    if (!this.sessions.length) { this.toast('Belum ada data'); return; }
    const a = this.agg(this.sessions);
    const ok = await this.confirm({
      icon: 'trash', bad: true, title: 'Hapus semua data?',
      rows: `<div class="c-row">${ic('list')}<span class="c-val">${fmt(a.n)} sesi</span><span class="c-sub">${F.count(a.total)} kendaraan</span></div>`,
      warn: 'Tidak bisa dikembalikan. Unduh CSV dulu jika perlu.',
      no: { t: 'Tidak' }, yes: { t: 'Hapus semua', ic: 'trash', cls: 'btn-bad' }
    });
    if (ok !== 'yes') return;
    try { await DB.clear(); } catch (e) { this.toast('Gagal menghapus'); return; }
    this.sessions = [];
    this.cur = null;
    this.afterFinish();
    this.renderSettings();
    this.toast('Semua data dihapus');
  },

  // ---------- Ekspor ----------
  download(name, rows) {
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  q(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; },
  n2(v) { return v === null || !isFinite(v) ? '' : (Math.round(v * 100) / 100).toString(); },

  exportSummary(list) {
    if (!list.length) { this.toast('Belum ada data'); return; }
    const q = this.q;
    const rows = [['Tanggal', 'Mulai', 'Selesai', 'Durasi (menit)', 'Lokasi', 'Mode'].concat(CLASSES.map(c => c.t), ['Total', 'A→B', 'B→A', 'Tanpa arah', 'Dari tap', 'Per jam', 'SMP/jam', 'Lat', 'Lng', 'Catatan']).map(q).join(',')];
    list.slice().sort((a, b) => a.start - b.start).forEach(s => {
      const st = Ses.stat(s), dur = Ses.dur(s);
      rows.push([q(F.stamp(s.start).slice(0, 10)), q(F.time(s.start).replace('.', ':')), q(s.end ? F.time(s.end).replace('.', ':') : ''), this.n2(dur / 60000), q(Ses.name(s)), q(Ses.usesAi(s) ? 'Kamera AI' : 'Manual')]
        .concat(st.counts, [st.total, st.dir[1], st.dir[2], st.dir[0], st.manual, this.n2(Ses.perHour(st.total, dur)), this.n2(Ses.perHour(Ses.smp(st.counts), dur)), s.geo ? s.geo.lat.toFixed(6) : '', s.geo ? s.geo.lng.toFixed(6) : '', q(s.note || '')]).join(','));
    });
    this.download(`hitungin-ringkasan-${F.ymd(Date.now())}.csv`, rows);
  },

  exportEvents(list) {
    const all = list.filter(s => s.ev.length);
    if (!all.length) { this.toast('Belum ada data'); return; }
    const q = this.q;
    const rows = [['Waktu', 'Lokasi', 'Jenis', 'Arah', 'Sumber', 'Sesi'].map(q).join(',')];
    all.slice().sort((a, b) => a.start - b.start).forEach(s => {
      s.ev.forEach(e => rows.push([q(F.stamp(s.start + e[0], true)), q(Ses.name(s)), q(CLASSES[e[1]].t), q(DIRS[e[2]]), q(e[3] ? 'Tap' : 'AI'), q(s.id)].join(',')));
    });
    this.download(`hitungin-detail-${F.ymd(Date.now())}.csv`, rows);
  },

  exportIntervals() {
    const s = this.byId(this.sesId);
    if (!s) return;
    const int = this.sInt || 15;
    const q = this.q;
    const rows = [['Mulai', 'Selesai'].concat(CLASSES.map(c => c.t), ['Total', 'A→B', 'B→A', 'SMP']).map(q).join(',')];
    const sum = new Array(CLASSES.length).fill(0), dir = [0, 0, 0];
    this.intervals(s, int).forEach(r => {
      r.counts.forEach((n, i) => { sum[i] += n; });
      dir[1] += r.dir[1]; dir[2] += r.dir[2];
      rows.push([q(F.stamp(r.a)), q(F.stamp(r.b))].concat(r.counts, [r.n, r.dir[1], r.dir[2], this.n2(Ses.smp(r.counts))]).join(','));
    });
    rows.push([q('Total'), q('')].concat(sum, [s.ev.length, dir[1], dir[2], this.n2(Ses.smp(sum))]).join(','));
    const d = new Date(s.start);
    this.download(`hitungin-${F.slug(Ses.name(s))}-${F.ymd(s.start)}-${pad(d.getHours())}${pad(d.getMinutes())}-${int}mnt.csv`, rows);
  },

  shareText(s) {
    const st = Ses.stat(s), dur = Ses.dur(s);
    const r = Ses.perHour(st.total, dur), smp = Ses.perHour(Ses.smp(st.counts), dur);
    const lines = [
      `Hitungin · ${Ses.name(s)}`,
      `${F.full(s.start)} · ${F.time(s.start)}–${s.end ? F.time(s.end) : 'sekarang'} (${F.dur(dur)})`,
      `Total ${fmt(st.total)} kendaraan${r !== null ? ` (${F.rate(r)}/jam)` : ''}`,
      CLASSES.map((c, i) => st.counts[i] ? `${c.t} ${fmt(st.counts[i])}` : '').filter(Boolean).join(' · ')
    ];
    if (st.dir[1] + st.dir[2]) lines.push(`A→B ${fmt(st.dir[1])} · B→A ${fmt(st.dir[2])}`);
    if (smp !== null) lines.push(`SMP/jam ${F.rate(smp)}`);
    if (s.geo) lines.push(`https://www.google.com/maps?q=${s.geo.lat.toFixed(6)},${s.geo.lng.toFixed(6)}`);
    if (s.note) lines.push(s.note);
    return lines.filter(Boolean).join('\n');
  },

  async share() {
    const s = this.byId(this.sesId);
    if (!s) return;
    const text = this.shareText(s);
    if (navigator.share) {
      try { await navigator.share({ title: 'Hitungin · ' + Ses.name(s), text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); this.toast('Ringkasan disalin'); } catch (e) { this.toast('Tidak bisa membagikan'); }
  },

  // ---------- Pengaturan ----------
  async setProc(p) {
    if (p === Prefs.proc) return;
    Prefs.put('proc', p);
    this.applyEngine();
    this.renderSettings();
    if (Engine.source && Engine.det) { Engine.unload(); await this.loadModel(); }
  },

  async rebench() {
    Object.keys(CONFIG.MODELS).forEach(k => Store.del('bench:' + k));
    if (Engine.source) { Engine.unload(); await this.loadModel(); this.toast('Kecepatan diuji ulang'); }
    else this.toast('Diuji saat kamera dinyalakan');
    this.renderSettings();
  },

  async setModel(k) {
    if (k === Prefs.model) return;
    Prefs.put('model', k);
    this.renderSettings();
    if (Engine.source) await this.loadModel();
  },

  renderThr() {
    const el = $('#inThr');
    el.value = Prefs.thr;
    el.style.setProperty('--p', ((Prefs.thr - 25) / 55 * 100) + '%');
    $('#thrVal').textContent = Prefs.thr + '%';
  },

  async renderSettings() {
    $$('#modelSeg button').forEach(b => b.classList.toggle('on', b.dataset.model === Prefs.model));
    $$('#fpsSeg button').forEach(b => b.classList.toggle('on', b.dataset.fps === Prefs.fps));
    $$('#procSeg button').forEach(b => b.classList.toggle('on', b.dataset.proc === Prefs.proc));
    const bm = Store.json('bench:' + Prefs.model, null);
    const speed = [];
    if (bm && bm.g) speed.push('GPU ' + bm.g + ' ms');
    if (bm && bm.c) speed.push('CPU ' + bm.c + ' ms');
    $('#benchInfo').textContent = speed.length ? 'Waktu per deteksi: ' + speed.join(' · ') + '. Makin kecil makin cepat.' : 'Otomatis memilih GPU atau CPU yang lebih cepat di HP ini.';
    $$('#dirSeg button').forEach(b => b.classList.toggle('on', +b.dataset.dirs === Prefs.dirs));
    this.renderThr();
    $('#clsToggles').innerHTML = CLASSES.map((c, i) => `<button type="button" data-c="${i}" class="${Prefs.cls[i] ? 'on' : ''}" style="--cc:var(--c${i})" aria-pressed="${Prefs.cls[i]}"><span>${ic(c.ic)}</span>${esc(c.t)}</button>`).join('');
    $('#swSound').setAttribute('aria-checked', String(Prefs.sound));
    $('#swVib').setAttribute('aria-checked', String(Prefs.vib));
    $('#swBoxes').setAttribute('aria-checked', String(Prefs.boxes));
    if (!$('#empGrid').children.length) {
      $('#empGrid').innerHTML = CLASSES.map((c, i) => `<div class="emp" data-c="${i}" style="--cc:var(--c${i})">${ic(c.ic)}<label for="emp${i}">${esc(c.t)}</label><input id="emp${i}" inputmode="decimal" value="${F.num(Prefs.emp[i], 2)}" /></div>`).join('');
    }
    $('#dataSub').textContent = fmt(this.sessions.length) + ' sesi';
    const ms = $('#modelState');
    const cached = await Model.has(CONFIG.MODELS[Prefs.model]);
    const active = Engine.det && Engine.modelKey === Prefs.model;
    ms.className = 'model-state' + (cached ? ' ok' : '');
    ms.innerHTML = cached ? `${ic('check')}<span>Tersimpan, bisa dipakai offline${active ? ' · aktif (' + (Engine.delegate === 'GPU' ? 'GPU' : 'CPU') + ')' : ''}</span>` : `${ic('download')}<span>Diunduh saat kamera pertama kali dinyalakan</span>`;
  },

  async install() {
    if (!this.installEvt) return;
    this.installEvt.prompt();
    try { await this.installEvt.userChoice; } catch (e) {}
    this.installEvt = null;
    $('#btnInstall').hidden = true;
  },

  initTip() {
    const tip = $('#tip');
    const showFor = (col) => {
      if (!col) return;
      const bar = col.querySelector('span') || col;
      const r = bar.getBoundingClientRect();
      const cr = col.getBoundingClientRect();
      tip.querySelector('b').textContent = col.dataset.v;
      tip.querySelector('span').textContent = col.dataset.l;
      tip.hidden = false;
      const w = tip.offsetWidth;
      const x = Math.min(Math.max(cr.left + cr.width / 2, w / 2 + 8), innerWidth - w / 2 - 8);
      tip.style.left = x + 'px';
      tip.style.top = Math.max(r.top, 60) + 'px';
    };
    document.addEventListener('pointerover', (e) => { const c = e.target.closest('.col'); if (c) showFor(c); });
    document.addEventListener('pointerout', (e) => { const c = e.target.closest('.col'); if (c && !c.contains(e.relatedTarget)) this.hideTip(); });
    document.addEventListener('focusin', (e) => { const c = e.target.closest('.col'); if (c) showFor(c); });
    document.addEventListener('focusout', (e) => { if (e.target.closest('.col')) this.hideTip(); });
    addEventListener('scroll', () => this.hideTip(), { passive: true });
  },
  hideTip() { const t = $('#tip'); if (t) t.hidden = true; },

  loading(on) { $('#loader').hidden = !on; },

  toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this._t);
    this._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
};

App.init();
