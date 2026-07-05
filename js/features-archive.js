function getClosedChapters() {
  const entries = [];
  walkMapTree((n, path) => {
    if (!isChapterNode(n) || n.phase !== 'closed') return;
    entries.push({
      node: n,
      id: n.id,
      title: n.title || 'Capítulo',
      path: path.join(' › '),
      closedAt: n.closedAt,
      note: n.closureNote || ''
    });
  });
  entries.sort((a, b) => {
    const ta = a.closedAt ? new Date(a.closedAt).getTime() : 0;
    const tb = b.closedAt ? new Date(b.closedAt).getTime() : 0;
    return tb - ta;
  });
  return entries;
}

function formatArchiveDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) {
    return '';
  }
}

function renderArchiveList() {
  const list = document.getElementById('archive-results');
  if (!list) return;
  const entries = getClosedChapters();
  if (!entries.length) {
    list.innerHTML = '<p class="search-empty">No hay capítulos cerrados todavía.</p>';
    return;
  }
  list.innerHTML = entries.map(e => {
    const excerpt = e.note ? e.note.slice(0, 120) + (e.note.length > 120 ? '…' : '') : 'Sin nota de cierre';
    const date = formatArchiveDate(e.closedAt);
    return `
      <button type="button" class="search-result-item archive-item" data-id="${e.id}">
        <span class="search-result-title">${escapeMapSelectLabel(e.title)}</span>
        <span class="search-result-path">${escapeMapSelectLabel(e.path)}${date ? ' · ' + date : ''}</span>
        <span class="archive-excerpt">${escapeMapSelectLabel(excerpt)}</span>
      </button>`;
  }).join('');

  list.querySelectorAll('.archive-item').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      if (navigateToNode(id)) closeArchivePanel();
    };
  });
}

function closeArchivePanel() {
  const panel = document.getElementById('archive-panel');
  if (!panel) return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function openArchivePanel() {
  closeAllOverlays?.();
  const panel = document.getElementById('archive-panel');
  if (!panel) return;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  renderArchiveList();
}

function initArchiveFeatures() {
  const toggleBtn = document.getElementById('archive-toggle-btn');
  const closeBtn = document.getElementById('archive-panel-close');
  if (toggleBtn) toggleBtn.onclick = (e) => {
    e.stopPropagation();
    const panel = document.getElementById('archive-panel');
    if (panel?.classList.contains('open')) closeArchivePanel();
    else openArchivePanel();
  };
  if (closeBtn) closeBtn.onclick = closeArchivePanel;
}
