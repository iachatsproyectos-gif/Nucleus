function createNode(type = 'system') {
  pushUndo();
  const ctx = getCurrentContext();
  const x = (window.innerWidth / 2 - offsetX) / scale;
  const y = (window.innerHeight / 2 - offsetY) / scale;

  const node = {
    id: generateNodeId(),
    x: x - 120,
    y: y - 40,
    type: type,
    title: (type === 'stack' || type === 'label') ? '' : ('OPTION_NODE_' + (ctx.nodes.length + 1)),
    mode: 'text',
    content: '',
    items: [{ text: '', checked: false }],
    subNodes: [],
    connections: [],
    isPainted: false
  };

  ctx.nodes.push(node);
  saveState(false);
  render();
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function bindNodeDragAndFocus(pointerEl, n, ctx, opts = {}) {
  pointerEl.onmousedown = (e) => {
    if (e.target.classList.contains('port')) return;
    if ((n.type === 'stack' || n.type === 'label') && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
    if (opts.header && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (opts.mediaTitle && e.target.classList.contains('title-input')) return;
    pushUndo();

    let isDraggingNode = false;
    let wasSelected = selectedNodeIds.has(n.id);

    if (e.shiftKey) {
      if (!wasSelected) selectedNodeIds.add(n.id);
    } else if (!wasSelected) {
      selectedNodeIds.clear();
      selectedNodeIds.add(n.id);
    }
    updateSelectionVisuals();

    const sX = e.clientX, sY = e.clientY;
    const startPositions = Array.from(selectedNodeIds).map(id => {
      let node = ctx.nodes.find(x => x.id === id);
      return node ? { id: id, oX: node.x, oY: node.y } : null;
    }).filter(Boolean);

    const move = (ev) => {
      isDraggingNode = true;
      let dx = (ev.clientX - sX) / scale;
      let dy = (ev.clientY - sY) / scale;
      startPositions.forEach(pos => {
        let node = ctx.nodes.find(x => x.id === pos.id);
        if (node) {
          node.x = pos.oX + dx; node.y = pos.oY + dy;
          let nodeEl = document.querySelector(`.node[data-id="${node.id}"]`);
          if (nodeEl) { nodeEl.style.left = node.x + 'px'; nodeEl.style.top = node.y + 'px'; }
        }
      });
      drawConnections();
    };

    document.addEventListener('mousemove', move);
    const onUp = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', onUp);
      if (!isDraggingNode) {
        if (opts.iconOnly) {
          focusNodeId = n.id;
          updateDependencyHighlights();
        } else if (e.shiftKey && wasSelected) {
          selectedNodeIds.delete(n.id);
          updateSelectionVisuals();
        } else if (!e.shiftKey) {
          selectedNodeIds.clear();
          selectedNodeIds.add(n.id);
          updateSelectionVisuals();
          focusNodeId = n.id;
          updateDependencyHighlights();
        }
      }
      saveState(false);
    };
    document.addEventListener('mouseup', onUp);
  };
}

function buildListItemHTML(n, item, i, total) {
  const bullet = n.mode === 'list'
    ? '<span class="list-bullet">■</span>'
    : `<input type="checkbox" class="check-box" ${item.checked ? 'checked' : ''} data-idx="${i}">`;
  return `
    <div class="list-item" data-idx="${i}">
      ${bullet}
      <input type="text" class="list-input" value="${item.text}" data-idx="${i}" placeholder="...">
      <span class="list-item-actions">
        <button type="button" class="list-item-btn" data-action="up" data-idx="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="list-item-btn" data-action="down" data-idx="${i}" ${i === total - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="list-item-btn" data-action="del" data-idx="${i}">×</button>
      </span>
    </div>`;
}

function bindListItemActions(el, n) {
  el.querySelectorAll('.list-item-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      const action = btn.dataset.action;
      if (Number.isNaN(idx)) return;
      pushUndo();
      if (action === 'up' && idx > 0) {
        const tmp = n.items[idx - 1];
        n.items[idx - 1] = n.items[idx];
        n.items[idx] = tmp;
      } else if (action === 'down' && idx < n.items.length - 1) {
        const tmp = n.items[idx + 1];
        n.items[idx + 1] = n.items[idx];
        n.items[idx] = tmp;
      } else if (action === 'del') {
        n.items.splice(idx, 1);
        if (!n.items.length) n.items.push({ text: '', checked: false });
      }
      render();
      saveState(false);
    };
  });
}

