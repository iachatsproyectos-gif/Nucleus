function createTituloNode() {
  pushUndo();
  const ctx = getCurrentContext();
  const x = (window.innerWidth / 2 - offsetX) / scale;
  const y = (window.innerHeight / 2 - offsetY) / scale;
  ctx.nodes.push({
    id: generateNodeId(),
    x: x - 80,
    y: y - 18,
    type: 'titulo',
    content: ''
  });
  saveState(false);
  render();
}

function autoResizeTitulo(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
  textarea.style.width = 'auto';
  const w = Math.max(72, textarea.scrollWidth + 8);
  textarea.style.width = w + 'px';
}

function bindTituloInteractions(el, n, ctx, textarea) {
  textarea.oninput = (e) => {
    n.content = e.target.value;
    autoResizeTitulo(textarea);
    saveState(false);
  };
  textarea.onblur = () => saveState(true);

  el.onmousedown = (e) => {
    if (e.button !== 0) return;
    if (document.activeElement === textarea && e.target === textarea) return;
    if (shouldPanOverNode(n.id)) return;

    e.preventDefault();
    let moved = false;
    const sX = e.clientX;
    const sY = e.clientY;
    const wasSelected = selectedNodeIds.has(n.id);

    if (e.shiftKey) {
      if (!wasSelected) selectedNodeIds.add(n.id);
    } else if (!wasSelected) {
      selectedNodeIds.clear();
      selectedNodeIds.add(n.id);
    }
    updateTituloVisuals();

    const startPositions = Array.from(selectedNodeIds).map(id => {
      const node = ctx.nodes.find(x => x.id === id);
      return node ? { id, oX: node.x, oY: node.y } : null;
    }).filter(Boolean);

    const move = (ev) => {
      const dx = (ev.clientX - sX) / scale;
      const dy = (ev.clientY - sY) / scale;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      if (!moved) {
        moved = true;
        pushUndo();
        el.classList.add('titulo-dragging');
      }
      startPositions.forEach(pos => {
        const node = ctx.nodes.find(x => x.id === pos.id);
        if (!node) return;
        node.x = pos.oX + dx;
        node.y = pos.oY + dy;
        const nodeEl = document.querySelector(`.titulo-node[data-id="${node.id}"]`);
        if (nodeEl) {
          nodeEl.style.left = node.x + 'px';
          nodeEl.style.top = node.y + 'px';
        }
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', onUp);
      el.classList.remove('titulo-dragging');
      if (!moved) {
        if (e.shiftKey && wasSelected) selectedNodeIds.delete(n.id);
        textarea.focus();
        updateTituloVisuals();
      } else {
        saveState(false);
      }
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', onUp);
  };

  el.onmouseenter = () => {
    hoveredNodeId = n.id;
    updateTituloVisuals();
  };
  el.onmouseleave = () => {
    if (hoveredNodeId === n.id) hoveredNodeId = null;
    updateTituloVisuals();
  };

  el.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenuNode = n;
    selectedNode = n;
    selectedNodeIds.clear();
    selectedNodeIds.add(n.id);
    updateTituloVisuals();
    document.getElementById('menu-paint').style.display = 'none';
    const expandEl = document.getElementById('menu-expand-list');
    if (expandEl) expandEl.style.display = 'none';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.display = 'block';
  };
}

function updateTituloVisuals() {
  document.querySelectorAll('.titulo-node').forEach(el => {
    const id = Number(el.dataset.id);
    el.classList.toggle('titulo-selected', selectedNodeIds.has(id));
    el.classList.toggle('titulo-hovered', id === hoveredNodeId);
  });
}

function renderTituloNode(n, ctx, readOnly) {
  const el = document.createElement('div');
  el.className = 'titulo-node';
  el.dataset.id = n.id;
  el.style.left = n.x + 'px';
  el.style.top = n.y + 'px';

  el.innerHTML = `
    <div class="titulo-glass">
      <textarea class="titulo-text" rows="1" placeholder="Título" spellcheck="false">${n.content || ''}</textarea>
    </div>
  `;

  const textarea = el.querySelector('.titulo-text');
  setTimeout(() => autoResizeTitulo(textarea), 0);

  if (readOnly) {
    textarea.readOnly = true;
  } else {
    bindTituloInteractions(el, n, ctx, textarea);
  }

  if (selectedNodeIds.has(n.id)) el.classList.add('titulo-selected');
  if (hoveredNodeId === n.id) el.classList.add('titulo-hovered');

  return el;
}
