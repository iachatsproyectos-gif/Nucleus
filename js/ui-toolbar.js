function closeAllDropdowns() {
  document.querySelectorAll('.ui-dropdown-wrap.open').forEach(el => el.classList.remove('open'));
}

function closeHelpPanel() {
  const panel = document.getElementById('help-panel');
  if (panel) {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
}

function closeAllOverlays() {
  closeAllDropdowns();
  closeHelpPanel();
  ['search-panel', 'archive-panel', 'sync-panel', 'snapshots-panel'].forEach(id => {
    const panel = document.getElementById(id);
    if (panel?.classList.contains('open')) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
  });
}

function initToolbar() {
  const uiLayer = document.getElementById('ui-layer');
  if (!uiLayer || uiLayer.dataset.toolbarBound) return;
  uiLayer.dataset.toolbarBound = '1';

  uiLayer.addEventListener('click', (e) => {
    const toggle = e.target.closest('.ui-cluster-toggle');
    if (toggle && uiLayer.contains(toggle)) {
      e.stopPropagation();
      const wrap = toggle.closest('.ui-dropdown-wrap');
      if (!wrap) return;
      const wasOpen = wrap.classList.contains('open');
      closeAllOverlays();
      if (!wasOpen) wrap.classList.add('open');
      return;
    }

    const item = e.target.closest('.dropdown-item');
    if (item && uiLayer.contains(item)) {
      e.stopPropagation();
      closeAllDropdowns();
    }
  });

  const helpBtn = document.getElementById('help-toggle-btn');
  const helpClose = document.getElementById('help-panel-close');
  const helpPanel = document.getElementById('help-panel');

  if (helpBtn && helpPanel) {
    helpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !helpPanel.classList.contains('open');
      closeAllDropdowns();
      if (willOpen) {
        helpPanel.classList.add('open');
        helpPanel.setAttribute('aria-hidden', 'false');
      } else {
        closeHelpPanel();
      }
    });
  }

  if (helpClose) {
    helpClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeHelpPanel();
    });
  }

  viewport.addEventListener('mousedown', () => {
    closeAllOverlays();
  });
}
