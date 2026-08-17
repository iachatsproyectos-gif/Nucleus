let activeMediaNode = null;
const docModalOverlayForMedia = document.getElementById('doc-modal-overlay');

function normalizeLinkUrl(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

function getLinkHostname(url) {
  try {
    return new URL(normalizeLinkUrl(url)).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function getLinkFaviconUrl(url) {
  const host = getLinkHostname(url);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

function buildLinkIconHTML(url) {
  const favicon = getLinkFaviconUrl(url);
  if (favicon) {
    return `<img src="${favicon}" class="link-favicon" alt="" referrerpolicy="no-referrer">`;
  }
  return '<i data-lucide="link" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
}

function buildPhotoIconHTML(url) {
  return url
    ? `<img src="${url}" class="photo-thumbnail">`
    : '<i data-lucide="image" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
}

function updateLinkIconForNode(nodeId, url) {
  const el = document.querySelector(`.node[data-id="${nodeId}"] .icon-container`);
  if (!el) return;
  el.innerHTML = buildLinkIconHTML(url);
  el.querySelectorAll('.link-favicon').forEach(img => {
    img.onerror = () => {
      el.innerHTML = '<i data-lucide="link" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
      lucide.createIcons({ root: el.parentNode });
    };
  });
  lucide.createIcons({ root: el.parentNode });
}

function updatePhotoIconForNode(nodeId, url) {
  const el = document.querySelector(`.node[data-id="${nodeId}"] .icon-container`);
  if (!el) return;
  el.innerHTML = buildPhotoIconHTML(url);
  lucide.createIcons({ root: el.parentNode });
}

function openMediaModal(node, type) {
  activeMediaNode = node;
  document.getElementById(`${type}-url`).value = node.content || "";
  docModalOverlayForMedia.style.display = 'block';
  document.getElementById(`${type}-modal`).style.display = 'flex';
  document.getElementById(`${type}-url`).focus();
}

function setupMediaNode(el, n, ctx) {
  el.classList.add(`${n.type}-mode`);
  const header = el.querySelector('.node-header');
  if (!header || header.querySelector('.icon-container')) return false;

  const iconContainer = document.createElement('div');
  iconContainer.className = 'icon-container';

  if (n.type === 'link') {
    iconContainer.innerHTML = buildLinkIconHTML(n.content);
    iconContainer.querySelectorAll('.link-favicon').forEach(img => {
      img.onerror = () => {
        iconContainer.innerHTML = '<i data-lucide="link" style="width:28px;height:28px;color:var(--dim);pointer-events:none;"></i>';
        lucide.createIcons({ root: header });
      };
    });
    el.ondblclick = (e) => { e.stopPropagation(); openMediaModal(n, 'link'); };
  } else if (n.type === 'photo') {
    iconContainer.innerHTML = buildPhotoIconHTML(n.content);
    el.ondblclick = (e) => { e.stopPropagation(); openMediaModal(n, 'photo'); };
  }

  header.appendChild(iconContainer);
  bindNodeDragAndFocus(iconContainer, n, ctx, { iconOnly: true });
  return true;
}

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

          if (type === 'link') {
            updateLinkIconForNode(activeMediaNode.id, val);
          } else if (type === 'photo') {
            updatePhotoIconForNode(activeMediaNode.id, val);
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
    if (url) window.open(normalizeLinkUrl(url), '_blank', 'noopener,noreferrer');
  };

  document.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          pushUndo();
          const ctx = getCurrentContext();
          const x = (window.innerWidth / 2 - offsetX) / scale;
          const y = (window.innerHeight / 2 - offsetY) / scale;
          ctx.nodes.push({
            id: generateNodeId(),
            x: x - 60,
            y: y - 60,
            type: 'photo',
            title: 'FOTO',
            mode: 'text',
            content: reader.result,
            items: [{ text: '', checked: false }],
            subNodes: [],
            connections: [],
            isPainted: false
          });
          saveState(false);
          render();
          showAppToast('Imagen pegada.');
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  });
}
