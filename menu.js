/* Menu déroulant : s'ouvre au clic, se ferme au clic ailleurs, sur Échap ou après le choix d'une rubrique. */
(function () {
  var btn = document.querySelector('.menu-btn');
  var panel = document.getElementById('menu-panel');
  if (!btn || !panel) return;

  function setOpen(open) {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(panel.hidden);
  });

  document.addEventListener('click', function (e) {
    if (!panel.hidden && !panel.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      btn.focus();
    }
  });

  panel.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a')) setOpen(false);
  });
})();
