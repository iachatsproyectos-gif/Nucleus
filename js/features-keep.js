function nodeToKeepText(node) {
  const title = node.title || 'Sin título';
  const body = extractNodeReadableText(node);
  if (node.mode === 'list' || node.mode === 'check') {
    const lines = (node.items || [])
      .filter(i => (i.text || '').trim())
      .map(i => '- ' + i.text);
    return title + '\n\n' + lines.join('\n');
  }
  return title + (body ? '\n\n' + body : '');
}

function exportSelectionToKeep() {
  const ctx = getCurrentContext();
  const menuTarget = getContextMenuNode();
  const ids = selectedNodeIds.size > 1
    ? Array.from(selectedNodeIds)
    : (menuTarget ? [menuTarget.id] : (selectedNode ? [selectedNode.id] : []));
  if (!ids.length) {
    showAppToast('Selecciona un nodo para exportar.');
    return;
  }
  const text = ids.map(id => {
    const n = ctx.nodes.find(x => x.id === id);
    return n ? nodeToKeepText(n) : '';
  }).filter(Boolean).join('\n\n---\n\n');

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
    showAppToast('Copiado en formato Keep.');
  } else {
    openKeepImportModal(text, true);
  }
}

function parseKeepText(text) {
  const lines = String(text).split(/\r?\n/);
  const items = [];
  let title = '';
  let body = [];
  lines.forEach(line => {
    if (line.startsWith('- ') || line.startsWith('* ')) {
      items.push(line.slice(2).trim());
    } else if (!title && line.trim()) {
      title = line.trim();
    } else if (line.trim()) {
      body.push(line.trim());
    }
  });
  return { title, body: body.join('\n'), items };
}

function importKeepText(text) {
  const parsed = parseKeepText(text);
  pushUndo();
  const ctx = getCurrentContext();
  if (parsed.items.length > 1) {
    const node = {
      id: generateNodeId(),
      x: (window.innerWidth / 2 - offsetX) / scale - 120,
      y: (window.innerHeight / 2 - offsetY) / scale - 40,
      type: 'system',
      title: parsed.title || 'IMPORTADO',
      mode: 'list',
      content: '',
      items: parsed.items.map(t => ({ text: t, checked: false })),
      subNodes: [],
      connections: [],
      isPainted: false
    };
    ctx.nodes.push(node);
  } else {
    const node = {
      id: generateNodeId(),
      x: (window.innerWidth / 2 - offsetX) / scale - 120,
      y: (window.innerWidth / 2 - offsetY) / scale - 40,
      type: 'stack',
      title: parsed.title || 'IMPORTADO',
      mode: 'text',
      content: parsed.body || parsed.items[0] || text,
      items: [{ text: '', checked: false }],
      subNodes: [],
      connections: [],
      isPainted: false
    };
    ctx.nodes.push(node);
  }
  saveState(false);
  render();
  showAppToast('Importado desde Keep.');
}

function openKeepImportModal(prefill, readOnly) {
  const modal = document.getElementById('keep-modal');
  const textarea = document.getElementById('keep-import-text');
  if (!modal || !textarea) return;
  textarea.value = prefill || '';
  textarea.readOnly = !!readOnly;
  modal.classList.add('visible');
}

function closeKeepModal() {
  document.getElementById('keep-modal')?.classList.remove('visible');
}

async function keepApiPush() {
  const cfg = getSyncConfig();
  if (!cfg.apiUrl || !cfg.token) {
    showAppToast('Configura sync y login primero.');
    return;
  }
  const ctx = getCurrentContext();
  const node = selectedNode || ctx.nodes.find(n => selectedNodeIds.has(n.id));
  if (!node) {
    showAppToast('Selecciona un nodo.');
    return;
  }
  const res = await fetch(cfg.apiUrl + '/keep/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + cfg.token
    },
    body: JSON.stringify({ title: node.title, text: nodeToKeepText(node) })
  });
  if (!res.ok) {
    showAppToast('Keep API: ' + res.status + ' (usa puente manual si falla)');
    return;
  }
  showAppToast('Enviado a Keep.');
}

async function keepApiPull() {
  const cfg = getSyncConfig();
  if (!cfg.apiUrl || !cfg.token) {
    showAppToast('Configura sync y login primero.');
    return;
  }
  const res = await fetch(cfg.apiUrl + '/keep/notes', {
    headers: { Authorization: 'Bearer ' + cfg.token }
  });
  if (!res.ok) {
    showAppToast('Keep API no disponible. Usa importar manual.');
    return;
  }
  const { notes } = await res.json();
  if (!notes?.length) {
    showAppToast('Sin notas en Keep.');
    return;
  }
  importKeepText(notes.map(n => n.title + '\n' + (n.text || '')).join('\n\n---\n\n'));
}

function initKeepFeatures() {
  document.getElementById('export-keep-btn')?.addEventListener('click', exportSelectionToKeep);
  document.getElementById('import-keep-btn')?.addEventListener('click', () => openKeepImportModal('', false));
  document.getElementById('menu-export-keep')?.addEventListener('click', () => {
    menu.style.display = 'none';
    exportSelectionToKeep();
  });
  document.getElementById('keep-import-confirm')?.addEventListener('click', () => {
    const text = document.getElementById('keep-import-text')?.value || '';
    importKeepText(text);
    closeKeepModal();
  });
  document.getElementById('keep-modal-close')?.addEventListener('click', closeKeepModal);
  document.getElementById('keep-api-push')?.addEventListener('click', keepApiPush);
  document.getElementById('keep-api-pull')?.addEventListener('click', keepApiPull);
}
