function getNodeBounds(n) {
  if (n.type === 'region') {
    return { x: n.x, y: n.y, w: n.w || 400, h: n.h || 240 };
  }
  if (n.type === 'titulo') {
    return { x: n.x, y: n.y, w: 180, h: 36 };
  }
  return { x: n.x, y: n.y, w: 240, h: 100 };
}

function getCurrentLevelBounds() {
  const ctx = getCurrentContext();
  if (!ctx.nodes.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  ctx.nodes.forEach(n => {
    const b = getNodeBounds(n);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  });

  const pad = 48;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad
  };
}

function getVisibleWorldRect(margin = 200) {
  return {
    left: (-offsetX - margin) / scale,
    top: (-offsetY - margin) / scale,
    right: (window.innerWidth - offsetX + margin) / scale,
    bottom: (window.innerHeight - offsetY + margin) / scale
  };
}

function nodeIntersectsRect(n, rect) {
  const b = getNodeBounds(n);
  return b.x < rect.right && b.x + b.w > rect.left && b.y < rect.bottom && b.y + b.h > rect.top;
}

function scheduleViewportRender() {
  const ctx = getCurrentContext();
  if (ctx.nodes.length < 50) return;
  if (_viewportRenderTimer) clearTimeout(_viewportRenderTimer);
  _viewportRenderTimer = setTimeout(() => {
    _viewportRenderTimer = null;
    if (typeof render === 'function') render();
  }, 120);
}

let _viewportRenderTimer = null;

function updateTransform() {
  workspace.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  viewport.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  viewport.style.backgroundSize = `${24 * scale}px ${24 * scale}px`;
}

function fitViewportToCurrentLevel(padding = 72) {
  const bounds = getCurrentLevelBounds();
  if (!bounds) {
    offsetX = window.innerWidth / 2;
    offsetY = window.innerHeight / 2;
    scale = 1;
    updateTransform();
    return;
  }

  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  scale = Math.min(
    (window.innerWidth - padding * 2) / bw,
    (window.innerHeight - padding * 2) / bh,
    1.5
  );
  scale = Math.max(0.2, Math.min(2.5, scale));
  offsetX = window.innerWidth / 2 - cx * scale;
  offsetY = window.innerHeight / 2 - cy * scale;
  updateTransform();
}

function goToHomeViewport() {
  while (navigationStack.length > 0) navigationStack.pop();
  syncLocationNameFromStack();
  selectedNodeIds.clear();
  render();
  fitViewportToCurrentLevel();
}

viewport.addEventListener("wheel", (e) => {
  e.preventDefault();
  const oldScale = scale;
  scale = Math.min(Math.max(scale - e.deltaY * 0.001, 0.2), 2.5);
  offsetX -= (e.clientX - offsetX) * (scale / oldScale - 1);
  offsetY -= (e.clientY - offsetY) * (scale / oldScale - 1);
  updateTransform();
  scheduleViewportRender();
}, { passive: false });

viewport.addEventListener("mousedown", (e) => {
  const hitNode = e.target.closest('.node, .titulo-node');
  const hitRegionLabel = e.target.closest('.map-region-label');
  const hitRegionHandle = e.target.closest('.map-region-handle');
  const hitPort = e.target.closest('.port');
  const hitLine = e.target.classList?.contains('connection-line');
  const onCanvas = e.target.closest('#viewport');
  const backgroundClick = onCanvas && !hitNode && !hitRegionLabel && !hitRegionHandle && !hitPort && !hitLine;
  const hitNodeId = hitNode ? Number(hitNode.dataset.id) : null;
  const panOverDimmed = shouldPanOverNode(hitNodeId);
  const canPan = backgroundClick || panOverDimmed;

  if (backgroundClick && e.shiftKey && e.button === 0) {
    isBoxSelecting = true;
    startSelX = e.clientX; startSelY = e.clientY;
    initialSelection = new Set(selectedNodeIds);
    selectionBoxElement.style.display = 'block';
    selectionBoxElement.style.left = startSelX + 'px';
    selectionBoxElement.style.top = startSelY + 'px';
    selectionBoxElement.style.width = '0px';
    selectionBoxElement.style.height = '0px';
  } else if (canPan && e.button === 0 && !e.shiftKey) {
    isPanning = true;
    startPanX = e.clientX - offsetX;
    startPanY = e.clientY - offsetY;
  } else if (onCanvas && e.button === 1) {
    isPanning = true;
    startPanX = e.clientX - offsetX;
    startPanY = e.clientY - offsetY;
  }
});

