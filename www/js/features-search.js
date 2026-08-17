function scoreSearchMatch(entry, q) {
  if (!q) return 0;
  const name = entry.label.toLowerCase();
  const path = entry.path.toLowerCase();
  const body = entry.searchText;

  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (path.includes(q)) return 45;
  if (body.includes(q)) return 30;
  return -1;
}

function initSearchFeatures() {
  const panel = document.getElementById('search-panel');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const toggleBtn = document.getElementById('search-toggle-btn');
  const closeBtn = document.getElementById('search-panel-close');
  const headerLabel = panel?.querySelector('.panel-header span');

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
      case 'stack': return n.type === 'stack';
      case 'marked': return n.isMarked || (n.lifeTag && n.lifeTag !== 'none');
      default: return true;
    }
  }

  function renderSearchResults(query) {
    const q = (query || '').trim().toLowerCase();
    let entries = getAllMapNodes().filter(matchesSearchFilter);

    if (q) {
      entries = entries
        .map(e => ({ entry: e, score: scoreSearchMatch(e, q) }))
        .filter(x => x.score >= 0)
        .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, 'es'))
        .map(x => x.entry);
    } else {
      entries.sort((a, b) => {
        const pathCmp = a.path.localeCompare(b.path, 'es');
        if (pathCmp !== 0) return pathCmp;
        return a.label.localeCompare(b.label, 'es');
      });
    }

    if (headerLabel) {
      headerLabel.textContent = q
        ? `buscar · ${entries.length} resultado${entries.length === 1 ? '' : 's'}`
        : `mapa · ${entries.length} elemento${entries.length === 1 ? '' : 's'}`;
    }

    if (!entries.length) {
      results.innerHTML = '<p class="search-empty">Sin resultados</p>';
      return;
    }

    results.innerHTML = entries.map(e => `
      <button type="button" class="search-result-item" data-id="${e.id}">
        <span class="search-result-row">
          <span class="search-result-title">${escapeMapSelectLabel(e.label)}</span>
          <span class="search-result-type">${escapeMapSelectLabel(e.typeLabel)}</span>
        </span>
        ${e.preview ? `<span class="search-result-preview">${escapeMapSelectLabel(e.preview)}</span>` : ''}
        <span class="search-result-path">${escapeMapSelectLabel(e.path)}</span>
      </button>
    `).join('');

    results.querySelectorAll('.search-result-item').forEach(btn => {
      btn.onclick = () => {
        if (navigateToNode(btn.dataset.id)) closeSearch();
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

  window.openSearchPanel = openSearch;

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
