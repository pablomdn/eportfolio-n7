/* Signature visuelle : champs d'écoulement potentiel.
   Chaque figure (.flowfig) affiche les lignes de courant exactes d'un écoulement plan, calculées par superposition
   d'un courant uniforme, de doublets (cylindres), de sources/puits et de tourbillons, ainsi que des traceurs
   advectés par ce même champ de vitesse. Les traceurs accélèrent donc là où la physique l'impose
   (jusqu'à 2U sur les flancs d'un cylindre). Aucune bibliothèque, aucune image. */
(function () {
  var figs = [].slice.call(document.querySelectorAll('.flowfig'));
  if (!figs.length) return;
  var root = document.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var SPEED = 80;   // px/s pour U = 1

  function hexToRgb(h) {
    h = (h || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return isNaN(n) ? [52, 89, 234] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function colors() {
    var cs = getComputedStyle(root);
    return { accent: hexToRgb(cs.getPropertyValue('--accent')), ink: hexToRgb(cs.getPropertyValue('--ink')), card: hexToRgb(cs.getPropertyValue('--card')) };
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ---------- Définition des écoulements (coordonnées en fractions de la figure) ---------- */
  function build(kind, W, H, hero) {
    var s = Math.min(W, H * 1.25);
    var c = { U: 1, doublets: [], vortices: [], sources: [], seeds: 'left', halfbody: null, rings: false, stag: false, hatch: !hero };
    var R;
    if (kind === 'cyl') {
      R = hero ? Math.min(H * 0.27, W * 0.25) : Math.min(H * 0.3, W * 0.12);
      c.doublets.push({ x: W * (hero ? 0.56 : 0.72), y: H * 0.5, R: R });
      c.stag = true;
    } else if (kind === 'lift') {
      R = Math.min(H * 0.3, W * 0.12);
      c.doublets.push({ x: W * 0.72, y: H * 0.5, R: R });
      c.vortices.push({ x: W * 0.72, y: H * 0.5, k: 1.15 * R });
    } else if (kind === 'dipole') {
      c.U = 0;
      c.sources.push({ x: W * 0.55, y: H * 0.5, m: H * 0.9 });
      c.sources.push({ x: W * 0.9, y: H * 0.5, m: -H * 0.9 });
      c.seeds = 'ring';
    } else if (kind === 'street') {
      c.U = 0.8;
      var n = 5, sp = Math.max(H * 0.42, 46);
      for (var i = 0; i < n; i++) {
        c.vortices.push({ x: W * 0.52 + i * sp * 0.9, y: H * 0.5 + (i % 2 ? 1 : -1) * H * 0.13, k: (i % 2 ? -1 : 1) * H * 0.42 });
      }
    } else if (kind === 'duo') {
      R = Math.min(H * 0.2, W * 0.09);
      c.doublets.push({ x: W * 0.62, y: H * 0.34, R: R });
      c.doublets.push({ x: W * 0.84, y: H * 0.68, R: R * 0.8 });
    } else if (kind === 'half') {
      var m = H * 0.2 / Math.PI * 1.15;
      c.sources.push({ x: W * 0.6, y: H * 0.5, m: m });
      c.halfbody = { x: W * 0.6, y: H * 0.5, m: m };
      c.hatch = true;
    }
    return c;
  }

  function field(c) {
    var U = c.U, D = c.doublets, V = c.vortices, S = c.sources;
    return function (x, y, o) {
      var u = U, v = 0, i, dx, dy, r2, k;
      for (i = 0; i < D.length; i++) {
        dx = x - D[i].x; dy = y - D[i].y; r2 = dx * dx + dy * dy; if (r2 < 4) r2 = 4;
        k = U * D[i].R * D[i].R / (r2 * r2);
        u -= k * (dx * dx - dy * dy); v -= k * 2 * dx * dy;
      }
      for (i = 0; i < V.length; i++) {
        dx = x - V[i].x; dy = y - V[i].y; r2 = dx * dx + dy * dy; if (r2 < 196) r2 = 196;
        u += -V[i].k * dy / r2; v += V[i].k * dx / r2;
      }
      for (i = 0; i < S.length; i++) {
        dx = x - S[i].x; dy = y - S[i].y; r2 = dx * dx + dy * dy; if (r2 < 100) r2 = 100;
        u += S[i].m * dx / r2; v += S[i].m * dy / r2;
      }
      var sp = Math.sqrt(u * u + v * v), mx = 3.2 * (U || 1);
      if (sp > mx) { u *= mx / sp; v *= mx / sp; }
      o.u = u; o.v = v;
    };
  }

  function inside(c, x, y) {
    var i, dx, dy;
    for (i = 0; i < c.doublets.length; i++) {
      dx = x - c.doublets[i].x; dy = y - c.doublets[i].y;
      if (dx * dx + dy * dy < c.doublets[i].R * c.doublets[i].R * 0.97) return true;
    }
    if (c.halfbody) {
      var h = c.halfbody; dx = x - h.x; var up = -(y - h.y);
      var psi = c.U * up + h.m * Math.atan2(up, dx);
      if (Math.abs(psi) < Math.PI * h.m * 0.985) return true;
    }
    return false;
  }

  function nearSink(c, x, y) {
    for (var i = 0; i < c.sources.length; i++) {
      if (c.sources[i].m < 0) { var dx = x - c.sources[i].x, dy = y - c.sources[i].y; if (dx * dx + dy * dy < 49) return true; }
    }
    return false;
  }

  /* ---------- Lignes de courant ---------- */
  function trace(c, f, W, H, x, y, step) {
    var pts = [[x, y]], o = { u: 0, v: 0 }, n, h = step;
    for (n = 0; n < 1600; n++) {
      f(x, y, o); var sp = Math.sqrt(o.u * o.u + o.v * o.v); if (sp < 1e-4) break;
      var mx = x + o.u / sp * h / 2, my = y + o.v / sp * h / 2;
      f(mx, my, o); sp = Math.sqrt(o.u * o.u + o.v * o.v); if (sp < 1e-4) break;
      x += o.u / sp * h; y += o.v / sp * h;
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) { pts.push([x, y]); break; }
      if (inside(c, x, y) || nearSink(c, x, y)) break;
      pts.push([x, y]);
    }
    return pts;
  }

  function streamlines(c, f, W, H, hero) {
    var lines = [], i, gap = hero ? 17 : Math.max(11, H / 15), y;
    if (c.seeds === 'left') {
      for (y = gap / 2; y < H; y += gap) lines.push(trace(c, f, W, H, -12, y, 3));
    } else {
      c.sources.forEach(function (s) {
        if (s.m <= 0) return;
        var nA = hero ? 26 : 20;
        for (i = 0; i < nA; i++) {
          var a = (i + 0.5) / nA * Math.PI * 2;
          lines.push(trace(c, f, W, H, s.x + Math.cos(a) * 9, s.y + Math.sin(a) * 9, 3));
        }
      });
    }
    return lines;
  }

  function halfbodyOutline(c, W) {
    var h = c.halfbody, up = [], dn = [], x;
    var xs = h.x - h.m / c.U;
    for (x = xs; x <= W + 20; x += 4) {
      var dx = x - h.x, y = Math.max(Math.PI * h.m / c.U * 0.1, 1);
      for (var k = 0; k < 40; k++) {
        var th = Math.atan2(y, dx);
        y = h.m * (Math.PI - th) / c.U;
      }
      up.push([x, h.y - y]); dn.push([x, h.y + y]);
    }
    return { up: up, dn: dn };
  }

  /* ---------- Figure ---------- */
  function Fig(el) {
    this.el = el;
    this.kind = el.getAttribute('data-flow') || 'cyl';
    this.hero = el.hasAttribute('data-hero');
    this.bg = document.createElement('canvas'); this.bg.className = 'fl-bg';
    this.fg = document.createElement('canvas'); this.fg.className = 'fl-fg';
    this.bg.setAttribute('aria-hidden', 'true'); this.fg.setAttribute('aria-hidden', 'true');
    el.insertBefore(this.fg, el.firstChild); el.insertBefore(this.bg, el.firstChild);
    this.visible = false; this.running = false; this.last = 0;
    this.W = 0; this.H = 0;
    this.setup();
  }

  Fig.prototype.setup = function () {
    var el = this.el, W = el.clientWidth, H = el.clientHeight;
    if (W < 40 || H < 40) { this.ok = false; return; }
    this.ok = true; this.W = W; this.H = H;
    [this.bg, this.fg].forEach(function (cv) { cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); });
    this.cfg = build(this.kind, W, H, this.hero);
    this.f = field(this.cfg);
    this.col = colors();
    var c = this.cfg;
    if (c.doublets.length && this.hero) {   // la photo se cale sur le cylindre
      var d = c.doublets[0];
      el.style.setProperty('--cx', d.x + 'px'); el.style.setProperty('--cy', d.y + 'px'); el.style.setProperty('--cd', (d.R * 2) + 'px');
    }
    this.lines = streamlines(c, this.f, W, H, this.hero);
    this.drawStatic();
    var n = Math.max(40, Math.min(150, Math.round(W * H / (this.hero ? 2600 : 2200))));
    this.P = [];
    for (var i = 0; i < n; i++) this.P.push(this.spawn({}, true));
    this.fg.getContext('2d').clearRect(0, 0, this.fg.width, this.fg.height);
  };

  Fig.prototype.spawn = function (p, scatter) {
    var c = this.cfg, W = this.W, H = this.H, tries = 0;
    do {
      if (c.seeds === 'left') {
        p.x = scatter ? Math.random() * W : -4; p.y = Math.random() * H;
      } else {
        var srcs = c.sources.filter(function (s) { return s.m > 0; }), s = srcs[Math.floor(Math.random() * srcs.length)];
        var a = Math.random() * Math.PI * 2, r = 9;
        p.x = s.x + Math.cos(a) * r; p.y = s.y + Math.sin(a) * r;
        if (scatter) { var t = Math.random() * 30; for (var j = 0; j < t; j++) this.advance(p, 0.05, true); }
      }
      tries++;
    } while (inside(c, p.x, p.y) && tries < 20);
    p.px = p.x; p.py = p.y;
    return p;
  };

  Fig.prototype.advance = function (p, dt, silent) {
    var o = this._o || (this._o = { u: 0, v: 0 });
    this.f(p.x, p.y, o);
    p.px = p.x; p.py = p.y;
    var k = SPEED * dt;
    p.x += o.u * k; p.y += o.v * k;
  };

  Fig.prototype.drawStatic = function () {
    var ctx = this.bg.getContext('2d'), c = this.cfg, col = this.col, W = this.W, H = this.H, i, j;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(col.accent, this.hero ? 0.26 : 0.3); ctx.lineWidth = 1;
    for (i = 0; i < this.lines.length; i++) {
      var L = this.lines[i]; if (L.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
      for (j = 1; j < L.length; j++) ctx.lineTo(L[j][0], L[j][1]);
      ctx.stroke();
    }
    function hatch(clip) {
      ctx.save(); clip(); ctx.clip();
      ctx.strokeStyle = rgba(col.ink, 0.5); ctx.lineWidth = 1;
      ctx.beginPath();
      for (var t = -H; t < W + H; t += 6) { ctx.moveTo(t, H); ctx.lineTo(t + H, 0); }
      ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = rgba(col.ink, 0.95); ctx.lineWidth = 1.4;
    c.doublets.forEach(function (d) {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.R, 0, Math.PI * 2);
      ctx.fillStyle = rgba(col.card, 1); ctx.fill();
      if (c.hatch) hatch(function () { ctx.beginPath(); ctx.arc(d.x, d.y, d.R, 0, Math.PI * 2); });
      ctx.beginPath(); ctx.arc(d.x, d.y, d.R, 0, Math.PI * 2); ctx.stroke();
    });
    if (c.halfbody) {
      var o = halfbodyOutline(c, W);
      var path = function () {
        ctx.beginPath(); ctx.moveTo(o.up[0][0], o.up[0][1]);
        o.up.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
        for (var k = o.dn.length - 1; k >= 0; k--) ctx.lineTo(o.dn[k][0], o.dn[k][1]);
        ctx.closePath();
      };
      path(); ctx.fillStyle = rgba(col.card, 1); ctx.fill();
      hatch(path);
      ctx.beginPath(); ctx.moveTo(o.up[o.up.length - 1][0], o.up[o.up.length - 1][1]);
      for (i = o.up.length - 1; i >= 0; i--) ctx.lineTo(o.up[i][0], o.up[i][1]);
      for (i = 0; i < o.dn.length; i++) ctx.lineTo(o.dn[i][0], o.dn[i][1]);
      ctx.stroke();
    }
    c.sources.forEach(function (s) {
      ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = s.m > 0 ? rgba(col.accent, 1) : rgba(col.card, 1); ctx.fill();
      ctx.strokeStyle = rgba(col.accent, 1); ctx.lineWidth = 1.5; ctx.stroke();
    });
    c.vortices.forEach(function (v) {
      if (c.doublets.length) return;
      ctx.beginPath(); ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = rgba(col.accent, 1); ctx.fill();
    });
    if (c.stag) {   // points d'arrêt
      var d = c.doublets[0];
      [-1, 1].forEach(function (sg) {
        ctx.beginPath(); ctx.arc(d.x + sg * d.R, d.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(col.card, 1); ctx.fill();
        ctx.strokeStyle = rgba(col.accent, 1); ctx.lineWidth = 1.6; ctx.stroke();
      });
    }
  };

  Fig.prototype.frame = function (t) {
    if (!this.running) return;
    var dt = Math.min((t - this.last) / 1000, 0.04); this.last = t;
    var ctx = this.fg.getContext('2d'), W = this.W, H = this.H, c = this.cfg;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.085)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.strokeStyle = rgba(this.col.accent, 0.95);
    ctx.beginPath();
    for (var i = 0; i < this.P.length; i++) {
      var p = this.P[i];
      this.advance(p, dt);
      if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40 || inside(c, p.x, p.y) || nearSink(c, p.x, p.y)) { this.spawn(p, false); continue; }
      ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    var me = this;
    requestAnimationFrame(function (tt) { me.frame(tt); });
  };

  Fig.prototype.start = function () {
    if (reduce || !this.ok || this.running) return;
    this.running = true; this.last = performance.now();
    var me = this; requestAnimationFrame(function (tt) { me.frame(tt); });
  };
  Fig.prototype.stop = function () { this.running = false; };

  var all = figs.map(function (el) { return new Fig(el); });

  function sync() {
    all.forEach(function (f) { if (f.visible && !document.hidden) f.start(); else f.stop(); });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { all.forEach(function (f) { if (f.el === e.target) f.visible = e.isIntersecting; }); });
      sync();
    }, { threshold: 0.01 });
    all.forEach(function (f) { io.observe(f.el); });
  } else { all.forEach(function (f) { f.visible = true; }); sync(); }
  document.addEventListener('visibilitychange', sync);

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { all.forEach(function (f) { f.setup(); }); sync(); }, 180);
  });
  new MutationObserver(function () {
    all.forEach(function (f) { if (f.ok) { f.col = colors(); f.drawStatic(); } });
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* Aperçu à page unique : les figures des autres onglets sont masquées à l'init, on les recalcule à l'affichage. */
  window.addEventListener('portfolio:page', function () {
    all.forEach(function (f) { if (!f.ok || f.W !== f.el.clientWidth) f.setup(); });
    sync();
  });
})();
