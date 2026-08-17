function computeNucleusActivity() {
  const checklist = typeof getDailyChecklistProgress === 'function'
    ? getDailyChecklistProgress()
    : 0;
  const nodeCount = typeof getAllMapNodes === 'function' ? getAllMapNodes().length : 0;
  const mapActivity = Math.min(0.35, nodeCount / 120);
  return Math.min(1, checklist * 0.75 + mapActivity);
}

function updateNucleusHud() {
  window.setNucleusCoreActivity?.(computeNucleusActivity());
}

function mountHubCore() {
  if (typeof window.mountNucleusCore !== 'function') return false;
  window.mountNucleusCore();
  window.setNucleusCoreActivity?.(computeNucleusActivity());
  return true;
}

function openNucleusHub() {
  if (typeof closeAllOverlays === 'function') closeAllOverlays();

  const hub = document.getElementById('nucleus-hub');
  const viewportEl = document.getElementById('viewport');
  const fabBtn = document.getElementById('nucleus-hub-btn');

  if (hub) {
    hub.classList.add('open');
    hub.setAttribute('aria-hidden', 'false');
  }
  document.body.classList.add('nucleus-hub-open');
  if (viewportEl) viewportEl.classList.add('nucleus-hub-active');
  if (fabBtn) fabBtn.classList.add('active');

  window.pauseNucleusFabPreview?.();

  if (!mountHubCore()) {
    requestAnimationFrame(() => mountHubCore());
  }

  window.recordNucleusVisit?.();
  window.renderDailyChecklist?.();
  updateNucleusHud();
}

function closeNucleusHub(reRender) {
  window.pauseNucleusCore?.();
  window.unmountNucleusCore?.();

  const hub = document.getElementById('nucleus-hub');
  const viewportEl = document.getElementById('viewport');
  const fabBtn = document.getElementById('nucleus-hub-btn');

  if (hub) {
    hub.classList.remove('open');
    hub.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('nucleus-hub-open');
  if (viewportEl) viewportEl.classList.remove('nucleus-hub-active');
  if (fabBtn) fabBtn.classList.remove('active');

  window.setNucleusHubControlsEnabled?.(true);
  window.resumeNucleusFabPreview?.();

  if (reRender !== false && typeof render === 'function') render();
}

function initNucleusHub() {
  document.getElementById('nucleus-hub-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const hub = document.getElementById('nucleus-hub');
    if (hub?.classList.contains('open')) closeNucleusHub();
    else openNucleusHub();
  });

  document.getElementById('nucleus-hub-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeNucleusHub();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const hub = document.getElementById('nucleus-hub');
    if (hub?.classList.contains('open')) closeNucleusHub();
  });

  window.updateNucleusHud = updateNucleusHud;
}
