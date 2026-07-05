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
  initChapters();
  initArchiveFeatures();
  initCaptureFeatures();
  initFocusFeatures();
  initShortcutFeatures();
  initSnapshotFeatures();
  initSyncFeatures();
  initKeepFeatures();
  initRegionsFeatures();
  initDataFeatures();
  initMultiMapFeatures();
  initOnboarding();
  initSearchFeatures();
  initViewFeatures();
  initEditFeatures();

  loadState();
  purgeLegacyInbox();
  purgeAutomationNodes();
  syncLocationNameFromStack();
  updateTransform();
  render();
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
