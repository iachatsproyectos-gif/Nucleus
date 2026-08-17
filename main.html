function initApp() {
  try {
    runInits();
  } catch (err) {
    console.error('Nucleus init error:', err);
    showAppToast('Error al iniciar: ' + err.message, 8000);
  } finally {
    initToolbar();
  }
}

function runInits() {
  initMarkers();
  initDocuments();
  initMedia();
  initCaptureFeatures();
  initShortcutFeatures();
  initRegionsFeatures();
  initOnboarding();
  initSearchFeatures();
  initDailyChecklist();
  initBackupFeatures();
  initNucleusHub();
  initEditFeatures();

  loadState();
  purgeLegacyInbox();
  purgeAutomationNodes();
  syncLocationNameFromStack();
  updateTransform();
  render();
  if (typeof updateNodeCount === 'function') updateNodeCount();
  lucide.createIcons();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=' + APP_BUILD).then((reg) => {
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showAppToast('Nueva versión disponible. Recarga la página.', 8000);
          }
        });
      });
    }).catch(() => { /* offline or unsupported */ });
  }
}

initApp();
registerServiceWorker();
