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
}

function initToolbar() {
  document.querySelectorAll('.ui-dropdown-wrap').forEach(wrap => {
    const toggle = wrap.querySelector('.ui-cluster-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = wrap.classList.contains('open');
      closeAllOverlays();
      if (!wasOpen) wrap.classList.add('open');
    });
  });

  document.getElementById('ui-layer').addEventListener('click', (e) => {
    if (e.target.closest('.dropdown-item')) {
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
