const MIN_REGION_W = 80;
const MIN_REGION_H = 60;
const REGION_HANDLES = ['nw', 'ne', 'sw', 'se'];

function buildRegionHTML(n) {
  const handles = REGION_HANDLES.map(h =>
    `<div class="map-region-handle map-region-handle-${h}" data-handle="${h}"></div>`
  ).join('');
  return `<span class="map-region-label">${n.title || 'Región'}</span>${handles}`;
}

function applyRegionResize(n, orig, handle, dx, dy) {
  let { x, y, w, h } = orig;

  if (handle.includes('e')) w += dx;
  if (handle.includes('w')) { x += dx; w -= dx; }
  if (handle.includes('s')) h += dy;
  if (handle.includes('n')) { y += dy; h -= dy; }

  if (w < MIN_REGION_W) {
    if (handle.includes('w')) x -= MIN_REGION_W - w;
    w = MIN_REGION_W;
  }
  if (h < MIN_REGION_H) {
    if (handle.includes('n')) y -= MIN_REGION_H - h;
    h = MIN_REGION_H;
  }

  n.x = x;
  n.y = y;
  n.w = w;
  n.h = h;
}

function syncRegionFrame(frame, n) {
  frame.style.left = n.x + 'px';
  frame.style.top = n.y + 'px';
  frame.style.width = (n.w || 400) + 'px';
  frame.style.height = (n.h || 240) + 'px';
}

function bindRegionHandlers(frame, n, ctx) {
  if (isChapterReadOnlyContext()) return;

  frame.querySelectorAll('.map-region-handle').forEach(handleEl => {
    handleEl.onmousedown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      pushUndo();

      const handle = handleEl.dataset.handle;
      const startX = e.clientX;
      const startY = e.clientY;
      const orig = { x: n.x, y: n.y, w: n.w || 400, h: n.h || 240 };

      const move = (ev) => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        applyRegionResize(n, orig, handle, dx, dy);
        syncRegionFrame(frame, n);
      };

      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        saveState(false);
      };

      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };
  });

  const label = frame.querySelector('.map-region-label');
  if (!label) return;

  label.onmousedown = (e) => {
    if (e.button !== 0) return;
    if (label.isContentEditable) return;
    e.stopPropagation();

    selectedNodeIds.clear();
    selectedNodeIds.add(n.id);
    selectedNode = n;
    contextMenuNode = n;
    updateSelectionVisuals();

    const sX = e.clientX;
    const sY = e.clientY;
    const oX = n.x;
    const oY = n.y;
    let moved = false;

    const move = (ev) => {
      if (!moved) {
        moved = true;
        pushUndo();
      }
      n.x = oX + (ev.clientX - sX) / scale;
      n.y = oY + (ev.clientY - sY) / scale;
      syncRegionFrame(frame, n);
    };

    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      if (moved) saveState(false);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  label.ondblclick = (e) => {
    e.stopPropagation();
    label.contentEditable = 'true';
    label.classList.add('map-region-label-editing');
    label.focus();
    document.execCommand('selectAll', false, null);
  };
  label.onblur = () => {
    label.contentEditable = 'false';
    label.classList.remove('map-region-label-editing');
    const val = (label.textContent || '').trim().toUpperCase();
    if (val !== n.title) {
      pushUndo();
      n.title = val || 'REGIÓN';
      label.textContent = n.title;
      saveState(false);
    }
  };
  label.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      label.blur();
    }
    e.stopPropagation();
  };

  label.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenuNode = n;
    selectedNode = n;
    selectedNodeIds.clear();
    selectedNodeIds.add(n.id);
    updateSelectionVisuals();
    document.getElementById('menu-paint').style.display = 'none';
    const promoteEl = document.getElementById('menu-promote-chapter');
    if (promoteEl) promoteEl.style.display = 'none';
    const expandEl = document.getElementById('menu-expand-list');
    if (expandEl) expandEl.style.display = 'none';
    const keepEl = document.getElementById('menu-export-keep');
    if (keepEl) keepEl.style.display = 'none';
    updateChapterContextMenu(n);
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.display = 'block';
  };
}

function createRegion() {
  pushUndo();
  const ctx = getCurrentContext();
  const x = (window.innerWidth / 2 - offsetX) / scale;
  const y = (window.innerHeight / 2 - offsetY) / scale;
  ctx.nodes.unshift({
    id: generateNodeId(),
    x: x - 200,
    y: y - 120,
    w: 400,
    h: 240,
    type: 'region',
    title: 'REGIÓN',
    mode: 'text',
    content: '',
    items: [{ text: '', checked: false }],
    subNodes: [],
    connections: [],
    isPainted: false
  });
  saveState(false);
  render();
}

function initRegionsFeatures() {
  document.getElementById('add-region-btn')?.addEventListener('click', createRegion);
}
