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
  const el = document.getElementById('app-toast');
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
    showAppToast('No se pudo guardar: almacenamiento lleno.', 6000);
  }
}

function migrateNodeFields(n) {
  if (n.type === 'label') {
    n.type = 'titulo';
    if (!n.content && n.title) n.content = n.title;
  }
  if (n.type === 'chapter') {
    n.type = 'stack';
    delete n.phase;
    delete n.lockedUntil;
    delete n.closureNote;
    delete n.closedAt;
    delete n.approachNote;
  }
  if (n.isInbox) {
    delete n.isInbox;
  }
  if (n.lifeTag === undefined) n.lifeTag = 'none';
  if (n.type === 'stack' && !Array.isArray(n.connections)) n.connections = [];
  if (!Array.isArray(n.subNodes)) n.subNodes = [];
  if (n.subNodes && n.subNodes.length) n.subNodes.forEach(migrateNodeFields);
}

function migrateStorageData(data) {
  return {
    rootNodes: data.rootNodes || [],
    rootConnections: data.rootConnections || []
  };
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
    showAppToast('Error al cargar el mapa guardado.', 6000);
  }
}
