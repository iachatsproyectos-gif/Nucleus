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
  saveState(false);
  render();
}

function saveState(shouldPushUndo = true) {
  if (shouldPushUndo) pushUndo();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ rootNodes, rootConnections }));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    rootNodes = data.rootNodes || [];
    rootConnections = migrateConnectionsList(data.rootConnections || []);
    migrateNodeTree(rootNodes);
  } catch (e) {}
}
