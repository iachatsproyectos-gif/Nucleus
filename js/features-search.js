function initSearchFeatures() {
  const panel = document.getElementById('search-panel');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const toggleBtn = document.getElementById('search-toggle-btn');
  const closeBtn = document.getElementById('search-panel-close');

  if (!panel || !input || !results) return;

  function closeSearch() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function openSearch() {
    closeAllOverlays?.();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    input.focus();
    renderSearchResults(input.value);
  }

  function matchesSearchFilter(entry) {
    const n = entry.node;
    switch (searchFilterType) {
      case 'chapter': return isChapterNode(n);
      case 'stack': return n.type === 'stack';
      case 'marked': return n.isMarked || (n.lifeTag && n.lifeTag !== 'none');
      case 'fog': return isChapterNode(n) && (n.phase === 'fogged' || n.phase === 'unlocked');
      default: return true;
    }
  }

  function renderSearchResults(query) {
    const q = (query || '').trim().toLowerCase();
    let entries = getAllMapNodes();
    entries = entries.filter(matchesSearchFilter);
    const filtered = q
      ? entries.filter(e =>
          e.label.toLowerCase().includes(q) ||
          e.path.toLowerCase().includes(q)
        )
      : entries.slice(0, 40);

    if (!filtered.length) {
      results.innerHTML = '<p class="search-empty">Sin resultados</p>';
      return;
    }

    results.innerHTML = filtered.map(e => `
      <button type="button" class="search-result-item" data-id="${e.id}">
        <span class="search-result-title">${escapeMapSelectLabel(e.label)}</span>
        <span class="search-result-path">${escapeMapSelectLabel(e.path)}</span>
      </button>
    `).join('');

    results.querySelectorAll('.search-result-item').forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.id);
        if (navigateToNode(id)) closeSearch();
      };
    });
  }

  document.querySelectorAll('.search-filter-chip').forEach(chip => {
    chip.onclick = () => {
      searchFilterType = chip.dataset.filter || 'all';
      document.querySelectorAll('.search-filter-chip').forEach(c =>
        c.classList.toggle('active', c === chip)
      );
      renderSearchResults(input.value);
    };
  });

  if (toggleBtn) toggleBtn.onclick = (e) => {
    e.stopPropagation();
    if (panel.classList.contains('open')) closeSearch();
    else openSearch();
  };

  if (closeBtn) closeBtn.onclick = closeSearch;

  input.oninput = () => renderSearchResults(input.value);

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      if (panel.classList.contains('open')) closeSearch();
      else openSearch();
    }
    if (e.key === 'Escape' && panel.classList.contains('open')) closeSearch();
  });
}
