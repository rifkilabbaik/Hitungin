// Jenis kendaraan. Urutan ini dipakai sebagai indeks di data sesi, jadi jangan diubah.
const CLASSES = [
  { k: 'motor', coco: 'motorcycle', t: 'Motor', ic: 'moto', emp: 0.25, on: true, g: 0 },
  { k: 'mobil', coco: 'car', t: 'Mobil', ic: 'car', emp: 1, on: true, g: 1 },
  { k: 'bus', coco: 'bus', t: 'Bus', ic: 'bus', emp: 1.2, on: true, g: 1 },
  { k: 'truk', coco: 'truck', t: 'Truk', ic: 'truck', emp: 1.2, on: true, g: 1 },
  { k: 'sepeda', coco: 'bicycle', t: 'Sepeda', ic: 'bike', emp: 0, on: true, g: 0 },
  { k: 'orang', coco: 'person', t: 'Orang', ic: 'walk', emp: 0, on: false, g: 2 }
];
const COCO = {};
CLASSES.forEach((c, i) => { COCO[c.coco] = i; });

const Geo = {
  inter(a, b) {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  },
  iou(a, b) {
    const i = Geo.inter(a, b);
    return i ? i / (a.w * a.h + b.w * b.h - i) : 0;
  },
  segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    return Math.hypot(px - (x1 + u * dx), py - (y1 + u * dy));
  }
};

// Rapikan hasil deteksi: satu kendaraan bisa terbaca dua jenis (mobil & truk),
// dan pengendara motor/sepeda terbaca sebagai orang.
function cleanDets(raw) {
  const list = raw.slice().sort((a, b) => b.score - a.score);
  const kept = [];
  for (const d of list) {
    if (CLASSES[d.cls].g === 2) { kept.push(d); continue; }
    if (kept.some(k => CLASSES[k.cls].g !== 2 && Geo.iou(k, d) > 0.6)) continue;
    kept.push(d);
  }
  const twoWheel = kept.filter(d => CLASSES[d.cls].g === 0);
  return kept.filter(d => CLASSES[d.cls].g !== 2 || !twoWheel.some(w => Geo.inter(w, d) / (d.w * d.h) > 0.2));
}

class Tracker {
  constructor() {
    this.tracks = [];
    this.next = 1;
    this.W = 1; this.H = 1;
    // Bawaan tegak: kamera di pinggir jalan, kendaraan melintas kiri-kanan. Sisi A di kiri.
    this.line = { x1: 0.5, y1: 0.36, x2: 0.5, y2: 0.97 };
    this.armed = false;
    this.dirs = 3;
    this.maxAge = 1100;
  }
  reset() { this.tracks = []; }
  setSize(w, h) { this.W = w || 1; this.H = h || 1; }
  linePx() {
    const l = this.line;
    return [l.x1 * this.W, l.y1 * this.H, l.x2 * this.W, l.y2 * this.H];
  }

  update(dets, t) {
    const out = [];
    const tr = this.tracks;
    for (const a of tr) {
      const dt = Math.min(t - a.t, 400);
      a.px = a.cx + a.vx * dt;
      a.py = a.cy + a.vy * dt;
    }
    const pairs = [];
    for (let i = 0; i < tr.length; i++) {
      const a = tr[i];
      const sa = Math.sqrt(a.w * a.h);
      const pb = { x: a.px - a.w / 2, y: a.py - a.h / 2, w: a.w, h: a.h };
      for (let j = 0; j < dets.length; j++) {
        const d = dets[j];
        const sd = Math.sqrt(d.w * d.h);
        const r = sd / sa;
        if (r > 2.2 || r < 0.45) continue;
        let dist = Math.hypot(d.x + d.w / 2 - a.px, d.y + d.h / 2 - a.py) / Math.max(sa, sd);
        // Jejak yang menunggu konfirmasi juga dicocokkan ke posisi terakhirnya: kalau ternyata diam, hitungannya batal.
        if (a.pend) dist = Math.min(dist, Math.hypot(d.x + d.w / 2 - a.cx, d.y + d.h / 2 - a.cy) / Math.max(sa, sd));
        const ov = Geo.iou(pb, d);
        // Jejak baru belum punya kecepatan, jadi jarak cocok pertama dibuat lebih longgar.
        if (dist > (a.hits === 1 ? 1.9 : 1.15) && ov < 0.1) {
          const ac = this.axisCost(a, d, t, r);
          if (ac) pairs.push([ac[0], i, j, ac[1]]);
          continue;
        }
        let cost = dist - ov;
        if (CLASSES[d.cls].g !== CLASSES[a.cls].g) cost += 0.6;
        pairs.push([cost, i, j, 0]);
      }
    }
    pairs.sort((p, q) => p[0] - q[0]);
    const usedT = new Set(), usedD = new Set();
    for (const [, i, j, jump] of pairs) {
      if (usedT.has(i) || usedD.has(j)) continue;
      usedT.add(i); usedD.add(j);
      this.hit(tr[i], dets[j], t, out, jump);
    }
    dets.forEach((d, j) => { if (!usedD.has(j)) tr.push(this.spawn(d, t)); });
    const keep = tr.filter(a => t - a.t < this.maxAge);
    for (const a of tr) {
      if (t - a.t < this.maxAge) continue;
      // Jejak hilang (keluar layar/tertutup): hitungan tertunda dikonfirmasi, kecuali masih ada
      // kendaraan di posisi terakhirnya (berarti tadi salah pasang dengan kendaraan yang diam).
      if (a.pend) {
        const r = 0.6 * Math.sqrt(a.w * a.h);
        if (!keep.some(b => Math.hypot(b.cx - a.cx, b.cy - a.cy) < r)) this.emit(a, a.pend.dir, t, out);
        a.pend = null;
      } else if (!a.counted && a.hits > 1) this.cross(a, t, out, a.cx, a.cy);
    }
    this.tracks = keep;
    return out;
  }

