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
    this.line = { x1: 0.94, y1: 0.62, x2: 0.06, y2: 0.62 };
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
        const dist = Math.hypot(d.x + d.w / 2 - a.px, d.y + d.h / 2 - a.py) / Math.max(sa, sd);
        const ov = Geo.iou(pb, d);
        // Jejak baru belum punya kecepatan, jadi jarak cocok pertama dibuat lebih longgar.
        if (dist > (a.hits === 1 ? 1.9 : 1.15) && ov < 0.1) continue;
        let cost = dist - ov;
        if (CLASSES[d.cls].g !== CLASSES[a.cls].g) cost += 0.6;
        pairs.push([cost, i, j]);
      }
    }
    pairs.sort((p, q) => p[0] - q[0]);
    const usedT = new Set(), usedD = new Set();
    for (const [, i, j] of pairs) {
      if (usedT.has(i) || usedD.has(j)) continue;
      usedT.add(i); usedD.add(j);
      this.hit(tr[i], dets[j], t, out);
    }
    dets.forEach((d, j) => { if (!usedD.has(j)) tr.push(this.spawn(d, t)); });
    const keep = [];
    for (const a of tr) {
      if (t - a.t < this.maxAge) keep.push(a);
      // Jejak hilang (keluar layar/tertutup): cek sekali lagi dengan posisi asli terakhirnya.
      else if (!a.counted && a.hits > 1) this.cross(a, t, out, a.cx, a.cy);
    }
    this.tracks = keep;
    return out;
  }

  spawn(d, t) {
    const a = {
      id: this.next++, cx: d.x + d.w / 2, cy: d.y + d.h / 2, sx: d.x + d.w / 2, sy: d.y + d.h / 2, w: d.w, h: d.h, vx: 0, vy: 0,
      votes: { [d.cls]: d.score }, cls: d.cls, score: d.score, hits: 1, t, t0: t,
      side: 0, su: 0.5, counted: false, box: d
    };
    this.cross(a, t, null);
    return a;
  }

  hit(a, d, t, out) {
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    const dt = Math.max(t - a.t, 1);
    const vx = (cx - a.cx) / dt, vy = (cy - a.cy) / dt;
    // Filter alfa-beta: halus untuk kendaraan diam, tidak tertinggal untuk kendaraan bergerak.
    // Pada deteksi kedua kecepatan belum diketahui, jadi pakai posisi asli.
    const pdt = Math.min(dt, 400);
    a.sx = a.hits > 1 ? (a.sx + a.vx * pdt) * 0.45 + cx * 0.55 : cx;
    a.sy = a.hits > 1 ? (a.sy + a.vy * pdt) * 0.45 + cy * 0.55 : cy;
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
    this.cross(a, t, out);
  }

  // Sisi garis memakai posisi yang dihaluskan dan pita toleransi, agar kendaraan
  // yang berhenti atau bergetar di atas garis tidak ikut terhitung.
  cross(a, t, out, px = a.sx, py = a.sy) {
    const [x1, y1, x2, y2] = this.linePx();
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const sd = (dx * (py - y1) - dy * (px - x1)) / len;
    const u = ((px - x1) * dx + (py - y1) * dy) / (len * len);
    const band = Math.max(4, Math.min(a.w, a.h) * 0.15);
    const s = sd > band ? 1 : sd < -band ? -1 : 0;
    if (!s) return;
    if (out && a.side && s !== a.side && !a.counted && this.armed) {
      const um = (u + a.su) / 2;
      if (um >= -0.04 && um <= 1.04) {
        const dir = a.side === 1 ? 1 : 2;
        a.counted = true;
        if (this.dirs & dir) {
          a.flash = t;
          out.push({ cls: a.cls, dir, x: a.cx, y: a.cy, id: a.id });
        } else {
          a.skip = true;
        }
      }
    }
    a.side = s;
    a.su = u;
  }

  resync() {
    for (const a of this.tracks) { a.side = 0; this.cross(a, a.t, null); }
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
  stream: null, url: '', source: '', fileName: '', facing: 'environment', cams: 0,
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

  async startCamera(facing) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(location.protocol === 'https:' || location.hostname === 'localhost' ? 'Browser ini tidak mendukung kamera' : 'Kamera butuh HTTPS');
    }
    const want = facing || this.facing;
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: want }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
      });
    } catch (e) {
      const n = e && e.name;
      if (n === 'NotAllowedError' || n === 'SecurityError') throw new Error('Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser.');
      if (n === 'NotFoundError' || n === 'OverconstrainedError') throw new Error('Kamera tidak ditemukan');
      if (n === 'NotReadableError' || n === 'AbortError') throw new Error('Kamera sedang dipakai aplikasi lain');
      throw new Error('Kamera gagal dibuka');
    }
    this.stopSource();
    this.stream = s;
    this.facing = want;
    this.source = 'camera';
    const v = this.video;
    v.removeAttribute('src');
    v.loop = false;
    v.srcObject = s;
    await v.play().catch(() => {});
    this.tracker.reset();
    this.run();
    try { this.cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').length; } catch (e) { this.cams = 1; }
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
    const buf = await Model.get(CONFIG.MODELS[key], (p) => prog(0.08 + p * 0.84, 'Mengunduh model'));
    prog(0.94, 'Menyiapkan model');
    // Inferensi pertama lambat (kompilasi shader). Dipanaskan di sini agar tidak ada kendaraan terlewat
    // saat mulai menghitung, sekaligus mendeteksi GPU yang tidak bisa dipakai.
    const warm = (d) => {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 240;
      c.getContext('2d').fillRect(0, 0, 320, 240);
      d.detectForVideo(c, performance.now());
      return d;
    };
    let det;
    try { det = warm(await this.create(buf, 'GPU')); } catch (e) { det = warm(await this.create(buf, 'CPU')); }
    if (this.det) { try { this.det.close(); } catch (e) {} }
    this.det = det;
    this.buf = buf;
    this.modelKey = key;
    prog(1, '');
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
    return det;
  },

  async fallbackCpu() {
    if (this._fb) return;
    this._fb = true;
    const old = this.det;
    this.det = null;
    try { if (old) old.close(); } catch (e) {}
    try { this.det = await this.create(this.buf, 'CPU'); } catch (e) { if (this.onError) this.onError(new Error('AI tidak bisa berjalan di perangkat ini')); }
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
      res = this.det.detectForVideo(v, now);
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
    for (const h of hits) {
      this.pops.push({ x: h.x, y: h.y, cls: h.cls, t: now });
      this.flashAt = now;
      if (this.onCount) this.onCount(h.cls, h.dir);
    }
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
    if (this.onLine) this.onLine(Object.assign({}, this.tracker.line));
  }
};
