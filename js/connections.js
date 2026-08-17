const PORT_SIDES = ['top', 'right', 'bottom', 'left'];
let _connectionsRaf = null;

let portDragging = false;
let portDragPreviewPath = null;
const svgPreviewLayer = document.getElementById('svg-preview-layer');

function migrateConnection(conn) {
  return {
    from: conn.from,
    to: conn.to,
    fromPort: conn.fromPort || 'right',
    toPort: conn.toPort || 'left',
    branch: conn.branch || undefined
  };
}

function migrateConnectionsList(connections) {
  if (!connections) return [];
  return connections.map(migrateConnection);
}

function migrateNodeTree(nodes) {
  nodes.forEach(n => {
    if (n.type === 'stack' && !Array.isArray(n.connections)) n.connections = [];
    if (n.connections) n.connections = migrateConnectionsList(n.connections);
    if (n.subNodes && n.subNodes.length) migrateNodeTree(n.subNodes);
  });
}

function getPortAnchorFromBounds(node, side) {
  const b = getNodeBounds(node);
  switch (side) {
    case 'top': return { x: b.x + b.w / 2, y: b.y };
    case 'bottom': return { x: b.x + b.w / 2, y: b.y + b.h };
    case 'left': return { x: b.x, y: b.y + b.h / 2 };
    case 'right': return { x: b.x + b.w, y: b.y + b.h / 2 };
    default: return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }
}

function getPortAnchor(node, el, side) {
  if (!el) return getPortAnchorFromBounds(node, side);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const pad = el.classList.contains('stack-mode') ? 2 : 3;
  switch (side) {
    case 'top': return { x: node.x + w / 2, y: node.y - pad };
    case 'bottom': return { x: node.x + w / 2, y: node.y + h + pad };
    case 'left': return { x: node.x - pad, y: node.y + h / 2 };
    case 'right': return { x: node.x + w + pad, y: node.y + h / 2 };
    default: return { x: node.x + w / 2, y: node.y + h / 2 };
  }
}

function buildConnectionPath(x1, y1, x2, y2, fromPort, toPort) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const alignThreshold = 4;

  const horizontalPair =
    (fromPort === 'right' && toPort === 'left') ||
    (fromPort === 'left' && toPort === 'right');
  const verticalPair =
    (fromPort === 'bottom' && toPort === 'top') ||
    (fromPort === 'top' && toPort === 'bottom');

  if (horizontalPair && Math.abs(dy) < alignThreshold) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  if (verticalPair && Math.abs(dx) < alignThreshold) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  const offset = dist < 60 ? Math.min(20, dist / 2) : Math.min(80, Math.max(30, dist / 3));

  if (horizontalPair) {
    const dir = fromPort === 'right' ? 1 : -1;
    return `M ${x1} ${y1} C ${x1 + dir * offset} ${y1}, ${x2 - dir * offset} ${y2}, ${x2} ${y2}`;
  }

  if (verticalPair) {
    const dir = fromPort === 'bottom' ? 1 : -1;
    return `M ${x1} ${y1} C ${x1} ${y1 + dir * offset}, ${x2} ${y2 - dir * offset}, ${x2} ${y2}`;
  }

  const cx1 = (fromPort === 'left' || fromPort === 'right')
    ? x1 + (fromPort === 'right' ? offset : -offset)
    : x1;
  const cy1 = (fromPort === 'top' || fromPort === 'bottom')
    ? y1 + (fromPort === 'bottom' ? offset : -offset)
    : y1;
  const cx2 = (toPort === 'left' || toPort === 'right')
    ? x2 + (toPort === 'left' ? -offset : offset)
    : x2;
  const cy2 = (toPort === 'top' || toPort === 'bottom')
    ? y2 + (toPort === 'top' ? -offset : offset)
    : y2;

  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

function clearPortHighlights() {
  document.querySelectorAll('.port-connecting').forEach(p => p.classList.remove('port-connecting'));
  document.querySelectorAll('.port-drop-target').forEach(p => p.classList.remove('port-drop-target'));
}

function clientToWorld(clientX, clientY) {
  return {
    x: (clientX - offsetX) / scale,
    y: (clientY - offsetY) / scale
  };
}

/** Salida (→ downstream): right/bottom. Entrada (← upstream): left/top. */
function isOutgoingPort(side) {
  return side === 'right' || side === 'bottom';
}

function defaultPortForIncoming(fromSide) {
  switch (fromSide) {
    case 'right': return 'left';
    case 'left': return 'right';
    case 'bottom': return 'top';
    case 'top': return 'bottom';
    default: return 'left';
  }
}

function cancelPortDrag() {
  portDragging = false;
  connectingNode = null;
  connectingFromPort = null;
  clearPortHighlights();
  if (portDragPreviewPath) {
    portDragPreviewPath.remove();
    portDragPreviewPath = null;
  }
  if (svgPreviewLayer) svgPreviewLayer.innerHTML = '';
}