window.addEventListener("mousemove", (e) => {
  if (isPanning) {
    offsetX = e.clientX - startPanX;
    offsetY = e.clientY - startPanY;
    updateTransform();
  }

  if (isBoxSelecting) {
    let currentX = e.clientX;
    let currentY = e.clientY;
    let left = Math.min(startSelX, currentX);
    let top = Math.min(startSelY, currentY);
    let width = Math.abs(currentX - startSelX);
    let height = Math.abs(currentY - startSelY);

    selectionBoxElement.style.left = left + 'px';
    selectionBoxElement.style.top = top + 'px';
    selectionBoxElement.style.width = width + 'px';
    selectionBoxElement.style.height = height + 'px';

    selectedNodeIds = new Set(initialSelection);
    let ctx = getCurrentContext();
    let rectSel = { left, top, right: left + width, bottom: top + height };

    ctx.nodes.forEach(n => {
      let el = document.querySelector(`.node[data-id="${n.id}"], .titulo-node[data-id="${n.id}"]`);
      if (el) {
        let rectNode = el.getBoundingClientRect();
        if (rectSel.left < rectNode.right && rectSel.right > rectNode.left &&
            rectSel.top < rectNode.bottom && rectSel.bottom > rectNode.top) {
          selectedNodeIds.add(n.id);
        }
      }
    });
    updateSelectionVisuals();
  }
});

window.addEventListener("mouseup", () => {
  if (isPanning && getCurrentContext().nodes.length >= 50 && typeof render === 'function') render();
  isPanning = false;
  if (isBoxSelecting) {
    isBoxSelecting = false;
    selectionBoxElement.style.display = 'none';
  }
});

let touchPanning = false;
let touchStartX = 0;
let touchStartY = 0;
let touchStartOffsetX = 0;
let touchStartOffsetY = 0;
let pinchStartDist = 0;
let pinchStartScale = 1;

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function touchMidpoint(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

viewport.addEventListener('touchstart', (e) => {
  if (e.target !== viewport && !e.target.closest('#workspace')) return;
  if (e.touches.length === 1) {
    touchPanning = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartOffsetX = offsetX;
    touchStartOffsetY = offsetY;
  } else if (e.touches.length === 2) {
    touchPanning = false;
    pinchStartDist = touchDistance(e.touches);
    pinchStartScale = scale;
  }
}, { passive: false });

viewport.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && touchPanning) {
    e.preventDefault();
    offsetX = touchStartOffsetX + (e.touches[0].clientX - touchStartX);
    offsetY = touchStartOffsetY + (e.touches[0].clientY - touchStartY);
    updateTransform();
    scheduleViewportRender();
  } else if (e.touches.length === 2 && pinchStartDist > 0) {
    e.preventDefault();
    const mid = touchMidpoint(e.touches);
    const oldScale = scale;
    scale = Math.min(Math.max(pinchStartScale * (touchDistance(e.touches) / pinchStartDist), 0.2), 2.5);
    offsetX -= (mid.x - offsetX) * (scale / oldScale - 1);
    offsetY -= (mid.y - offsetY) * (scale / oldScale - 1);
    updateTransform();
  }
}, { passive: false });

viewport.addEventListener('touchend', (e) => {
  if (touchPanning && getCurrentContext().nodes.length >= 50 && typeof render === 'function') render();
  touchPanning = false;
  if (e.touches.length < 2) pinchStartDist = 0;
});
