const PORT_SIDES = ['top', 'right', 'bottom', 'left'];

function migrateConnection(conn) {
  return {
    from: conn.from,
    to: conn.to,
    fromPort: conn.fromPort || 'right',
    toPort: conn.toPort || 'left'
  };
}

function migrateConnectionsList(connections) {
  if (!connections) return [];
  return connections.map(migrateConnection);
}

function migrateNodeTree(nodes) {
  nodes.forEach(n => {
    if (n.connections) n.connections = migrateConnectionsList(n.connections);
    if (n.subNodes && n.subNodes.length) migrateNodeTree(n.subNodes);
  });
}

function getPortAnchor(node, el, side) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  switch (side) {
    case 'top': return { x: node.x + w / 2, y: node.y };
    case 'bottom': return { x: node.x + w / 2, y: node.y + h };
    case 'left': return { x: node.x, y: node.y + h / 2 };
    case 'right': return { x: node.x + w, y: node.y + h / 2 };
    default: return { x: node.x + w / 2, y: node.y + h / 2 };
  }
}

function buildConnectionPath(x1, y1, x2, y2, fromPort, toPort) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.min(80, Math.max(30, dist / 3));

  const horizontalPair =
    (fromPort === 'right' && toPort === 'left') ||
    (fromPort === 'left' && toPort === 'right');
  const verticalPair =
    (fromPort === 'bottom' && toPort === 'top') ||
    (fromPort === 'top' && toPort === 'bottom');

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
}

function nodeHasPorts(n) {
  if (n.type === 'chapter' && n.phase !== 'active') return false;
  return !['document', 'link', 'photo'].includes(n.type);
}

function buildPortsHTML() {
  return PORT_SIDES.map(side =>
    `<div class="port port-${side}" data-side="${side}"></div>`
  ).join('');
}

function setupPortHandlers(el, n, ctx) {
  el.querySelectorAll('.port').forEach(portEl => {
    portEl.onclick = (e) => {
      e.stopPropagation();
      const portSide = portEl.dataset.side;

      if (connectingNode && connectingNode.id !== n.id) {
        const fromPort = connectingFromPort;
        const toPort = portSide;
        const dup = ctx.connections.some(c =>
          c.from === connectingNode.id && c.to === n.id &&
          c.fromPort === fromPort && c.toPort === toPort
        );
        if (!dup) {
          pushUndo();
          ctx.connections.push({ from: connectingNode.id, to: n.id, fromPort, toPort });
          saveState(false);
        }
        connectingNode = null;
        connectingFromPort = null;
        clearPortHighlights();
      } else if (!connectingNode) {
        connectingNode = n;
        connectingFromPort = portSide;
        clearPortHighlights();
        portEl.classList.add('port-connecting');
      } else {
        connectingNode = null;
        connectingFromPort = null;
        clearPortHighlights();
      }
      drawConnections();
    };
  });
}

function drawConnections() {
  svgLayer.innerHTML = "";
  const ctx = getCurrentContext();
  if (!ctx.connections) return;

  ctx.connections.forEach((conn, index) => {
    const f = ctx.nodes.find(node => node.id === conn.from);
    const t = ctx.nodes.find(node => node.id === conn.to);
    if (!f || !t) return;

    const fEl = document.querySelector(`.node[data-id="${f.id}"]`);
    const tEl = document.querySelector(`.node[data-id="${t.id}"]`);
    if (!fEl || !tEl) return;

    const fromPort = conn.fromPort || 'right';
    const toPort = conn.toPort || 'left';
    const a1 = getPortAnchor(f, fEl, fromPort);
    const a2 = getPortAnchor(t, tEl, toPort);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", buildConnectionPath(a1.x, a1.y, a2.x, a2.y, fromPort, toPort));
    path.setAttribute("class", "connection-line");

    path.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      pushUndo();
      ctx.connections.splice(index, 1);
      saveState(false);
      drawConnections();
    };
    svgLayer.appendChild(path);
  });
}
