if (addSystemBtn) addSystemBtn.onclick = () => createNode('system');
if (addStackBtn) addStackBtn.onclick = () => createNode('stack');
if (undoBtn) undoBtn.onclick = () => undo();
document.getElementById('add-label-btn')?.addEventListener('click', () => createTituloNode());

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  }
  if (e.key === 'Escape') {
    if (portDragging) {
      cancelPortDrag();
    } else if (connectingNode) {
      connectingNode = null;
      connectingFromPort = null;
      clearPortHighlights();
      drawConnections();
    } else if (focusNodeId != null) {
      clearDependencyFocus();
    }
  }
});

document.getElementById("menu-enter").onclick = () => {
  const target = getContextMenuNode();
  if (target) enterNavigationLevel(target);
};

document.getElementById("menu-paint").onclick = () => {
  const target = getContextMenuNode();
  if (!target || target.type !== 'stack') return;
  pushUndo();
  target.isPainted = !target.isPainted;
  saveState(false);
  menu.style.display = "none";
  render();
};

document.getElementById("menu-delete").onclick = () => {
  pushUndo();
  const ctx = getCurrentContext();
  const deletedIds = [];
  const menuTarget = getContextMenuNode();
  const idsToDelete = selectedNodeIds.size > 1
    ? Array.from(selectedNodeIds)
    : (menuTarget ? [menuTarget.id] : (selectedNode ? [selectedNode.id] : []));

  idsToDelete.forEach(id => {
    const nodeIdx = ctx.nodes.findIndex(n => n.id === id);
    if (nodeIdx > -1) {
      ctx.nodes.splice(nodeIdx, 1);
      ctx.connections = ctx.connections.filter(c => c.from !== id && c.to !== id);
      deletedIds.push(id);
    }
  });
  selectedNodeIds.clear();
  if (deletedIds.includes(focusNodeId)) clearDependencyFocus();
  const meta = getAppMeta();
  if (meta.inboxStackId && deletedIds.includes(meta.inboxStackId)) {
    delete meta.inboxStackId;
    saveAppMeta(meta);
  }
  saveState(false);
  menu.style.display = "none";
  contextMenuNode = null;
  render();
};

// Clic global: cerrar menú contextual y overlays
window.addEventListener('click', (e) => {
  if (e.target.closest('#app-topbar')) return;
  if (e.target.closest('#nucleus-hub')) return;
  if (e.target.closest('.nucleus-fab')) return;
  menu.style.display = "none";
  contextMenuNode = null;
  if (typeof closeAllOverlays === 'function') closeAllOverlays();
});