function findPortOnNode(nodeEl, clientX, clientY) {
  const ports = nodeEl.querySelectorAll('.port');
  let best = null;
  let bestDist = Infinity;
  ports.forEach(port => {
    const r = port.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = (cx - clientX) ** 2 + (cy - clientY) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = port;
    }
  });
  if (!best) return null;
  return { nodeId: nodeEl.dataset.id, side: best.dataset.side, portEl: best };
}

function findPortAt(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const port = el?.closest?.('.port');
  if (port) {
    const nodeEl = port.closest('.node');
    if (!nodeEl?.dataset.id) return null;
    return { nodeId: nodeEl.dataset.id, side: port.dataset.side, portEl: port };
  }
  const nodeEl = el?.closest?.('.node');
  if (nodeEl?.dataset.id) return findPortOnNode(nodeEl, clientX, clientY);
  return null;
}

function highlightDropTarget(clientX, clientY) {
  document.querySelectorAll('.port-drop-target').forEach(p => p.classList.remove('port-drop-target'));
  const hit = findPortAt(clientX, clientY);
  if (hit && connectingNode && String(hit.nodeId) !== String(connectingNode.id)) {
    hit.portEl.classList.add('port-drop-target');
  }
}

function updatePortDragPreview(clientX, clientY) {
  if (!portDragging || !connectingNode || !connectingFromPort) return;
  const ctx = getCurrentContext();
  const srcEl = document.querySelector(`.node[data-id="${connectingNode.id}"]`);
  if (!srcEl) return;
  const a1 = getPortAnchor(connectingNode, srcEl, connectingFromPort);
  const world = clientToWorld(clientX, clientY);
  const toPort = defaultPortForIncoming(connectingFromPort);
  const d = buildConnectionPath(a1.x, a1.y, world.x, world.y, connectingFromPort, toPort);

  if (!portDragPreviewPath && svgPreviewLayer) {
    portDragPreviewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    portDragPreviewPath.setAttribute('class', 'connection-line connection-line-preview');
    svgPreviewLayer.appendChild(portDragPreviewPath);
  }
  if (portDragPreviewPath) portDragPreviewPath.setAttribute('d', d);
  highlightDropTarget(clientX, clientY);
}

function addConnection(ctx, fromId, toId, fromPort, toPort) {
  if (!Array.isArray(ctx.connections)) ctx.connections = [];
  const dup = ctx.connections.some(c =>
    c.from === fromId && c.to === toId && c.fromPort === fromPort && c.toPort === toPort
  );
  if (dup) return false;
  ctx.connections.push({ from: fromId, to: toId, fromPort, toPort });
  const fromNode = ctx.nodes.find(n => n.id === fromId);
  const toNode = ctx.nodes.find(n => n.id === toId);
  if (typeof onNodeConnected === 'function') onNodeConnected(fromNode, toNode);
  return true;
}

function spawnStackFromPortDrop(sourceNode, fromPort, worldX, worldY) {
  const ctx = getCurrentContext();
  const newId = generateNodeId();
  const newPort = defaultPortForIncoming(fromPort);
  const outgoing = isOutgoingPort(fromPort);

  let nx = worldX - 120;
  let ny = worldY - 40;
  const srcEl = document.querySelector(`.node[data-id="${sourceNode.id}"]`);
  const srcAnchor = getPortAnchor(sourceNode, srcEl, fromPort);
  const dist = Math.hypot(worldX - srcAnchor.x, worldY - srcAnchor.y);
  if (dist < 48) {
    const off = 260;
    if (fromPort === 'right') { nx = sourceNode.x + off; ny = sourceNode.y; }
    else if (fromPort === 'left') { nx = sourceNode.x - off; ny = sourceNode.y; }
    else if (fromPort === 'bottom') { nx = sourceNode.x; ny = sourceNode.y + 120; }
    else if (fromPort === 'top') { nx = sourceNode.x; ny = sourceNode.y - 120; }
  }

  const newNode = {
    id: newId,
    x: nx,
    y: ny,
    type: 'stack',
    title: '',
    mode: 'text',
    content: '',
    items: [{ text: '', checked: false }],
    subNodes: [],
    connections: [],
    isPainted: false,
    lifeTag: 'none'
  };
  ctx.nodes.push(newNode);

  if (outgoing) {
    addConnection(ctx, sourceNode.id, newId, fromPort, newPort);
  } else {
    addConnection(ctx, newId, sourceNode.id, newPort, fromPort);
  }

  selectedNodeIds.clear();
  selectedNodeIds.add(newId);
  focusNodeId = newId;
  return newNode;
}

