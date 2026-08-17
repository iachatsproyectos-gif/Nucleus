/**
 * Satélites del núcleo — accesos rápidos desde el holograma.
 */
const NUCLEUS_SATELLITES = [
  {
    id: 'home',
    label: 'home',
    sub: 'mapa principal',
    phi: 1.05,
    theta: 0.4,
    action: 'go-home'
  },
  {
    id: 'search',
    label: 'buscar',
    sub: 'en el mapa',
    phi: 0.85,
    theta: 1.8,
    action: 'open-search'
  },
  {
    id: 'fit',
    label: 'encuadrar',
    sub: 'ver todo',
    phi: 1.25,
    theta: 2.6,
    action: 'fit-view'
  },
  {
    id: 'up',
    label: 'subir',
    sub: 'nivel anterior',
    phi: 0.55,
    theta: 5.1,
    action: 'exit-level'
  }
];

function executeNucleusSatelliteAction(actionId) {
  if (typeof closeNucleusHub === 'function') closeNucleusHub(false);

  switch (actionId) {
    case 'go-home':
      goToHomeViewport?.();
      break;
    case 'open-search':
      openSearchPanel?.();
      break;
    case 'fit-view':
      fitViewportToCurrentLevel?.();
      break;
    case 'exit-level':
      if (navigationStack.length > 0) {
        exitNavigationLevel?.();
        fitViewportToCurrentLevel?.();
      } else {
        showAppToast?.('Ya estás en HOME.');
      }
      break;
    default:
      break;
  }
}

/** Navegación principal: clic en nodo del Núcleo. */
function executeNucleusNodeNav(nodeId) {
  if (typeof closeNucleusHub === 'function') closeNucleusHub(false);

  const ctx = getCurrentContext();
  const node = ctx.nodes.find(n => n.id === nodeId);
  if (!node) return;

  selectedNodeIds.clear();
  selectedNodeIds.add(node.id);
  selectedNode = node;
  contextMenuNode = null;

  if (node.type === 'stack' && node.subNodes && node.subNodes.length && nodeAllowsEnter(node)) {
    enterNavigationLevel(node);
    return;
  }

  render();
  centerViewportOnNode(node);
  if (typeof pushNavHistory === 'function') pushNavHistory(nodeId);
}
