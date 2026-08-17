function exportMapBackup() {
  const payload = {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    rootNodes,
    rootConnections
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nucleus-respaldo-${date}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showAppToast('Respaldo exportado.');
}

function importMapBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.rootNodes)) throw new Error('invalid');
      if (!confirm('¿Restaurar este respaldo? Reemplaza el mapa actual.')) return;
      applyMapData(data, true);
      showAppToast('Mapa restaurado desde respaldo.');
    } catch (_) {
      showAppToast('No se pudo leer el respaldo.', 6000);
    }
  };
  reader.readAsText(file);
}

function initBackupFeatures() {
  document.getElementById('export-backup-btn')?.addEventListener('click', exportMapBackup);
  document.getElementById('import-backup-btn')?.addEventListener('click', () => {
    document.getElementById('import-backup-input')?.click();
  });
  document.getElementById('import-backup-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importMapBackup(file);
    e.target.value = '';
  });
}
