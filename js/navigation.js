function findNodePath(id, nodes, path) {
  nodes = nodes || rootNodes;
  path = path || [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) return path.concat(n);
    if (n.subNodes && n.subNodes.length) {
      const found = findNodePath(id, n.subNodes, path.concat(n));
      if (found) return found;
    }
  }
  return null;
}

function findNodeContextInfo(id, nodes, connections, path) {
  nodes = nodes || rootNodes;
  connections = connections || rootConnections;
  path = path || [];

  for (const n of nodes) {
    if (n.id === id) {
      return { nodes, connections, path };
    }
  }
  for (const n of nodes) {
    if (n.subNodes && n.subNodes.length) {
      const found = findNodeContextInfo(
        id,
        n.subNodes,
        n.connections || [],
        path.concat(n)
      );
      if (found) return found;
    }
  }
  return null;
}

function locationLabelFromNode(n) {
  if (!n) return 'HOME';
  const label = (n.title || '').trim();
  if (label) return label;
  if (isChapterNode(n)) return 'Capítulo';
  if (n.type === 'stack') return 'Sub';
  return 'Sin título';
}

/** Reemplaza el texto de ubicación — nunca concatena la ruta. */
function syncLocationNameFromStack() {
  if (navigationStack.length === 0) {
    currentLocationName = 'HOME';
    return;
  }
  currentLocationName = locationLabelFromNode(navigationStack[navigationStack.length - 1]);
}

function nodeAllowsEnter(n) {
  if (!n || n.type === 'region') return false;
  return chapterAllowsEnter(n);
}

function enterNavigationLevel(node) {
  if (!node || !nodeAllowsEnter(node)) return;
  const ctx = getCurrentContext();
  const fresh = ctx.nodes.find(n => n.id === node.id) || node;
  navigationStack.push(fresh);
  currentLocationName = locationLabelFromNode(fresh);
  selectedNodeIds.clear();
  if (menu) menu.style.display = 'none';
  clearDependencyFocus();
  render();
}

function exitNavigationLevel() {
  if (navigationStack.length === 0) return;
  navigationStack.pop();
  syncLocationNameFromStack();
  selectedNodeIds.clear();
  clearDependencyFocus();
  render();
}

function rebuildNavigationStack(path) {
  navigationStack = path.slice(0, -1);
  syncLocationNameFromStack();
}

function centerViewportOnNode(node) {
  const targetX = window.innerWidth / 2 - (node.x + 120) * scale;
  const targetY = window.innerHeight / 2 - (node.y + 40) * scale;
  const startX = offsetX;
  const startY = offsetY;
  const start = performance.now();
  const duration = 350;

  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    offsetX = startX + (targetX - startX) * ease;
    offsetY = startY + (targetY - startY) * ease;
    updateTransform();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function navigateToNode(id) {
  const path = findNodePath(id);
  if (!path || !path.length) return false;

  const node = path[path.length - 1];
  rebuildNavigationStack(path);
  selectedNodeIds.clear();
  selectedNodeIds.add(node.id);
  selectedNode = node;
  render();
  centerViewportOnNode(node);
  if (typeof pushNavHistory === 'function') pushNavHistory(id);
  return true;
}

function updateLocationIndicator() {
  const input = document.getElementById('location-label');
  const wrap = document.getElementById('location-wrap');
  if (!input) return;

  input.value = currentLocationName;

  if (wrap) {
    wrap.title = navigationStack.length > 0
      ? 'Clic para subir un nivel'
      : 'Estás en el mapa principal';
    wrap.onclick = exitNavigationLevel;
  }
}

function updateBreadcrumb() {
  updateLocationIndicator();
}
