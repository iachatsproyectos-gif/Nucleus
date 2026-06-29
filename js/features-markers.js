const markerObserver = new MutationObserver(() => {
  if (typeof getCurrentContext !== 'function') return;
  const ctx = getCurrentContext();

  ctx.nodes.forEach(n => {
    const el = document.querySelector(`.node[data-id="${n.id}"]`);

    if (el && !el.querySelector('.node-visual-marker')) {
      const marker = document.createElement('div');
      marker.className = 'node-visual-marker';

      if (n.isMarked) {
        marker.classList.add('is-marked');
      }

      marker.onmousedown = (e) => e.stopPropagation();

      marker.onclick = (e) => {
        e.stopPropagation();
        n.isMarked = !n.isMarked;
        marker.classList.toggle('is-marked', n.isMarked);
        if (typeof saveState === 'function') saveState(false);
      };

      el.appendChild(marker);
    }
  });
});

function initMarkers() {
  markerObserver.observe(nodesLayer, { childList: true });
}