  // Pada fps rendah kendaraan cepat bisa berpindah jauh lebih dari ukurannya antar frame.
  // Garis hitung dipasang melintang jalan, jadi kendaraan bergerak tegak lurus garis.
  // Pergeseran besar diterima bila searah itu (bukan pindah lajur), jenis & ukuran mirip,
  // kecepatan masuk akal, dan searah gerak sebelumnya. Hasil: [biaya, lompatan melintasi garis].
  axisCost(a, d, t, r) {
    if (CLASSES[d.cls].g !== CLASSES[a.cls].g || r > 1.8 || r < 0.55) return null;
    const dt = t - a.t;
    if (dt <= 0 || dt > 700) return null;
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    if (Math.hypot(cx - a.cx, cy - a.cy) > 3 * Math.max(this.W, this.H) * dt / 1000) return null;
    if (a.hits >= 2 && a.vx * (cx - a.cx) + a.vy * (cy - a.cy) < 0) return null;
    const [x1, y1, x2, y2] = this.linePx();
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ex = (x2 - x1) / len, ey = (y2 - y1) / len;
    const ddx = cx - a.px, ddy = cy - a.py;
    const along = Math.abs(ddx * ex + ddy * ey), perp = Math.abs(ddy * ex - ddx * ey);
    const size = (Math.sqrt(a.w * a.h) + Math.sqrt(d.w * d.h)) / 2;
    if (along > 0.6 * size + 0.2 * perp) return null;
    const s0 = this.sideAt(a.sx, a.sy, a)[0], s1 = this.sideAt(cx, cy, d)[0];
    const crosses = !!(s0 && s1 && s0 !== s1);
    if (crosses && a.hits >= 3 && Math.hypot(a.vx, a.vy) * 1000 < 0.25 * Math.sqrt(a.w * a.h)) return null;
    return [1.5 + along / size + 0.3 * perp / size, crosses && !a.counted ? 1 : 0];
  }

  // [sisi (1/-1/0 di dalam pita), posisi sepanjang garis (0..1), jarak bertanda, panjang garis]
  sideAt(px, py, o) {
    const [x1, y1, x2, y2] = this.linePx();
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const sd = (dx * (py - y1) - dy * (px - x1)) / len;
    const u = ((px - x1) * dx + (py - y1) * dy) / (len * len);
    const band = Math.max(4, Math.min(o.w, o.h) * 0.15);
    return [sd > band ? 1 : sd < -band ? -1 : 0, u, sd, len];
  }

  spawn(d, t) {
    const a = {
      id: this.next++, cx: d.x + d.w / 2, cy: d.y + d.h / 2, sx: d.x + d.w / 2, sy: d.y + d.h / 2, w: d.w, h: d.h, vx: 0, vy: 0,
      votes: { [d.cls]: d.score }, cls: d.cls, score: d.score, hits: 1, t, t0: t,
      side: 0, su: 0.5, counted: false, box: d
    };
    this.cross(a, t, null);
    if (!a.side) { const [, u, sd] = this.sideAt(a.cx, a.cy, a); a.b0 = { u, sd }; }
    a.bx = a.cx; a.by = a.cy;
    return a;
  }

