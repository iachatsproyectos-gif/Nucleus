function isNodeHiddenByViewFilter(n) {
  if (chapterViewFilter === 'all') return false;
  if (!isChapterNode(n)) return false;
  if (chapterViewFilter === 'present') {
    return n.phase === 'fogged' || n.phase === 'unlocked';
  }
  if (chapterViewFilter === 'horizon') {
    return n.phase === 'active' || n.phase === 'closed';
  }
  return false;
}

function initViewFeatures() {
  const btn = document.getElementById('view-filter-btn');
  if (!btn) return;

  const labels = { all: 'vista: todo', present: 'vista: presente', horizon: 'vista: horizonte' };

  function updateLabel() {
    btn.textContent = labels[chapterViewFilter] || labels.all;
    btn.dataset.filter = chapterViewFilter;
  }

  btn.onclick = () => {
    const order = ['all', 'present', 'horizon'];
    const idx = order.indexOf(chapterViewFilter);
    chapterViewFilter = order[(idx + 1) % order.length];
    updateLabel();
    render();
  };

  updateLabel();
}
