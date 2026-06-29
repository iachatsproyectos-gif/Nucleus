function updateTransform() {
  workspace.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  viewport.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  viewport.style.backgroundSize = `${24 * scale}px ${24 * scale}px`;
}

viewport.addEventListener("wheel", (e) => {
  e.preventDefault();
  const oldScale = scale;
  scale = Math.min(Math.max(scale - e.deltaY * 0.001, 0.2), 2.5);
  offsetX -= (e.clientX - offsetX) * (scale / oldScale - 1);
  offsetY -= (e.clientY - offsetY) * (scale / oldScale - 1);
  updateTransform();
}, { passive: false });

viewport.addEventListener("mousedown", (e) => {
  if (e.target === viewport && e.shiftKey && e.button === 0) {
    isBoxSelecting = true;
    startSelX = e.clientX; startSelY = e.clientY;
    initialSelection = new Set(selectedNodeIds);
    selectionBoxElement.style.display = 'block';
    selectionBoxElement.style.left = startSelX + 'px';
    selectionBoxElement.style.top = startSelY + 'px';
    selectionBoxElement.style.width = '0px';
    selectionBoxElement.style.height = '0px';
  } else if (e.target === viewport || e.button === 1) {
    if (!e.shiftKey) {
      isPanning = true;
      startPanX = e.clientX - offsetX;
      startPanY = e.clientY - offsetY;
      selectedNodeIds.clear();
      updateSelectionVisuals();
    }
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
      let el = document.querySelector(`.node[data-id="${n.id}"]`);
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
  isPanning = false;
  if (isBoxSelecting) {
    isBoxSelecting = false;
    selectionBoxElement.style.display = 'none';
  }
});
