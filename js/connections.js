const PORT_SIDES = ['top', 'right', 'bottom', 'left'];

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
    if (n.connections) n.connections = migrateConnectionsList(n.connections);
    if (n.subNodes && n.subNodes.length) migrateNodeTree(n.subNodes);
  });
}

function getPortAnchor(node, el, side) {
  const portEl = el.querySelector(`.port-${side}`);
  if (portEl) {
    const nodeRect = el.getBoundingClientRect();
    const portRect = portEl.getBoundingClientRect();
    const relX = (portRect.left + portRect.width / 2 - nodeRect.left) / scale;
    const relY = (portRect.top + portRect.height / 2 - nodeRect.top) / scale;
    return { x: node.x + relX, y: node.y + relY };
  }
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
}

function nodeHasPorts(n) {
  if (n.type === 'region') return false;
  if (n.type === 'chapter') {
    return n.phase === 'active' || n.phase === 'fogged' || n.phase === 'unlocked';
  }
  return true;
}

function isHorizonChapterPhase(n) {
  return isChapterNode(n) && (n.phase === 'fogged' || n.phase === 'unlocked');
}

function getHorizonGradientInfo(f, t, a1, a2) {
  if (isChapterNode(f) && f.phase === 'active' && isHorizonChapterPhase(t)) {
    return { solid: a1, fade: a2 };
  }
  if (isChapterNode(t) && t.phase === 'active' && isHorizonChapterPhase(f)) {
    return { solid: a2, fade: a1 };
  }
  return null;
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
  svgLayer.innerHTML = '';
  const ctx = getCurrentContext();
  if (!ctx.connections) return;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svgLayer.appendChild(defs);

  ctx.connections.forEach((conn, index) => {
    const f = ctx.nodes.find(node => node.id === conn.from);
    const t = ctx.nodes.find(node => node.id === conn.to);
    if (!f || !t) return;
    if (typeof isNodeHiddenByViewFilter === 'function') {
      if (isNodeHiddenByViewFilter(f) || isNodeHiddenByViewFilter(t)) return;
    }

    const fEl = document.querySelector(`.node[data-id="${f.id}"]`);
    const tEl = document.querySelector(`.node[data-id="${t.id}"]`);
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

    const horizon = getHorizonGradientInfo(f, t, a1, a2);
    if (horizon) {
      const gradId = 'horizon-grad-' + conn.from + '-' + conn.to + '-' + index;
      const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      grad.setAttribute('id', gradId);
      grad.setAttribute('gradientUnits', 'userSpaceOnUse');
      grad.setAttribute('x1', horizon.solid.x);
      grad.setAttribute('y1', horizon.solid.y);
      grad.setAttribute('x2', horizon.fade.x);
      grad.setAttribute('y2', horizon.fade.y);
      const stopA = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopA.setAttribute('offset', '0%');
      stopA.setAttribute('stop-color', 'rgba(255, 255, 255, 0.42)');
      const stopB = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopB.setAttribute('offset', '100%');
      stopB.setAttribute('stop-color', 'rgba(255, 255, 255, 0.04)');
      grad.appendChild(stopA);
      grad.appendChild(stopB);
      defs.appendChild(grad);
      path.setAttribute('stroke', `url(#${gradId})`);
      path.setAttribute('class', 'connection-line connection-line-horizon');
    }

    path.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      pushUndo();
      ctx.connections.splice(index, 1);
      saveState(false);
      drawConnections();
    };
    svgLayer.appendChild(path);
  });
  if (typeof updateDependencyHighlights === 'function') updateDependencyHighlights();
}
