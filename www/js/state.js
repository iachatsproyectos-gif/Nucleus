const viewport = document.getElementById("viewport");
const workspace = document.getElementById("workspace");
const nodesLayer = document.getElementById("nodes-layer");
const svgLayer = document.getElementById("svg-layer");
const menu = document.getElementById("menu");
const locationLabel = document.getElementById("location-label");
const locationWrap = document.getElementById("location-wrap");
const selectionBoxElement = document.getElementById("selection-box");

const addSystemBtn = document.getElementById("add-system-btn");
const addStackBtn = document.getElementById("add-stack-btn");
const undoBtn = document.getElementById("undo-btn");

let scale = 1, offsetX = window.innerWidth / 2, offsetY = window.innerHeight / 2;
let isPanning = false, startPanX = 0, startPanY = 0;

let isBoxSelecting = false;
let startSelX = 0, startSelY = 0;
let initialSelection = new Set();
let selectedNodeIds = new Set();

let rootNodes = [];
let rootConnections = [];
let navigationStack = [];
let selectedNode = null;
let connectingNode = null;
let connectingFromPort = null;

let undoHistory = [];

let currentLocationName = 'HOME';
let searchFilterType = 'all';

let hoveredNodeId = null;
let focusNodeId = null;
let contextMenuNode = null;

function getCurrentContext() {
  if (navigationStack.length === 0) return { nodes: rootNodes, connections: rootConnections, title: "HOME" };
  const last = navigationStack[navigationStack.length - 1];
  if (!Array.isArray(last.subNodes)) last.subNodes = [];
  if (!Array.isArray(last.connections)) last.connections = [];
  return { nodes: last.subNodes, connections: last.connections, title: last.title };
}

function countCurrentLevelNodes() {
  return getCurrentContext().nodes.filter(n => !n.type || !String(n.type).startsWith('auto-')).length;
}

function updateNodeCount() {
  const el = document.getElementById('node-count');
  if (!el) return;
  const count = countCurrentLevelNodes();
  el.textContent = count === 1 ? '1 nodo' : `${count} nodos`;
}

function updateSelectionVisuals() {
  document.querySelectorAll('.node').forEach(el => {
    if (selectedNodeIds.has(Number(el.dataset.id))) {
      el.classList.add('selected-node');
    } else {
      el.classList.remove('selected-node');
    }
  });
  document.querySelectorAll('.map-region').forEach(el => {
    el.classList.toggle('selected-region', selectedNodeIds.has(Number(el.dataset.regionId)));
  });
  if (typeof updateTituloVisuals === 'function') updateTituloVisuals();
}

