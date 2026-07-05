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

let chapterViewFilter = 'all';
let currentLocationName = 'HOME';
let focusModeEnabled = false;
let searchFilterType = 'all';

let hoveredNodeId = null;
let focusNodeId = null;
let contextMenuNode = null;

function getCurrentContext() {
  if (navigationStack.length === 0) return { nodes: rootNodes, connections: rootConnections, title: "HOME" };
  const last = navigationStack[navigationStack.length - 1];
  return { nodes: last.subNodes, connections: last.connections, title: last.title };
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

function getContextMenuNode() {
  return contextMenuNode;
}

function updateHoverVisuals() {
  document.querySelectorAll('.node').forEach(el => {
    el.classList.toggle('node-hovered', Number(el.dataset.id) === hoveredNodeId);
  });
  document.querySelectorAll('.map-region').forEach(el => {
    el.classList.toggle('node-hovered', Number(el.dataset.regionId) === hoveredNodeId);
  });
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
}

function clearDependencyFocus() {
  focusNodeId = null;
  updateDependencyHighlights();
}

function dismissDependencyFocusOnBackgroundClick(e) {
  if (e.button !== 0) return;
  const t = e.target;
  if (t.closest?.('.node')) return;
  if (t.closest?.('.map-region-label')) return;
  if (t.closest?.('.map-region-handle')) return;
  if (t.closest?.('.port')) return;
  if (t.closest?.('#menu')) return;
  if (t.classList?.contains('connection-line')) return;
  if (t.closest?.('button, input, select, textarea, label, a, [contenteditable="true"]')) return;
  clearDependencyFocus();
  if (!e.shiftKey) {
    selectedNodeIds.clear();
    updateSelectionVisuals();
  }
}
