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

function setupDocumentNode(el, n) {
  el.classList.add('document-mode');
  const header = el.querySelector('.node-header');
  if (!header || header.querySelector('.icon-container')) return false;

  const iconContainer = document.createElement('div');
  iconContainer.className = 'icon-container';
  iconContainer.innerHTML = '<i data-lucide="file-text" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
  header.appendChild(iconContainer);

  el.ondblclick = (e) => {
    e.stopPropagation();
    openDocModal(n);
  };
  return true;
}

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
}
