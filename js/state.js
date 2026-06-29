const viewport = document.getElementById("viewport");
const workspace = document.getElementById("workspace");
const nodesLayer = document.getElementById("nodes-layer");
const svgLayer = document.getElementById("svg-layer");
const menu = document.getElementById("menu");
const breadcrumb = document.getElementById("breadcrumb");
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
}