  hit(a, d, t, out, jump) {
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    const dt = Math.max(t - a.t, 1);
    const vx = (cx - a.cx) / dt, vy = (cy - a.cy) / dt;
    // Jejak yang baru sekali terlihat lalu bergeser jauh belum tentu kendaraan yang sama:
    // penyeberangan garisnya ikut menunggu konfirmasi.
    if (!jump && a.hits === 1 && Math.hypot(cx - a.cx, cy - a.cy) > 0.8 * Math.sqrt(a.w * a.h)) jump = 1;
    // Filter alfa-beta: halus untuk kendaraan diam, tidak tertinggal untuk kendaraan bergerak.
    // Pada deteksi kedua (atau setelah lompatan) pakai posisi asli.
    const pdt = Math.min(dt, 400);
    a.sx = a.hits > 1 && !jump ? (a.sx + a.vx * pdt) * 0.45 + cx * 0.55 : cx;
    a.sy = a.hits > 1 && !jump ? (a.sy + a.vy * pdt) * 0.45 + cy * 0.55 : cy;
    a.vx = a.hits > 1 ? a.vx * 0.55 + vx * 0.45 : vx;
    a.vy = a.hits > 1 ? a.vy * 0.55 + vy * 0.45 : vy;
    a.cx = cx; a.cy = cy;
    a.w = a.w * 0.4 + d.w * 0.6;
    a.h = a.h * 0.4 + d.h * 0.6;
    a.box = d;
    a.votes[d.cls] = (a.votes[d.cls] || 0) + d.score;
    let best = a.cls;
    for (const k in a.votes) if (a.votes[k] > (a.votes[best] || 0)) best = +k;
    a.cls = best;
    a.score = d.score;
    a.hits++;
    a.t = t;
    if (a.pend && !jump) this.confirm(a, t, out);
    this.cross(a, t, out, a.sx, a.sy, jump);
  }

  // Hitungan dari lompatan jauh baru sah bila kendaraan terus menjauhi garis di sisi barunya.
  // Bila malah diam atau balik, itu salah pasang (mis. dua kendaraan macet di kedua sisi garis).
  confirm(a, t, out) {
    const p = a.pend;
    const [s, , sd] = this.sideAt(a.cx, a.cy, a);
    const to = p.dir === 1 ? -1 : 1;
    const size = Math.sqrt(a.w * a.h);
    if (s === to && Math.abs(sd) >= p.d0 + 0.25 * size) { a.pend = null; this.emit(a, p.dir, t, out); }
    else if (s === -to || ++p.n >= 3) { a.pend = null; a.counted = false; }
  }

  emit(a, dir, t, out) {
    if (!out || !this.armed) return;
    a.flash = t;
    out.push({ cls: a.cls, dir, x: a.cx, y: a.cy, id: a.id });
  }

  // Sisi garis memakai posisi yang dihaluskan dan pita toleransi, agar kendaraan
  // yang berhenti atau bergetar di atas garis tidak ikut terhitung.
  cross(a, t, out, px = a.sx, py = a.sy, jump) {
    const [s, u, sd] = this.sideAt(px, py, a);
    if (!s) return;
    let from = a.side;
    // Pertama kali terlihat tepat di atas garis (mis. baru lepas dari halangan kendaraan lain),
    // lalu bergerak jelas ke satu sisi: berarti datang dari sisi lawannya.
    if (!from && a.b0 && out && Math.abs(sd - a.b0.sd) >= 0.5 * Math.sqrt(a.w * a.h)) { from = -s; a.su = a.b0.u; }
    if (from) a.b0 = null;
    if (out && from && s !== from && !a.counted && this.armed) {
      const um = (u + a.su) / 2;
      if (um >= -0.04 && um <= 1.04) {
        const dir = from === 1 ? 1 : 2;
        a.counted = true;
        if (!(this.dirs & dir)) a.skip = true;
        else if (jump) a.pend = { dir, d0: Math.abs(sd), n: 0 };
        else this.emit(a, dir, t, out);
      }
    }
    a.side = s;
    a.su = u;
  }

  resync() {
    for (const a of this.tracks) { a.side = 0; a.b0 = null; this.cross(a, a.t, null); }
  }
}

const Model = {
  CACHE: 'hitungin-model-v1',
  async has(url) {
    try { const c = await caches.open(this.CACHE); return !!(await c.match(url)); } catch (e) { return false; }
  },
  async get(url, onProg) {
    let c = null;
    try {
      c = await caches.open(this.CACHE);
      const hit = await c.match(url);
      if (hit) return await hit.arrayBuffer();
    } catch (e) {}
    let res;
    try { res = await fetch(url, { mode: 'cors' }); } catch (e) {
      throw new Error(navigator.onLine ? 'Model AI gagal diunduh, coba lagi' : 'Butuh internet untuk mengunduh model AI pertama kali');
    }
    if (!res.ok) throw new Error('Model AI gagal diunduh (' + res.status + ')');
    const total = +res.headers.get('content-length') || 0;
    let buf;
    if (res.body && total && onProg) {
      const reader = res.body.getReader();
      const parts = [];
      let n = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        n += value.length;
        onProg(Math.min(1, n / total));
      }
      const all = new Uint8Array(n);
      let o = 0;
      for (const p of parts) { all.set(p, o); o += p.length; }
      buf = all.buffer;
    } else {
      buf = await res.arrayBuffer();
    }
    if (c) c.put(url, new Response(buf.slice(0), { headers: { 'Content-Type': 'application/octet-stream' } })).catch(() => {});
    return buf;
  },
  async clear() { try { await caches.delete(this.CACHE); } catch (e) {} }
};

