function promoteStackToChapter(stack) {
  if (!stack || stack.type !== 'stack') return;
  pushUndo();
  stack.type = 'chapter';
  stack.phase = 'active';
  stack.lockedUntil = stack.lockedUntil || [];
  stack.closureNote = stack.closureNote || '';
  stack.closedAt = null;
  stack.approachNote = stack.approachNote || '';
  if (!stack.title) stack.title = 'CAPITULO_NUEVO';
  saveState(false);
  render();
  showChapterToast('Pila promovida a capítulo activo.');
}

function expandListToSubStacks(node) {
  if (!node || (node.mode !== 'list' && node.mode !== 'check')) return;
  pushUndo();
  if (!node.subNodes) node.subNodes = [];
  const items = (node.items || []).filter(i => (i.text || '').trim());
  items.forEach((item, i) => {
    node.subNodes.push({
      id: generateNodeId(),
      x: 40 + (i % 3) * 260,
      y: 60 + Math.floor(i / 3) * 100,
      type: 'stack',
      title: item.text.length > 28 ? item.text.slice(0, 28) + '…' : item.text,
      mode: 'text',
      content: item.text,
      items: [{ text: '', checked: false }],
      subNodes: [],
      connections: [],
      isPainted: false
    });
  });
  saveState(false);
  render();
  showAppToast(`${items.length} sub-pilas creadas.`);
}

function initCaptureFeatures() {
  const promoteBtn = document.getElementById('menu-promote-chapter');
  if (promoteBtn) promoteBtn.onclick = () => {
    const target = getContextMenuNode();
    if (target && target.type === 'stack') {
      promoteStackToChapter(target);
      menu.style.display = 'none';
    }
  };

  const expandBtn = document.getElementById('menu-expand-list');
  if (expandBtn) expandBtn.onclick = () => {
    const target = getContextMenuNode();
    if (target) {
      expandListToSubStacks(target);
      menu.style.display = 'none';
    }
  };
}
