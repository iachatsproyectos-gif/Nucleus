function showLoadErrorModal(message) {
  const overlay = document.getElementById('load-error-modal');
  const msg = document.getElementById('load-error-message');
  if (!overlay || !msg) {
    showAppToast(message, 6000);
    return;
  }
  msg.textContent = message;
  overlay.classList.add('visible');
}

function closeLoadErrorModal() {
  const overlay = document.getElementById('load-error-modal');
  if (overlay) overlay.classList.remove('visible');
}

function initDataFeatures() {
  const exportBtn = document.getElementById('export-map-btn');
  const importBtn = document.getElementById('import-map-btn');
  const importInput = document.getElementById('import-map-input');
  const loadImportBtn = document.getElementById('load-error-import-btn');
  const loadCloseBtn = document.getElementById('load-error-close-btn');

  if (exportBtn) exportBtn.onclick = () => exportMapToFile();

  if (importBtn && importInput) {
    importBtn.onclick = () => importInput.click();
    importInput.onchange = () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = '';
      if (!file) return;
      importMapFromFile(file);
    };
  }

  if (loadImportBtn && importInput) {
    loadImportBtn.onclick = () => {
      closeLoadErrorModal();
      importInput.click();
    };
  }
  if (loadCloseBtn) loadCloseBtn.onclick = closeLoadErrorModal;

  const overlay = document.getElementById('load-error-modal');
  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target === overlay) closeLoadErrorModal();
    };
  }
}

function importMapFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.rootNodes && !data.nodes) {
        throw new Error('Formato no válido');
      }
      const payload = {
        version: data.version || STORAGE_VERSION,
        rootNodes: data.rootNodes || data.nodes || [],
        rootConnections: data.rootConnections || data.connections || []
      };

      const hasData = rootNodes.length > 0 || rootConnections.length > 0;
      if (hasData && !confirm('¿Reemplazar el mapa actual con el archivo importado?')) return;

      if (typeof saveSnapshotBeforeAction === 'function') saveSnapshotBeforeAction('import');
      pushUndo();
      applyMapData(payload, false);
      closeLoadErrorModal();
      showAppToast('Mapa importado correctamente.');
    } catch (err) {
      showAppToast('No se pudo importar: ' + err.message, 6000);
    }
  };
  reader.readAsText(file);
}
