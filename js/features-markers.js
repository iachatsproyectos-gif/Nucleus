const LIFE_TAGS = ['none', 'explore', 'active', 'archive'];
const LIFE_LABELS = { none: '', explore: 'explorar', active: 'presente', archive: 'archivo' };

function cycleLifeTag(n) {
  if (!n) return;
  const idx = LIFE_TAGS.indexOf(n.lifeTag || 'none');
  n.lifeTag = LIFE_TAGS[(idx + 1) % LIFE_TAGS.length];
  saveState(false);
  render();
  if (n.lifeTag !== 'none') showAppToast('Etiqueta: ' + LIFE_LABELS[n.lifeTag]);
}

const markerObserver = new MutationObserver(() => {
  if (typeof getCurrentContext !== 'function') return;
  const ctx = getCurrentContext();

  ctx.nodes.forEach(n => {
    const el = document.querySelector(`.node[data-id="${n.id}"]`);
    if (!el || n.type === 'region') return;

    let marker = el.querySelector('.node-visual-marker');
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'node-visual-marker';
      marker.onmousedown = (e) => e.stopPropagation();
      marker.onclick = (e) => {
        e.stopPropagation();
        if (e.shiftKey) {
          cycleLifeTag(n);
          return;
        }
        n.isMarked = !n.isMarked;
        marker.classList.toggle('is-marked', n.isMarked);
        saveState(false);
      };
      el.appendChild(marker);
    }
    marker.classList.toggle('is-marked', !!n.isMarked);
    LIFE_TAGS.forEach(t => marker.classList.remove('life-' + t));
    if (n.lifeTag && n.lifeTag !== 'none') marker.classList.add('life-' + n.lifeTag);
  });
});

function initMarkers() {
  markerObserver.observe(nodesLayer, { childList: true });
}