function finishPortDrag(clientX, clientY) {
  if (!portDragging || !connectingNode || !connectingFromPort) {
    cancelPortDrag();
    return;
  }

  const ctx = getCurrentContext();
  const sourceNode = connectingNode;
  const fromPort = connectingFromPort;
  const hit = findPortAt(clientX, clientY);
  let changed = false;

  try {
    if (hit && String(hit.nodeId) !== String(sourceNode.id)) {
      const targetNode = ctx.nodes.find(n => String(n.id) === String(hit.nodeId));
      if (targetNode) {
        pushUndo();
        const toPort = hit.side;
        if (isOutgoingPort(fromPort)) {
          changed = addConnection(ctx, sourceNode.id, targetNode.id, fromPort, toPort);
        } else {
          changed = addConnection(ctx, targetNode.id, sourceNode.id, toPort, fromPort);
        }
      }
    } else {
      const onNode = document.elementFromPoint(clientX, clientY)?.closest?.('.node');
      if (!onNode) {
        pushUndo();
        const world = clientToWorld(clientX, clientY);
        spawnStackFromPortDrop(sourceNode, fromPort, world.x, world.y);
        showAppToast('Sub creada y conectada.');
        changed = true;
      }
    }
  } catch (err) {
    console.error('Error al conectar nodos:', err);
    showAppToast?.('No se pudo crear la conexión.');
  } finally {
    cancelPortDrag();
  }

  if (changed) {
    saveState(false);
    render();
  }
}

function startPortDrag(portEl, n, ctx, portSide, e) {
  e.preventDefault();
  e.stopPropagation();
  portDragging = true;
  connectingNode = n;
  connectingFromPort = portSide;
  clearPortHighlights();
  portEl.classList.add('port-connecting');

  const onMove = (ev) => updatePortDragPreview(ev.clientX, ev.clientY);
  const onUp = (ev) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    finishPortDrag(ev.clientX, ev.clientY);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  updatePortDragPreview(e.clientX, e.clientY);
}

function nodeHasPorts(n) {
  if (n.type === 'titulo' || n.type === 'region') return false;
  return true;
}

function buildPortsHTML() {
  return PORT_SIDES.map(side =>
    `<div class="port port-${side}" data-side="${side}"></div>`
  ).join('');
}

function setupPortHandlers(el, n, ctx) {
  el.querySelectorAll('.port').forEach(portEl => {
    portEl.onmousedown = (e) => {
      if (e.button !== 0) return;
      startPortDrag(portEl, n, ctx, portEl.dataset.side, e);
    };
  });
}

function scheduleDrawConnections(options = {}) {
  if (focusNodeId != null) options = { ...options, skipHighlights: false };
  if (_connectionsRaf) {
    _connectionsRafOpts = { ..._connectionsRafOpts, ...options };
    return;
  }
  _connectionsRafOpts = options;
  _connectionsRaf = requestAnimationFrame(() => {
    const opts = _connectionsRafOpts || {};
    _connectionsRaf = null;
    _connectionsRafOpts = null;
    drawConnections(opts);
  });
}

let _connectionsRafOpts = null;

function drawConnections(options = {}) {
  svgLayer.innerHTML = '';
  const ctx = getCurrentContext();
  if (!ctx.connections?.length) {
    if ((!options.skipHighlights || focusNodeId != null) && typeof updateDependencyHighlights === 'function') {
      updateDependencyHighlights();
    }
    return;
  }

  const nodeEls = new Map();
  nodesLayer.querySelectorAll('.node[data-id]').forEach(el => {
    nodeEls.set(Number(el.dataset.id), el);
  });

  const frag = document.createDocumentFragment();

  ctx.connections.forEach((conn, index) => {
    const f = ctx.nodes.find(node => node.id === conn.from);
    const t = ctx.nodes.find(node => node.id === conn.to);
    if (!f || !t) return;

    const fEl = nodeEls.get(f.id);
    const tEl = nodeEls.get(t.id);
    if (!fEl || !tEl) return;

    const fromPort = conn.fromPort || 'right';
    const toPort = conn.toPort || 'left';
    const a1 = getPortAnchor(f, fEl, fromPort);

    const a2 = getPortAnchor(t, tEl, toPort);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', buildConnectionPath(a1.x, a1.y, a2.x, a2.y, fromPort, toPort));
    path.setAttribute('class', 'connection-line');
    path.dataset.from = f.id;
    path.dataset.to = t.id;

    path.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      pushUndo();
      ctx.connections.splice(index, 1);
      saveState(false);
      drawConnections();
    };
    frag.appendChild(path);
  });

  svgLayer.appendChild(frag);

  if ((!options.skipHighlights || focusNodeId != null) && typeof updateDependencyHighlights === 'function') {
    updateDependencyHighlights();
  }
}
