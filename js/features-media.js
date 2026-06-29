let activeMediaNode = null;
const docModalOverlayForMedia = document.getElementById('doc-modal-overlay');

function openMediaModal(node, type) {
  activeMediaNode = node;
  document.getElementById(`${type}-url`).value = node.content || "";
  docModalOverlayForMedia.style.display = 'block';
  document.getElementById(`${type}-modal`).style.display = 'flex';
  document.getElementById(`${type}-url`).focus();
}

const mediaObserver = new MutationObserver(() => {
  const ctx = getCurrentContext();
  let refreshIcons = false;

  ctx.nodes.forEach(n => {
    if (n.type === 'link' || n.type === 'photo') {
      const el = document.querySelector(`.node[data-id="${n.id}"]`);
      if (el && !el.classList.contains(`${n.type}-mode`)) {
        el.classList.add(`${n.type}-mode`);
        const header = el.querySelector('.node-header');

        const iconContainer = document.createElement('div');
        iconContainer.className = 'icon-container';

        if (n.type === 'link') {
          iconContainer.innerHTML = '<i data-lucide="link" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
          el.ondblclick = (e) => { e.stopPropagation(); openMediaModal(n, 'link'); };
        } else if (n.type === 'photo') {
          iconContainer.innerHTML = n.content ? `<img src="${n.content}" class="photo-thumbnail">` : '<i data-lucide="image" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
          el.ondblclick = (e) => { e.stopPropagation(); openMediaModal(n, 'photo'); };
        }

        header.appendChild(iconContainer);
        refreshIcons = true;
      }
    }
  });
  if (refreshIcons) lucide.createIcons();
});

function initMedia() {
  document.getElementById('add-link-btn').onclick = () => createNode('link');
  document.getElementById('add-photo-btn').onclick = () => createNode('photo');

  document.querySelectorAll('.media-close-btn').forEach(btn => {
    btn.onclick = (e) => {
      const type = e.target.getAttribute('data-target');
      if (activeMediaNode) {
        const val = document.getElementById(`${type}-url`).value;
        if (activeMediaNode.content !== val) {
          pushUndo();
          activeMediaNode.content = val;
          saveState(false);

          if (type === 'photo') {
            const el = document.querySelector(`.node[data-id="${activeMediaNode.id}"] .icon-container`);
            if (el) {
              el.innerHTML = val ? `<img src="${val}" class="photo-thumbnail">` : '<i data-lucide="image" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
              lucide.createIcons({root: el.parentNode});
            }
          }
        }
      }
      docModalOverlayForMedia.style.display = 'none';
      document.getElementById(`${type}-modal`).style.display = 'none';
      activeMediaNode = null;
    };
  });

  document.getElementById('visit-link-btn').onclick = () => {
    const url = document.getElementById('link-url').value;
    if (url) window.open(url.startsWith('http') ? url : 'https://' + url, '_blank');
  };

  mediaObserver.observe(nodesLayer, { childList: true });
}
