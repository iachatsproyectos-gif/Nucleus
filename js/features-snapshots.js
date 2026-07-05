const SNAPSHOT_DB = 'nucleus_snapshots';
const SNAPSHOT_STORE = 'snapshots';
const MAX_SNAPSHOTS = 5;

function openSnapshotDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SNAPSHOT_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSnapshotBeforeAction(reason) {
  try {
    const db = await openSnapshotDB();
    const mapId = getCurrentMapId();
    const payload = {
      mapId,
      reason: reason || 'auto',
      savedAt: new Date().toISOString(),
      data: { version: STORAGE_VERSION, rootNodes, rootConnections }
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(SNAPSHOT_STORE).add(payload);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    const all = await listSnapshots(mapId);
    if (all.length > MAX_SNAPSHOTS) {
      const toDelete = all.slice(MAX_SNAPSHOTS);
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      toDelete.forEach(s => store.delete(s.id));
    }
  } catch (_) { /* IndexedDB unavailable */ }
}

async function listSnapshots(mapId) {
  const db = await openSnapshotDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const req = tx.objectStore(SNAPSHOT_STORE).getAll();
    req.onsuccess = () => {
      const items = (req.result || [])
        .filter(s => s.mapId === mapId)
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function restoreSnapshot(id) {
  const db = await openSnapshotDB();
  const snap = await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
    const req = tx.objectStore(SNAPSHOT_STORE).get(Number(id));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!snap?.data) return;
  if (!confirm('¿Restaurar esta copia? Se reemplazará el mapa actual.')) return;
  applyMapData(snap.data, false);
  showAppToast('Snapshot restaurado.');
}

async function renderSnapshotList() {
  const list = document.getElementById('snapshot-list');
  if (!list) return;
  const items = await listSnapshots(getCurrentMapId());
  if (!items.length) {
    list.innerHTML = '<p class="search-empty">Sin snapshots guardados.</p>';
    return;
  }
  list.innerHTML = items.map(s => `
    <button type="button" class="search-result-item" data-id="${s.id}">
      <span class="search-result-title">${new Date(s.savedAt).toLocaleString('es')}</span>
      <span class="search-result-path">${s.reason || 'auto'}</span>
    </button>
  `).join('');
  list.querySelectorAll('[data-id]').forEach(btn => {
    btn.onclick = () => restoreSnapshot(btn.dataset.id);
  });
}

function initSnapshotFeatures() {
  const btn = document.getElementById('snapshots-toggle-btn');
  const panel = document.getElementById('snapshots-panel');
  const closeBtn = document.getElementById('snapshots-panel-close');
  const saveBtn = document.getElementById('snapshot-save-btn');

  if (btn && panel) btn.onclick = async () => {
    closeAllOverlays?.();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    await renderSnapshotList();
  };
  if (closeBtn && panel) closeBtn.onclick = () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  };
  if (saveBtn) saveBtn.onclick = async () => {
    await saveSnapshotBeforeAction('manual');
    showAppToast('Snapshot guardado.');
    await renderSnapshotList();
  };

  const lastSnap = getAppMeta().lastAutoSnapshot;
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  if (!lastSnap || now - lastSnap > week) {
    saveSnapshotBeforeAction('semanal').then(() => {
      const meta = getAppMeta();
      meta.lastAutoSnapshot = now;
      saveAppMeta(meta);
    });
  }
}
