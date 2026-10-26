/* Effets du site : mode sombre, bouton de contact, carte de la mobilité. */
(function () {
  var root = document.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Mode sombre ----------
     Le thème enregistré est appliqué par un petit script dans le <head> (pas de flash au chargement).
     Ici : le bouton, qui bascule et mémorise le choix. */
  var KEY = 'portfolio-theme';
  var themeBtn = document.querySelector('.theme-btn');

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function syncTheme() {
    if (themeBtn) themeBtn.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
  }
  if (themeBtn) {
    syncTheme();
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      if (next === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      syncTheme();
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  }

  /* ---------- Bouton « Me contacter » : fenêtre avec l'adresse ---------- */
  var fab = document.querySelector('.fab');
  var pop = document.querySelector('.fab-pop');

  function popOpen(open) {
    if (!pop) return;
    pop.hidden = !open;
    if (fab) fab.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (fab && pop) {
    /* Sans application mail configurée, un lien « mailto » ne fait rien : on propose donc
       de copier l'adresse, d'ouvrir Gmail, ou d'utiliser l'application mail. */
    fab.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); popOpen(pop.hidden); });
    pop.addEventListener('click', function (ev) { ev.stopPropagation(); });
    document.addEventListener('click', function () { popOpen(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') popOpen(false); });

    var copyBtn = pop.querySelector('.copy');
    var addr = pop.querySelector('.addr');
    if (copyBtn && addr) copyBtn.addEventListener('click', function () {
      var text = addr.textContent;
      function done() {
        copyBtn.classList.add('done');
        setTimeout(function () { copyBtn.classList.remove('done'); }, 1800);
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(ta); done();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  }

  /* ---------- Animations : apparition au défilement, barre de lecture, boutons « magnétiques ---------- */
  var targets = [].slice.call(document.querySelectorAll(
    '.content .record, .content a.tile, .content .section-title, .content .step, .content .compare .fig, ' +
    '.content a.mini, .content .timeline li, .content .stats > *, .content .link-card, .content .video-frame'
  )).filter(function (n) { return !n.closest('.hero-zone') && !n.closest('.page-head'); });

  if (!reduce && 'IntersectionObserver' in window && targets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    targets.forEach(function (n) {
      var sib = n.parentNode ? [].slice.call(n.parentNode.children).filter(function (s) { return s.classList.contains('rv') || targets.indexOf(s) > -1; }) : [n];
      n.style.setProperty('--d', (Math.min(sib.indexOf(n), 5) * 0.08).toFixed(2) + 's');
      n.classList.add('rv');
      io.observe(n);
    });
  }

  /* Règle graduée : la position de lecture est repérée par un trait bleu (écrans larges uniquement). */
  if (!reduce) {
    var ruler = document.createElement('div');
    ruler.className = 'ruler';
    ruler.setAttribute('aria-hidden', 'true');
    var mark = document.createElement('i');
    ruler.appendChild(mark);
    document.body.appendChild(ruler);
    var tick = false;
    var upd = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var f = h > 0 ? Math.min(1, window.scrollY / h) : 0;
      mark.style.top = (f * (window.innerHeight - 2)).toFixed(1) + 'px';
      mark.setAttribute('data-v', Math.round(f * 100) + '');
      tick = false;
    };
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  }

  /* ---------- Carte de la mobilité ----------
     Chaque épingle porte data-lat / data-lon : il suffit de changer ces deux nombres pour la déplacer. */
  [].slice.call(document.querySelectorAll('.worldmap')).forEach(function (map) {
    var top = +map.getAttribute('data-top'), bottom = +map.getAttribute('data-bottom');
    var VW = 1000, VH = VW * (top - bottom) / 360;
    var arcs = map.querySelector('.arcs');

    function place(el) {
      var dx = +el.getAttribute('data-dx') || 0, dy = +el.getAttribute('data-dy') || 0;   // décalage d'affichage (unités de la carte)
      var px = (+el.getAttribute('data-lon') + 180) / 360 * VW + dx;
      var py = (top - +el.getAttribute('data-lat')) / (top - bottom) * VH + dy;
      el.style.left = (px / VW * 100) + '%';
      el.style.top = (py / VH * 100) + '%';
      return { x: px, y: py };
    }

    var origin = map.querySelector('.pin.origin');
    var o = origin ? place(origin) : null;
    if (arcs) while (arcs.firstChild) arcs.removeChild(arcs.firstChild);

    [].slice.call(map.querySelectorAll('a.pin')).forEach(function (a) {
      var p = place(a);
      if (o && arcs) {
        var len = Math.sqrt(Math.pow(p.x - o.x, 2) + Math.pow(p.y - o.y, 2));
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'arc');
        path.setAttribute('d', 'M' + o.x + ',' + o.y + ' Q' + ((o.x + p.x) / 2) + ',' +
                          ((o.y + p.y) / 2 - len * 0.22) + ' ' + p.x + ',' + p.y);
        arcs.appendChild(path);
      }
      a.addEventListener('click', function (e) {
        var id = (a.getAttribute('href') || '').slice(1);
        var t = id ? document.getElementById(id) : null;
        if (!t || !t.offsetParent) return;   // pas sur cette page : le lien fait son travail
        e.preventDefault();
        t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        t.classList.remove('flash');
        void t.offsetWidth;
        t.classList.add('flash');
      });
    });
  });
})();
