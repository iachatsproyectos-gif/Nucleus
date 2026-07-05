function getAppMeta() {
  try {
    const raw = localStorage.getItem(APP_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveAppMeta(meta) {
  localStorage.setItem(APP_META_KEY, JSON.stringify(meta));
}

function purgeInboxFromTree(nodes, legacyId, removedIds) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.isInbox || (legacyId && n.id === legacyId)) {
      removedIds.add(n.id);
      nodes.splice(i, 1);
    } else if (n.subNodes?.length) {
      purgeInboxFromTree(n.subNodes, legacyId, removedIds);
    }
  }
}

function purgeLegacyInbox() {
  const meta = getAppMeta();
  const legacyId = meta.inboxStackId;
  if (legacyId) {
    delete meta.inboxStackId;
    saveAppMeta(meta);
  }
  const removedIds = new Set();
  purgeInboxFromTree(rootNodes, legacyId, removedIds);
  if (removedIds.size) {
    rootConnections = rootConnections.filter(c => !removedIds.has(c.from) && !removedIds.has(c.to));
    saveState(false);
  }
}

function purgeAutomationFromTree(nodes, removedIds) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.type && String(n.type).startsWith('auto-')) {
      removedIds.add(n.id);
      nodes.splice(i, 1);
    } else if (n.subNodes?.length) {
      purgeAutomationFromTree(n.subNodes, removedIds);
    }
  }
}

function purgeAutomationNodes() {
  const removedIds = new Set();
  purgeAutomationFromTree(rootNodes, removedIds);
  if (!removedIds.size) return;
  rootConnections = rootConnections.filter(c => !removedIds.has(c.from) && !removedIds.has(c.to));
  walkMapTree((n) => {
    if (n.connections?.length) {
      n.connections = n.connections.filter(c => !removedIds.has(c.from) && !removedIds.has(c.to));
    }
  });
  saveState(false);
}

