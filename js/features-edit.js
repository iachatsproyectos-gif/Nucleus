function deepCloneNode(n, idMap, offsetX, offsetY) {
  const newId = generateNodeId();
  idMap[n.id] = newId;

  const clone = JSON.parse(JSON.stringify(n));
  clone.id = newId;
  clone.x = (n.x || 0) + offsetX;
  clone.y = (n.y || 0) + offsetY;

  if (clone.subNodes && clone.subNodes.length) {
    clone.subNodes = clone.subNodes.map(child =>
      deepCloneNode(child, idMap, 0, 0)
    );
    if (clone.connections && clone.connections.length) {
      clone.connections = clone.connections.map(c => ({
        from: idMap[c.from] || c.from,
        to: idMap[c.to] || c.to,
        fromPort: c.fromPort || 'right',
        toPort: c.toPort || 'left',
        branch: c.branch
      })).filter(c => idMap[c.from] && idMap[c.to]);
    }
  } else {
    clone.subNodes = clone.subNodes || [];
    clone.connections = [];
  }

  return clone;
}

function duplicateNodesInContext(ids, ctx) {
  pushUndo();
  const idMap = {};
  const clones = [];
  const offset = 40;

  ids.forEach(id => {
    const n = ctx.nodes.find(x => x.id === id);
    if (!n) return;
    clones.push(deepCloneNode(n, idMap, offset, offset));
  });

  ctx.nodes.push(...clones);

  const newIds = clones.map(c => c.id);
  const toClone = ctx.connections.filter(c => ids.includes(c.from) && ids.includes(c.to));
  toClone.forEach(c => {
      ctx.connections.push({
        from: idMap[c.from],
        to: idMap[c.to],
        fromPort: c.fromPort || 'right',
        toPort: c.toPort || 'left'
      });
  });

  selectedNodeIds.clear();
  newIds.forEach(id => selectedNodeIds.add(id));
  saveState(false);
  render();
  showAppToast('Duplicado.');
}

function duplicateSelection() {
  const ctx = getCurrentContext();
  const menuTarget = getContextMenuNode();
  const ids = selectedNodeIds.size > 1
    ? Array.from(selectedNodeIds)
    : (menuTarget ? [menuTarget.id] : (selectedNode ? [selectedNode.id] : []));
  if (!ids.length) return;
  duplicateNodesInContext(ids, ctx);
}

function initEditFeatures() {
  const dupBtn = document.getElementById('menu-duplicate');
  if (dupBtn) dupBtn.onclick = () => {
    menu.style.display = 'none';
    duplicateSelection();
  };
}
