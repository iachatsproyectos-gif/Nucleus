addSystemBtn.onclick = () => createNode('system');
addStackBtn.onclick = () => createNode('stack');
undoBtn.onclick = () => undo();

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  }
  if (e.key === 'Escape' && connectingNode) {
    connectingNode = null;
    connectingFromPort = null;
    clearPortHighlights();
    drawConnections();
  }
});

document.getElementById("menu-enter").onclick = () => {
  if (selectedNode && chapterAllowsEnter(selectedNode)) {
    navigationStack.push(selectedNode);
    selectedNodeIds.clear();
    menu.style.display = "none";
    render();
  }
};

document.getElementById("menu-paint").onclick = () => {
  pushUndo();
  let ctx = getCurrentContext();
  if (selectedNodeIds.size > 0) {
    selectedNodeIds.forEach(id => {
      let n = ctx.nodes.find(x => x.id === id);
      if (n && n.type === 'stack') n.isPainted = !n.isPainted;
    });
  } else if (selectedNode && selectedNode.type === 'stack') {
    selectedNode.isPainted = !selectedNode.isPainted;
  }
  saveState(false);
  menu.style.display = "none";
  render();
};

document.getElementById("menu-delete").onclick = () => {
  pushUndo();
  const ctx = getCurrentContext();
  if (selectedNodeIds.size > 0) {
    selectedNodeIds.forEach(id => {
      const nodeIdx = ctx.nodes.findIndex(n => n.id === id);
      if (nodeIdx > -1) {
        ctx.nodes.splice(nodeIdx, 1);
        ctx.connections = ctx.connections.filter(c => c.from !== id && c.to !== id);
      }
    });
    selectedNodeIds.clear();
  } else if (selectedNode) {
    const nodeIdx = ctx.nodes.findIndex(n => n.id === selectedNode.id);
    if (nodeIdx > -1) {
      ctx.nodes.splice(nodeIdx, 1);
      ctx.connections = ctx.connections.filter(c => c.from !== selectedNode.id && c.to !== selectedNode.id);
    }
  }
  saveState(false);
  menu.style.display = "none"; render();
};

breadcrumb.onclick = () => { if (navigationStack.length > 0) { navigationStack.pop(); selectedNodeIds.clear(); render(); } };
window.onclick = () => {
  menu.style.display = "none";
  if (typeof closeAllOverlays === 'function') closeAllOverlays();
};