function render() {
  nodesLayer.innerHTML = '';
  const ctx = getCurrentContext();
  updateBreadcrumb();

  ctx.nodes.forEach(n => {
    if (n.type && String(n.type).startsWith('auto-')) return;
    if (isNodeHiddenByViewFilter(n)) return;
    if (n.type === 'region') {
      const frame = document.createElement('div');
      frame.className = 'map-region';
      frame.dataset.regionId = n.id;
      syncRegionFrame(frame, n);
      frame.innerHTML = buildRegionHTML(n);
      bindRegionHandlers(frame, n, ctx);
      nodesLayer.appendChild(frame);
      return;
    }
    const el = document.createElement('div');
    const chapter = isChapterNode(n);
    const readOnly = isChapterReadOnlyContext();
    const isLabel = n.type === 'label';
    el.className = [
      'node',
      n.type === 'stack' ? 'stack-mode' : '',
      isLabel ? 'label-mode' : '',
      n.type === 'document' ? 'document-mode' : '',
      n.type === 'link' ? 'link-mode' : '',
      n.type === 'photo' ? 'photo-mode' : '',
      n.isPainted ? 'is-painted' : '',
      chapter ? 'chapter-node phase-' + (n.phase || 'active') : '',
      n.lifeTag && n.lifeTag !== 'none' ? 'life-tag-' + n.lifeTag : ''
    ].filter(Boolean).join(' ');
    el.dataset.id = n.id;
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';

    if (chapter && n.phase === 'fogged' && n.lockedUntil && n.lockedUntil.length) {
      const labels = getPrereqLabels(n, ctx);
      if (labels.length) el.title = `Prerequisitos: ${labels.join(', ')}`;
    }

    const ro = new ResizeObserver(() => drawConnections());
    ro.observe(el);

    let bodyHTML = '';
    let footerHTML = '';
    let headerHTML = '';

    if (chapter) {
      bodyHTML = buildChapterBodyHTML(n, ctx);
      headerHTML = `<div class="node-header"><input type="text" class="title-input" value="${n.title}"></div>`;
    } else if (isLabel) {
      const styleAttr = n.w ? `style="width:${n.w};"` : '';
      bodyHTML = `<textarea class="content-area label-area" ${styleAttr} placeholder="[ TÍTULO ]">${n.content || ''}</textarea>`;
    } else if (n.mode === 'text') {
      const styleAttr = (n.type === 'stack' && n.w) ? `style="width:${n.w};"` : '';
      bodyHTML = `<textarea class="content-area" ${styleAttr} placeholder="[ ESCRIBE AQUÍ ]">${n.content}</textarea>`;
      headerHTML = `<div class="node-header"><input type="text" class="title-input" value="${n.title}"></div>`;
    } else {
      bodyHTML = n.items.map((item, i) => buildListItemHTML(n, item, i, n.items.length)).join('')
        + '<div class="add-item">+ añadir ítem</div>';
      headerHTML = `<div class="node-header"><input type="text" class="title-input" value="${n.title}"></div>`;
    }

    if (!chapter && !isLabel && n.type !== 'stack') {
      footerHTML = `
        <div class="node-toolbar">
          <button class="mode-btn ${n.mode === 'text' ? 'active' : ''}" data-mode="text">TXT</button>
          <button class="mode-btn ${n.mode === 'list' ? 'active' : ''}" data-mode="list">LST</button>
          <button class="mode-btn ${n.mode === 'check' ? 'active' : ''}" data-mode="check">PRMPT</button>
        </div>`;
    } else if (!chapter && !isLabel && n.type === 'stack') {
      headerHTML = `<div class="node-header"><input type="text" class="title-input" value="${n.title}"></div>`;
    }

    const portsHTML = nodeHasPorts(n) ? buildPortsHTML() : '';
    el.innerHTML = `
      ${portsHTML}
      ${headerHTML}
      <div class="node-body">${bodyHTML}</div>
      ${footerHTML}
    `;

    if (chapter) {
      /* chapter body is static hint — no content editors */
    } else if (isLabel) {
      const tx = el.querySelector('textarea.label-area');
      if (tx) {
        setTimeout(() => autoResize(tx), 0);
        if (!readOnly && chapterAllowsEdit(n)) {
          tx.oninput = (e) => { n.content = e.target.value; autoResize(tx); saveState(false); };
          tx.onmouseup = () => { if (tx.style.width) { n.w = tx.style.width; saveState(false); } };
          tx.onblur = () => saveState(true);
        } else {
          tx.readOnly = true;
        }
      }
    } else if (n.mode === 'text') {
      const tx = el.querySelector('textarea.content-area');
      if (tx) {
        setTimeout(() => autoResize(tx), 0);
        if (!readOnly && chapterAllowsEdit(n)) {
          if (n.type === 'stack') {
            tx.oninput = (e) => { n.content = e.target.value; autoResize(tx); saveState(false); };
            tx.onmouseup = () => { if (tx.style.width) { n.w = tx.style.width; saveState(false); } };
          } else {
            tx.oninput = (e) => { n.content = e.target.value; autoResize(tx); saveState(false); };
          }
          tx.onblur = () => saveState(true);
        } else {
          tx.readOnly = true;
        }
      }
    } else if (!chapter && !readOnly) {
      el.querySelectorAll('.list-input').forEach(inp => {
        inp.oninput = (e) => { n.items[e.target.dataset.idx].text = e.target.value; saveState(false); };
        inp.onblur = () => saveState(true);
      });
      if (n.mode === 'check') {
        el.querySelectorAll('.check-box').forEach(cb => cb.onchange = (e) => {
          pushUndo();
          n.items[e.target.dataset.idx].checked = e.target.checked;
          saveState(false);
        });
      }
      bindListItemActions(el, n);
      const addItem = el.querySelector('.add-item');
      if (addItem) addItem.onclick = () => {
        pushUndo();
        n.items.push({ text: '', checked: false });
        render();
        saveState(false);
      };
    }

    const titleInp = el.querySelector('.title-input');
    if (titleInp) {
      const canEditTitle = !readOnly && chapterTitleEditable(n);
      if (!canEditTitle) titleInp.readOnly = true;
      if (canEditTitle) {
        titleInp.oninput = (e) => { n.title = e.target.value.toUpperCase(); saveState(false); };
        titleInp.onblur = () => saveState(true);
      }
      if (n.type === 'link' || n.type === 'photo') {
        titleInp.onmousedown = (e) => e.stopPropagation();
        titleInp.onclick = (e) => e.stopPropagation();
      }
    }

    if (!chapter && !readOnly) {
      el.querySelectorAll('.mode-btn').forEach(btn => btn.onclick = () => {
        pushUndo();
        n.mode = btn.dataset.mode;
        render();
        saveState(false);
      });
    }

    const useBodyPointer = n.type === 'stack' || n.type === 'label' || n.type === 'document';
    const isMedia = n.type === 'link' || n.type === 'photo';

    if (useBodyPointer) {
      bindNodeDragAndFocus(el, n, ctx);
    } else if (!isMedia) {
      const headerEl = el.querySelector('.node-header');
      if (headerEl) bindNodeDragAndFocus(headerEl, n, ctx, { header: true });
    }

    el.onmouseenter = () => {
      hoveredNodeId = n.id;
      updateHoverVisuals();
    };
    el.onmouseleave = () => {
      if (hoveredNodeId === n.id) hoveredNodeId = null;
      updateHoverVisuals();
    };

    if (nodeHasPorts(n)) setupPortHandlers(el, n, ctx);

    el.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      contextMenuNode = n;
      selectedNode = n;
      selectedNodeIds.clear();
      selectedNodeIds.add(n.id);
      updateSelectionVisuals();
      document.getElementById('menu-paint').style.display = (n.type === 'stack' || Array.from(selectedNodeIds).some(id => ctx.nodes.find(x => x.id === id && x.type === 'stack'))) ? 'block' : 'none';
      const promoteEl = document.getElementById('menu-promote-chapter');
      if (promoteEl) promoteEl.style.display = n.type === 'stack' ? 'block' : 'none';
      const expandEl = document.getElementById('menu-expand-list');
      if (expandEl) expandEl.style.display = (n.mode === 'list' || n.mode === 'check') ? 'block' : 'none';
      const keepEl = document.getElementById('menu-export-keep');
      if (keepEl) keepEl.style.display = 'block';
      updateChapterContextMenu(n);
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.style.display = 'block';
    };

    nodesLayer.appendChild(el);
  });

  updateSelectionVisuals();
  updateHoverVisuals();
  updateDependencyHighlights();
  if (typeof updateFocusHighlights === 'function') updateFocusHighlights();
  lucide.createIcons();
  drawConnections();
  if (typeof updateEmptyState === 'function') updateEmptyState();
}