function showAppToast(message, duration = 4000) {
  const el = document.getElementById('chapter-toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(showAppToast._timer);
  showAppToast._timer = setTimeout(() => el.classList.remove('visible'), duration);
}

function getMapsIndex() {
  try {
    const raw = localStorage.getItem(MAPS_INDEX_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return [];
}

function saveMapsIndex(index) {
  localStorage.setItem(MAPS_INDEX_KEY, JSON.stringify(index));
}

function getCurrentMapId() {
  const meta = getAppMeta();
  return meta.currentMapId || 'default';
}

function getCurrentMapName() {
  const idx = getMapsIndex();
  const id = getCurrentMapId();
  return idx.find(m => m.id === id)?.name || 'Mapa principal';
}

function ensureMapsIndex() {
  let index = getMapsIndex();
  if (!index.length) {
    const legacy = localStorage.getItem(STORAGE_KEY);
    const id = 'default';
    if (legacy) {
      localStorage.setItem(mapStorageKey(id), legacy);
    }
    index = [{ id, name: 'Mapa principal', updatedAt: new Date().toISOString() }];
    saveMapsIndex(index);
    const meta = getAppMeta();
    meta.currentMapId = id;
    saveAppMeta(meta);
  }
  return index;
}

function touchMapUpdated() {
  const id = getCurrentMapId();
  const index = getMapsIndex();
  const entry = index.find(m => m.id === id);
  if (entry) {
    entry.updatedAt = new Date().toISOString();
    saveMapsIndex(index);
  }
}

function pushUndo() {
  const currentState = JSON.stringify({ rootNodes, rootConnections });
  if (undoHistory.length === 0 || undoHistory[undoHistory.length - 1] !== currentState) {
    undoHistory.push(currentState);
    if (undoHistory.length > MAX_UNDO) undoHistory.shift();
  }
}

function undo() {
  if (undoHistory.length === 0) return;
  const previousState = JSON.parse(undoHistory.pop());
  rootNodes = previousState.rootNodes;
  rootConnections = previousState.rootConnections;

  if (navigationStack.length > 0) {
    let currentPath = navigationStack.map(n => n.id);
    let newNavStack = [];
    let currentLevelNodes = rootNodes;

    for (let id of currentPath) {
      let found = currentLevelNodes.find(n => n.id === id);
      if (found) {
        newNavStack.push(found);
        currentLevelNodes = found.subNodes;
      } else {
        break;
      }
    }
    navigationStack = newNavStack;
  }
  selectedNodeIds.clear();
  syncLocationNameFromStack();
  saveState(false);
  render();
}

function persistToStorage() {
  ensureMapsIndex();
  const payload = {
    version: STORAGE_VERSION,
    rootNodes,
    rootConnections
  };
  localStorage.setItem(mapStorageKey(getCurrentMapId()), JSON.stringify(payload));
  touchMapUpdated();
}

function saveState(shouldPushUndo = true) {
  if (shouldPushUndo) pushUndo();
  try {
    persistToStorage();
  } catch (e) {
    showAppToast('No se pudo guardar: almacenamiento lleno. Exporta tu mapa.', 6000);
    if (typeof showLoadErrorModal === 'function') {
      showLoadErrorModal('Almacenamiento lleno. Exporta una copia de seguridad antes de continuar.');
    }
  }
}

function migrateNodeFields(n) {
  if (isChapterNode(n)) {
    if (n.approachNote === undefined) n.approachNote = '';
    if (n.closureNote === undefined) n.closureNote = '';
  }
  if (n.lifeTag === undefined) n.lifeTag = 'none';
  if (n.subNodes && n.subNodes.length) n.subNodes.forEach(migrateNodeFields);
}

function migrateStorageData(data) {
  if (!data.version) {
    return { rootNodes: data.rootNodes || [], rootConnections: data.rootConnections || [] };
  }
  return { rootNodes: data.rootNodes || [], rootConnections: data.rootConnections || [] };
}

function applyMapData(data, skipUndo = false) {
  const migrated = migrateStorageData(data);
  rootNodes = migrated.rootNodes;
  rootConnections = migrateConnectionsList(migrated.rootConnections);
  migrateNodeTree(rootNodes);
  rootNodes.forEach(migrateNodeFields);
  navigationStack = [];
  selectedNodeIds.clear();
  connectingNode = null;
  connectingFromPort = null;
  undoHistory = [];
  currentLocationName = 'HOME';
  saveState(!skipUndo);
  render();
  if (typeof updateEmptyState === 'function') updateEmptyState();
}

function loadState() {
  ensureMapsIndex();
  const raw = localStorage.getItem(mapStorageKey(getCurrentMapId()));
  if (!raw) {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      try {
        const data = JSON.parse(legacy);
        applyMapData(data, true);
        localStorage.removeItem(STORAGE_KEY);
        return;
      } catch (_) { /* fall through */ }
    }
    return;
  }
  try {
    const data = JSON.parse(raw);
    const migrated = migrateStorageData(data);
    rootNodes = migrated.rootNodes;
    rootConnections = migrateConnectionsList(migrated.rootConnections || []);
    migrateNodeTree(rootNodes);
    rootNodes.forEach(migrateNodeFields);
  } catch (e) {
    rootNodes = [];
    rootConnections = [];
    if (typeof showLoadErrorModal === 'function') {
      showLoadErrorModal('No se pudo leer el mapa guardado. Puedes restaurar desde un archivo exportado.');
    } else {
      showAppToast('Error al cargar el mapa guardado.', 6000);
    }
  }
}

function switchMap(mapId) {
  persistToStorage();
  const meta = getAppMeta();
  meta.currentMapId = mapId;
  saveAppMeta(meta);
  navigationStack = [];
  undoHistory = [];
  currentLocationName = 'HOME';
  loadState();
  syncLocationNameFromStack();
  render();
  if (typeof updateMapSelector === 'function') updateMapSelector();
  showAppToast('Mapa: ' + getCurrentMapName());
}

function createNewMap(name) {
  const id = 'map_' + generateNodeId();
  const index = getMapsIndex();
  index.push({ id, name: name || 'Nuevo mapa', updatedAt: new Date().toISOString() });
  saveMapsIndex(index);
  const payload = { version: STORAGE_VERSION, rootNodes: [], rootConnections: [] };
  localStorage.setItem(mapStorageKey(id), JSON.stringify(payload));
  switchMap(id);
}

function renameCurrentMap(name) {
  const index = getMapsIndex();
  const entry = index.find(m => m.id === getCurrentMapId());
  if (entry && name) {
    entry.name = name;
    saveMapsIndex(index);
    if (typeof updateMapSelector === 'function') updateMapSelector();
  }
}

function deleteCurrentMap() {
  const index = getMapsIndex();
  if (index.length <= 1) {
    showAppToast('Debe quedar al menos un mapa.');
    return;
  }
  const id = getCurrentMapId();
  localStorage.removeItem(mapStorageKey(id));
  const newIndex = index.filter(m => m.id !== id);
  saveMapsIndex(newIndex);
  switchMap(newIndex[0].id);
}

function exportMapToFile() {
  const payload = {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    mapName: getCurrentMapName(),
    rootNodes,
    rootConnections
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nucleus-${getCurrentMapId()}-${date}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showAppToast('Mapa exportado.');
}

function updateMapSelector() {
  const sel = document.getElementById('map-selector');
  if (!sel) return;
  const index = getMapsIndex();
  const current = getCurrentMapId();
  sel.innerHTML = index.map(m =>
    `<option value="${m.id}" ${m.id === current ? 'selected' : ''}>${escapeMapSelectLabel(m.name)}</option>`
  ).join('');
}

function initMultiMapFeatures() {
  ensureMapsIndex();
  updateMapSelector();
  const sel = document.getElementById('map-selector');
  const newBtn = document.getElementById('map-new-btn');
  const renameBtn = document.getElementById('map-rename-btn');
  const delBtn = document.getElementById('map-delete-btn');
  if (sel) sel.onchange = () => switchMap(sel.value);
  if (newBtn) newBtn.onclick = () => {
    const name = prompt('Nombre del nuevo mapa:', 'Nuevo mapa');
    if (name !== null) createNewMap(name.trim() || 'Nuevo mapa');
  };
  if (renameBtn) renameBtn.onclick = () => {
    const name = prompt('Renombrar mapa:', getCurrentMapName());
    if (name !== null) renameCurrentMap(name.trim());
  };
  if (delBtn) delBtn.onclick = () => {
    if (confirm('¿Eliminar este mapa? No se puede deshacer.')) deleteCurrentMap();
  };
}
