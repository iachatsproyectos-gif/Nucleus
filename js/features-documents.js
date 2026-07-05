let activeDocNode = null;
const docModalOverlay = document.getElementById('doc-modal-overlay');
const docModal = document.getElementById('doc-modal');
const docTextarea = document.getElementById('doc-textarea');

function openDocModal(node) {
  activeDocNode = node;
  docTextarea.value = node.content || "";
  docModalOverlay.style.display = 'block';
  docModal.style.display = 'flex';
  docTextarea.focus();
}

const renderObserver = new MutationObserver(() => {
  const ctx = getCurrentContext();
  let shouldRefreshIcons = false;

  ctx.nodes.forEach(n => {
    if (n.type === 'document') {
      const el = document.querySelector(`.node[data-id="${n.id}"]`);
      if (el && !el.querySelector('.icon-container')) {
        el.classList.add('document-mode');

        const header = el.querySelector('.node-header');
        const iconContainer = document.createElement('div');
        iconContainer.className = 'icon-container';
        iconContainer.innerHTML = '<i data-lucide="file-text" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
        header.appendChild(iconContainer);

        el.ondblclick = (e) => {
          e.stopPropagation();
          openDocModal(n);
        };

        shouldRefreshIcons = true;
      }
    }
  });

  if (shouldRefreshIcons) lucide.createIcons();
});

function initDocuments() {
  document.getElementById('add-doc-btn').onclick = () => createNode('document');

  document.getElementById('close-doc-modal').onclick = () => {
    if (activeDocNode) {
      if (activeDocNode.content !== docTextarea.value) {
        pushUndo();
        activeDocNode.content = docTextarea.value;
        saveState(false);
      }
      activeDocNode = null;
    }
    docModalOverlay.style.display = 'none';
    docModal.style.display = 'none';
  };

  renderObserver.observe(nodesLayer, { childList: true });
}