function getFocusConnectedIds(nodeId, ctx) {
  const ids = new Set([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift();
    (ctx.connections || []).forEach(c => {
      let neighbor = null;
      if (c.from === current) neighbor = c.to;
      else if (c.to === current) neighbor = c.from;
      if (neighbor != null && !ids.has(neighbor)) {
        ids.add(neighbor);
        queue.push(neighbor);
      }
    });
  }
  return ids;
}

function connectionEdgeKey(fromId, toId) {
  return fromId < toId ? `${fromId}-${toId}` : `${toId}-${fromId}`;
}

function walkDirected(nodeId, ctx, direction) {
  const nodeIds = new Set([nodeId]);
  const edgeKeys = new Set();
  const queue = [nodeId];

  while (queue.length) {
    const current = queue.shift();
    (ctx.connections || []).forEach(c => {
      const next = direction === 'down'
        ? (c.from === current ? c.to : null)
        : (c.to === current ? c.from : null);
      if (next == null) return;
      edgeKeys.add(connectionEdgeKey(c.from, c.to));
      if (!nodeIds.has(next)) {
        nodeIds.add(next);
        queue.push(next);
      }
    });
  }

  return { nodeIds, edgeKeys };
}

/** Línea de tiempo del nodo: downstream (from→to) + upstream (to→from), sin ramas ajenas. */
function getDependencySpanFromNode(nodeId, ctx) {
  const down = walkDirected(nodeId, ctx, 'down');
  const up = walkDirected(nodeId, ctx, 'up');
  return {
    nodeIds: new Set([...down.nodeIds, ...up.nodeIds]),
    edgeKeys: new Set([...down.edgeKeys, ...up.edgeKeys])
  };
}

/** Con foco de dependencias activo, arrastrar nodos fuera del span debe desplazar el canvas. */
function shouldPanOverNode(nodeId) {
  if (focusNodeId == null || nodeId == null) return false;
  const span = getDependencySpanFromNode(focusNodeId, getCurrentContext());
  return !span.nodeIds.has(nodeId);
}

function getContextMenuNode() {
  return contextMenuNode;
}

function isTypingInInput() {
  const ae = document.activeElement;
  if (!ae) return false;
  if (ae.isContentEditable) return true;
  const tag = ae.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return true;
  if (ae.closest?.('#doc-modal, #link-modal, #photo-modal, #search-panel, #nucleus-hub, .media-modal, .chapter-modal')) return true;
  return false;
}

let _lastHoveredNodeId = null;

function updateHoverVisuals() {
  if (_lastHoveredNodeId === hoveredNodeId) return;
  if (_lastHoveredNodeId != null) {
    const prev = document.querySelector(`.node[data-id="${_lastHoveredNodeId}"], .titulo-node[data-id="${_lastHoveredNodeId}"]`);
    prev?.classList.remove('node-hovered', 'titulo-hovered');
    document.querySelector(`.map-region[data-region-id="${_lastHoveredNodeId}"]`)?.classList.remove('node-hovered');
  }
  if (hoveredNodeId != null) {
    const next = document.querySelector(`.node[data-id="${hoveredNodeId}"], .titulo-node[data-id="${hoveredNodeId}"]`);
    if (next) next.classList.add(next.classList.contains('titulo-node') ? 'titulo-hovered' : 'node-hovered');
    document.querySelector(`.map-region[data-region-id="${hoveredNodeId}"]`)?.classList.add('node-hovered');
  }
  _lastHoveredNodeId = hoveredNodeId;
}

function updateDependencyHighlights() {
  document.querySelectorAll('.node').forEach(el => {
    el.classList.remove('dep-focus', 'dep-linked', 'dep-dimmed');
  });
  document.querySelectorAll('.map-region').forEach(el => {
    el.classList.remove('dep-dimmed');
  });
  document.querySelectorAll('.connection-line').forEach(el => {
    el.classList.remove('dep-linked', 'dep-dimmed');
  });
  clearDependencyFlowStyles();
  if (focusNodeId == null) return;

  const ctx = getCurrentContext();
  if (!ctx.nodes.some(n => n.id === focusNodeId)) {
    focusNodeId = null;
    return;
  }

  const { nodeIds, edgeKeys } = getDependencySpanFromNode(focusNodeId, ctx);

  document.querySelectorAll('.node').forEach(el => {
    const id = Number(el.dataset.id);
    if (id === focusNodeId) el.classList.add('dep-focus');
    else if (nodeIds.has(id)) el.classList.add('dep-linked');
    else el.classList.add('dep-dimmed');
  });
  document.querySelectorAll('.map-region').forEach(el => {
    el.classList.add('dep-dimmed');
  });
  document.querySelectorAll('.connection-line').forEach(el => {
    const from = Number(el.dataset.from);
    const to = Number(el.dataset.to);
    if (edgeKeys.has(connectionEdgeKey(from, to))) {
      el.classList.add('dep-linked');
    } else {
      el.classList.add('dep-dimmed');
    }
  });

  applyDependencyFlowMotion(ctx, nodeIds, edgeKeys);
}

function clearDependencyFlowStyles() {
  document.querySelectorAll('.connection-line-bulge').forEach(el => el.remove());
}

const DEP_FLOW_MAX_EDGES = 36;

function applyDependencyFlowMotion(ctx, nodeIds, edgeKeys) {
  if (edgeKeys.size > DEP_FLOW_MAX_EDGES) return;
  document.querySelectorAll('.connection-line.dep-linked').forEach(path => {
    const len = path.getTotalLength();
    if (!len) return;

    const bulgeLen = Math.max(16, Math.min(36, len * 0.16));
    const gapLen = Math.max(1, len - bulgeLen);
    const isHorizon = path.classList.contains('connection-line-horizon');

    const bulge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bulge.setAttribute('d', path.getAttribute('d'));
    bulge.setAttribute('class', 'connection-line-bulge' + (isHorizon ? ' connection-line-bulge-horizon' : ''));
    bulge.dataset.from = path.dataset.from;
    bulge.dataset.to = path.dataset.to;
    bulge.style.setProperty('--path-len', String(len));
    bulge.style.strokeDasharray = `${bulgeLen} ${gapLen}`;
    bulge.style.strokeDashoffset = String(len);
    bulge.style.animationDelay = `${((Number(path.dataset.from) + Number(path.dataset.to)) % 9) * 0.12}s`;

    path.insertAdjacentElement('afterend', bulge);
  });
}

function clearDependencyFocus() {
  focusNodeId = null;
  updateDependencyHighlights();
}