const Engine = {
  video: null, canvas: null, ctx: null,
  stream: null, track: null, url: '', source: '', fileName: '', facing: 'environment', deviceId: '', cams: [], zoom: null,
  vision: null, fileset: null, det: null, delegate: '', modelKey: '', _loading: null, _loadingKey: '',
  tracker: new Tracker(),
  interval: 66, thr: 0.45, enabled: CLASSES.map(c => c.on), showBoxes: true, armed: false,
  on: false, raf: 0, lastDet: 0, lastVT: -1, fps: 0, inferMs: 0, stamps: [], pops: [], flashAt: 0,
  colors: { primary: '#EA580C', sun: '#FFC23D', cls: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'] },
  drag: null,
  onCount: null, onLine: null, onEnded: null, onSize: null, onError: null,

  init(video, canvas) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const size = () => { if (video.videoWidth && this.onSize) this.onSize(video.videoWidth, video.videoHeight); };
    video.addEventListener('loadedmetadata', size);
    video.addEventListener('resize', size);
    video.addEventListener('ended', () => { if (this.source === 'file' && this.onEnded) this.onEnded(); });
    this.initPointer();
  },

  setLine(l) { if (l && [l.x1, l.y1, l.x2, l.y2].every(v => typeof v === 'number' && v >= 0 && v <= 1)) this.tracker.line = Object.assign({}, l); },

  // opt.deviceId: lensa tertentu (mis. ultra-wide 0,5x). opt.facing: 'environment' | 'user'.
  async startCamera(opt = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(location.protocol === 'https:' || location.hostname === 'localhost' ? 'Browser ini tidak mendukung kamera' : 'Kamera butuh HTTPS');
    }
    const want = opt.facing || this.facing;
    const dev = opt.deviceId || '';
    const video = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    if (dev) video.deviceId = { exact: dev }; else video.facingMode = { ideal: want };
    // Minta izin zoom: di sebagian HP lensa 0,5x/0,6x tersedia sebagai zoom di bawah 1.
    video.zoom = true;
    // HP umumnya tidak bisa membuka dua kamera sekaligus, jadi kamera lama dilepas dulu.
    this.stopSource();
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch (e) {
      const n = e && e.name;
      if (dev && (n === 'OverconstrainedError' || n === 'NotFoundError')) return this.startCamera({ facing: want });
      if (n === 'NotAllowedError' || n === 'SecurityError') throw new Error('Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser.');
      if (n === 'NotFoundError' || n === 'OverconstrainedError') throw new Error('Kamera tidak ditemukan');
      if (n === 'NotReadableError' || n === 'AbortError') throw new Error('Kamera sedang dipakai aplikasi lain');
      throw new Error('Kamera gagal dibuka');
    }
    this.stream = s;
    this.source = 'camera';
    const track = s.getVideoTracks()[0];
    this.track = track;
    const st = (track && track.getSettings && track.getSettings()) || {};
    const caps = (track && track.getCapabilities && track.getCapabilities()) || {};
    this.deviceId = st.deviceId || dev;
    this.facing = st.facingMode ? (st.facingMode === 'user' ? 'user' : 'environment') : want;
    this.zoom = caps.zoom && caps.zoom.max > caps.zoom.min ? { min: caps.zoom.min, max: caps.zoom.max, cur: st.zoom || Math.max(1, caps.zoom.min) } : null;
    const v = this.video;
    v.removeAttribute('src');
    v.loop = false;
    v.srcObject = s;
    await v.play().catch(() => {});
    this.tracker.reset();
    this.run();
    try {
      this.cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').map(d => ({ id: d.deviceId, label: d.label || '' }));
    } catch (e) { this.cams = []; }
  },

  async setZoom(z) {
    if (!this.track || !this.zoom) return false;
    z = Math.max(this.zoom.min, Math.min(this.zoom.max, z));
    try { await this.track.applyConstraints({ advanced: [{ zoom: z }] }); this.zoom.cur = z; return true; } catch (e) { return false; }
  },

  // Video dari file berhenti di frame pertama. Diputar saat sesi berjalan (lihat playFile).
  async openFile(file) {
    this.stopSource();
    const v = this.video;
    this.url = URL.createObjectURL(file);
    v.srcObject = null;
    v.loop = false;
    this.source = 'file';
    this.fileName = file.name || 'Video';
    try {
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timeout')), 15000);
        v.onloadeddata = () => { clearTimeout(t); res(); };
        v.onerror = () => { clearTimeout(t); rej(new Error('error')); };
        v.src = this.url;
        v.load();
      });
    } catch (e) {
      v.onloadeddata = v.onerror = null;
      this.stopSource();
      throw new Error('Video tidak bisa diputar di browser ini');
    }
    v.onloadeddata = v.onerror = null;
    v.pause();
    this.tracker.reset();
    this.run();
  },

  playFile(on) {
    const v = this.video;
    if (this.source !== 'file' || !v) return;
    if (on && !v.ended) v.play().catch(() => {});
    else if (!on && !v.paused) v.pause();
  },

  stopSource() {
    this.on = false;
    cancelAnimationFrame(this.raf);
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.track = null;
    this.zoom = null;
    this.motion = { par: 0, perp: 0, hinted: false };
    const v = this.video;
    if (v) {
      v.pause();
      v.srcObject = null;
      if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); }
    }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = ''; }
    this.source = '';
    this.tracker.reset();
    this.pops = [];
    this.stamps = [];
    this.fps = 0;
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },

  async load(key, onProg) {
    if (this.det && this.modelKey === key) return;
    if (this._loading) {
      if (this._loadingKey === key) return this._loading;
      await this._loading.catch(() => {});
      if (this.det && this.modelKey === key) return;
    }
    this._loadingKey = key;
    this._loading = this._load(key, onProg);
    try { await this._loading; } finally { this._loading = null; }
  },

  async _load(key, onProg) {
    const prog = (p, s) => { if (onProg) onProg(p, s); };
    prog(0.02, 'Menyiapkan mesin AI');
    try {
      if (!this.vision) this.vision = await import(CONFIG.MP_BUNDLE);
      if (!this.fileset) this.fileset = await this.vision.FilesetResolver.forVisionTasks(CONFIG.MP_WASM);
    } catch (e) {
      throw new Error(navigator.onLine ? 'Mesin AI gagal dimuat, coba lagi' : 'Butuh internet untuk memuat AI pertama kali');
    }
    prog(0.08, 'Mengunduh model');
    const buf = await Model.get(CONFIG.MODELS[key], (p) => prog(0.08 + p * 0.6, 'Mengunduh model'));
    prog(0.7, 'Menguji kecepatan');
    let det = null;
    let pick = this.proc === 'gpu' ? 'GPU' : this.proc === 'cpu' ? 'CPU' : (Store.json('bench:' + key, null) || {}).d;
    const cpu = async () => {
      // Di CPU model int8 sekitar 30% lebih cepat daripada float16.
      const b8 = await Model.get(CONFIG.MODELS_INT8[key], (p) => prog(0.72 + p * 0.2, 'Mengunduh model CPU'));
      this.buf8 = b8;
      return this.warm(await this.create(b8, 'CPU'));
    };
    if (pick === 'CPU') det = await cpu();
    else if (pick === 'GPU') {
      try { det = this.warm(await this.create(buf, 'GPU')); } catch (e) { det = await cpu(); }
    } else {
      // Otomatis: ukur GPU dulu. Jika lambat, ukur CPU dan pakai yang lebih cepat.
      let g = null, gms = Infinity;
      try { g = this.warm(await this.create(buf, 'GPU')); gms = this.time(g); } catch (e) { g = null; }
      this.bench = { GPU: isFinite(gms) ? Math.round(gms) : null, CPU: null };
      if (g && gms <= 45) det = g;
      else {
        let c = null, cms = Infinity;
        try { c = await cpu(); cms = this.time(c); } catch (e) { c = null; }
        this.bench.CPU = isFinite(cms) ? Math.round(cms) : null;
        if (c && (!g || cms < gms)) { det = c; if (g) g.close(); } else { det = g; if (c) c.close(); }
        if (!det) throw new Error('AI tidak bisa berjalan di perangkat ini');
      }
      Store.setJson('bench:' + key, { d: det.__d, g: this.bench.GPU, c: this.bench.CPU });
    }
    if (det.__d) this.delegate = det.__d;
    if (this.det && this.det !== det) { try { this.det.close(); } catch (e) {} }
    this.det = det;
    this.buf = buf;
    this.modelKey = key;
    prog(1, '');
  },

  // Inferensi pertama lambat (kompilasi shader). Dipanaskan di sini agar tidak ada kendaraan
  // terlewat saat mulai menghitung, sekaligus mendeteksi GPU yang tidak bisa dipakai.
  warm(d) {
    const c = this.benchCanvas();
    d.detectForVideo(c, this.ts());
    d.detectForVideo(c, this.ts());
    return d;
  },

  time(d) {
    const c = this.benchCanvas();
    const t0 = performance.now();
    for (let i = 0; i < 3; i++) d.detectForVideo(c, this.ts());
    return (performance.now() - t0) / 3;
  },

  ts() { this._ts = Math.max((this._ts || 0) + 1, performance.now()); return this._ts; },

  benchCanvas() {
    if (this._bc) return this._bc;
    const c = document.createElement('canvas');
    c.width = 640; c.height = 360;
    const g = c.getContext('2d');
    g.fillStyle = '#6b6f73'; g.fillRect(0, 0, 640, 360);
    g.fillStyle = '#2b3a55'; g.fillRect(220, 170, 200, 110);
    g.fillStyle = '#111'; g.beginPath(); g.arc(260, 285, 22, 0, 7); g.arc(380, 285, 22, 0, 7); g.fill();
    return (this._bc = c);
  },

  unload() {
    if (this.det) { try { this.det.close(); } catch (er) {} }
    this.det = null;
    this.modelKey = '';
  },

  async create(buf, delegate) {
    const det = await this.vision.ObjectDetector.createFromOptions(this.fileset, {
      baseOptions: { modelAssetBuffer: new Uint8Array(buf.slice(0)), delegate },
      runningMode: 'VIDEO',
      scoreThreshold: 0.25,
      maxResults: 40,
      categoryAllowlist: CLASSES.map(c => c.coco)
    });
    this.delegate = delegate;
    det.__d = delegate;
    return det;
  },

  async fallbackCpu() {
    if (this._fb) return;
    this._fb = true;
    const old = this.det;
    this.det = null;
    try { if (old) old.close(); } catch (e) {}
    try {
      const b8 = this.buf8 || await Model.get(CONFIG.MODELS_INT8[this.modelKey]).catch(() => this.buf);
      this.det = await this.create(b8, 'CPU');
      Store.setJson('bench:' + this.modelKey, { d: 'CPU' });
    } catch (e) { if (this.onError) this.onError(new Error('AI tidak bisa berjalan di perangkat ini')); }
    this._fb = false;
  },

  run() {
    if (this.on) return;
    this.on = true;
    const tick = () => {
      if (!this.on) return;
      this.raf = requestAnimationFrame(tick);
      this.frame();
    };
    this.raf = requestAnimationFrame(tick);
  },

  frame() {
    const v = this.video;
    const now = performance.now();
    if (this.det && !this.drag && v.readyState >= 2 && v.videoWidth && !v.paused && !v.ended &&
        now - this.lastDet >= this.interval && v.currentTime !== this.lastVT) {
      this.lastDet = now;
      this.lastVT = v.currentTime;
      this.detect(now);
    }
    this.draw(now);
  },

  detect(now) {
    const v = this.video;
    this.tracker.setSize(v.videoWidth, v.videoHeight);
    let res;
    const t0 = performance.now();
    try {
      res = this.det.detectForVideo(v, this.ts());
    } catch (e) {
      if (this.delegate === 'GPU') this.fallbackCpu();
      else { this.det = null; if (this.onError) this.onError(new Error('Deteksi gagal: ' + (e && e.message || e))); }
      return;
    }
    const ms = performance.now() - t0;
    this.inferMs = this.inferMs ? this.inferMs * 0.85 + ms * 0.15 : ms;
    this.stamps.push(now);
    while (this.stamps.length && now - this.stamps[0] > 2000) this.stamps.shift();
    this.fps = this.stamps.length > 1 ? (this.stamps.length - 1) * 1000 / (now - this.stamps[0]) : 0;
    const raw = [];
    for (const d of (res && res.detections) || []) {
      const c = d.categories && d.categories[0];
      if (!c) continue;
      const ci = COCO[c.categoryName];
      if (ci === undefined || c.score < this.thr) continue;
      const b = d.boundingBox;
      raw.push({ x: b.originX, y: b.originY, w: b.width, h: b.height, cls: ci, score: c.score });
    }
    const dets = cleanDets(raw).filter(d => this.enabled[d.cls]);
    this.tracker.armed = this.armed;
    const hits = this.tracker.update(dets, now);
    this.checkMotion();
    for (const h of hits) {
      this.pops.push({ x: h.x, y: h.y, cls: h.cls, t: now });
      this.flashAt = now;
      if (this.onCount) this.onCount(h.cls, h.dir);
    }
  },

  // Kendaraan yang bergerak sejajar garis tidak akan pernah melintasinya. Jika itu yang terlihat,
  // beri tahu pengguna agar memutar garis.
  checkMotion() {
    const m = this.motion || (this.motion = { par: 0, perp: 0, hinted: false });
    if (m.hinted) return;
    const [x1, y1, x2, y2] = this.tracker.linePx();
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (const a of this.tracker.tracks) {
      if (a.mv || a.hits < 4) continue;
      const dx = a.cx - a.bx, dy = a.cy - a.by, d = Math.hypot(dx, dy);
      if (d < 1.5 * Math.sqrt(a.w * a.h)) continue;
      a.mv = true;
      const cos = Math.abs(dx * (x2 - x1) + dy * (y2 - y1)) / (d * len);
      if (cos > 0.85) m.par++; else if (cos < 0.6) m.perp++;
    }
    if (m.par >= 4 && m.par >= 3 * m.perp) { m.hinted = true; if (this.onLineHint) this.onLineHint(); }
  },

  fit() {
    const v = this.video, c = this.canvas;
    const W = v.videoWidth, H = v.videoHeight;
    const cw = c.clientWidth, ch = c.clientHeight;
    if (!W || !H || !cw || !ch) return null;
    const s = Math.min(cw / W, ch / H);
    return { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, W, H, cw, ch };
  },

  lineScreen(f) {
    const l = this.tracker.line;
    return { x1: f.ox + l.x1 * f.W * f.s, y1: f.oy + l.y1 * f.H * f.s, x2: f.ox + l.x2 * f.W * f.s, y2: f.oy + l.y2 * f.H * f.s };
  },

  refreshColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n, fb) => cs.getPropertyValue(n).trim() || fb;
    this.colors = {
      primary: g('--primary', '#EA580C'),
      sun: g('--sun', '#FFC23D'),
      cls: CLASSES.map((c, i) => g('--c' + i, this.colors.cls[i]))
    };
  },

  draw(now) {
    const c = this.canvas, ctx = this.ctx;
    const f = this.fit();
    if (!f) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(f.cw * dpr), ph = Math.round(f.ch * dpr);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, f.cw, f.ch);
    const font = (w, px) => `${w} ${px}px Nunito, ui-rounded, system-ui, sans-serif`;

    if (this.showBoxes) {
      ctx.lineJoin = 'round';
      for (const a of this.tracker.tracks) {
        if (now - a.t > 350) continue;
        const b = a.box;
        const x = f.ox + b.x * f.s, y = f.oy + b.y * f.s, w = b.w * f.s, h = b.h * f.s;
        const col = this.colors.cls[a.cls];
        const fresh = a.flash && now - a.flash < 600;
        ctx.lineWidth = fresh ? 4 : 2.5;
        ctx.strokeStyle = col;
        if (a.counted && !a.skip) { ctx.fillStyle = col + (fresh ? '55' : '22'); this.rr(ctx, x, y, w, h, 8); ctx.fill(); }
        this.rr(ctx, x, y, w, h, 8);
        ctx.stroke();
        const label = CLASSES[a.cls].t + (a.counted && !a.skip ? ' ✓' : ' ' + Math.round(a.score * 100) + '%');
        ctx.font = font(800, 12);
        const tw = ctx.measureText(label).width + 14;
        const ly = y - 22 < 52 ? y + 4 : y - 22;
        ctx.fillStyle = col;
        this.rr(ctx, x, ly, tw, 20, 10);
        ctx.fill();
        ctx.fillStyle = a.cls === 3 ? '#0b0b0b' : '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 7, ly + 10.5);
      }
    }

    const L = this.lineScreen(f);
    const flash = now - this.flashAt < 380;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.38)';
    ctx.lineWidth = flash ? 12 : 9;
    ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke();
    ctx.strokeStyle = flash ? this.colors.sun : this.colors.primary;
    ctx.lineWidth = flash ? 7 : 5;
    ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 9]);
    ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke();
    ctx.setLineDash([]);

    const dx = L.x2 - L.x1, dy = L.y2 - L.y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mx = (L.x1 + L.x2) / 2, my = (L.y1 + L.y2) / 2;
    const off = 34;
    const dirs = this.tracker.dirs;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    const ax = mx + nx * (off - 14), ay = my + ny * (off - 14), bx = mx - nx * (off - 14), by = my - ny * (off - 14);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    const head = (hx, hy, ux, uy) => {
      ctx.beginPath();
      ctx.moveTo(hx - ux * 7 + uy * 6, hy - uy * 7 - ux * 6);
      ctx.lineTo(hx, hy);
      ctx.lineTo(hx - ux * 7 - uy * 6, hy - uy * 7 + ux * 6);
      ctx.stroke();
    };
    if (dirs & 1) head(bx, by, -nx, -ny);
    if (dirs & 2) head(ax, ay, nx, ny);
    const chip = (x, y, t) => {
      ctx.fillStyle = 'rgba(20,14,10,.62)';
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = font(900, 14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t, x, y + 1);
      ctx.textAlign = 'left';
    };
    chip(mx + nx * off, my + ny * off, 'A');
    chip(mx - nx * off, my - ny * off, 'B');
    for (const [hx, hy] of [[L.x1, L.y1], [L.x2, L.y2]]) {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = this.colors.primary;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    this.pops = this.pops.filter(p => now - p.t < 900);
    for (const p of this.pops) {
      const k = (now - p.t) / 900;
      const x = f.ox + p.x * f.s, y = f.oy + p.y * f.s - k * 46;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = font(900, 20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText('+1', x, y);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('+1', x, y);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  },

  rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // Pointer dipasang di elemen stage (fase capture) agar ujung garis tetap bisa digeser
  // walau tertutup tombol alat. Ujung garis lebih diprioritaskan daripada tombol.
  initPointer() {
    const c = this.canvas;
    const el = c.parentElement;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const hit = (x, y, target) => {
      const f = this.fit();
      if (!f || !this.source) return 0;
      if (target && target.closest('.st-cover')) return 0;
      const L = this.lineScreen(f);
      const d1 = Math.hypot(x - L.x1, y - L.y1), d2 = Math.hypot(x - L.x2, y - L.y2);
      const r = target && target.closest('button') ? 18 : 30;
      if (d1 < r && d1 <= d2) return 1;
      if (d2 < r) return 2;
      if (target && target.closest('button, .hud')) return 0;
      if (Geo.segDist(x, y, L.x1, L.y1, L.x2, L.y2) < 22) return 3;
      return 0;
    };
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const [x, y] = pos(e.touches[0]);
      if (hit(x, y, e.target)) e.preventDefault();
    }, { passive: false, capture: true });
    el.addEventListener('pointerdown', (e) => {
      const [x, y] = pos(e);
      const k = hit(x, y, e.target);
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      this.drag = { k, x, y, l0: Object.assign({}, this.tracker.line), id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      c.classList.add('dragging');
    }, true);
    el.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e);
      if (!this.drag) { c.style.cursor = hit(x, y, e.target) ? 'grab' : ''; return; }
      const f = this.fit();
      if (!f) return;
      const nx = (x - f.ox) / (f.W * f.s), ny = (y - f.oy) / (f.H * f.s);
      const cl = (v) => Math.max(0.02, Math.min(0.98, v));
      const l = this.tracker.line, d = this.drag;
      if (d.k === 1) { l.x1 = cl(nx); l.y1 = cl(ny); }
      else if (d.k === 2) { l.x2 = cl(nx); l.y2 = cl(ny); }
      else {
        let ddx = (x - d.x) / (f.W * f.s), ddy = (y - d.y) / (f.H * f.s);
        const o = d.l0;
        ddx = Math.max(0.02 - Math.min(o.x1, o.x2), Math.min(0.98 - Math.max(o.x1, o.x2), ddx));
        ddy = Math.max(0.02 - Math.min(o.y1, o.y2), Math.min(0.98 - Math.max(o.y1, o.y2), ddy));
        l.x1 = o.x1 + ddx; l.x2 = o.x2 + ddx; l.y1 = o.y1 + ddy; l.y2 = o.y2 + ddy;
      }
    }, true);
    const end = () => {
      if (!this.drag) return;
      this.drag = null;
      this._noClick = true;
      setTimeout(() => { this._noClick = false; }, 0);
      c.classList.remove('dragging');
      this.tracker.resync();
      this.resetMotion();
      if (this.onLine) this.onLine(Object.assign({}, this.tracker.line));
    };
    el.addEventListener('pointerup', end, true);
    el.addEventListener('pointercancel', end, true);
    // Seret yang berakhir di atas tombol tidak boleh ikut menekan tombol itu.
    el.addEventListener('click', (e) => { if (this._noClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  },

  rotateLine() {
    const f = this.fit();
    const W = f ? f.W : 16, H = f ? f.H : 9;
    const l = this.tracker.line;
    const mx = (l.x1 + l.x2) / 2 * W, my = (l.y1 + l.y2) / 2 * H;
    const vx = (l.x2 - l.x1) / 2 * W, vy = (l.y2 - l.y1) / 2 * H;
    const cl = (v) => Math.max(0.02, Math.min(0.98, v));
    this.tracker.line = { x1: cl((mx + vy) / W), y1: cl((my - vx) / H), x2: cl((mx - vy) / W), y2: cl((my + vx) / H) };
    this.tracker.resync();
    this.resetMotion();
    if (this.onLine) this.onLine(Object.assign({}, this.tracker.line));
  },

  resetMotion() {
    this.motion = { par: 0, perp: 0, hinted: false };
    for (const a of this.tracker.tracks) { a.mv = true; }
  }
};
