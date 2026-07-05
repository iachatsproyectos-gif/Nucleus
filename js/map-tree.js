function walkMapTree(callback, nodes, path) {
  nodes = nodes || rootNodes;
  path = path || ['HOME'];
  nodes.forEach(n => {
    callback(n, path);
    if (n.subNodes && n.subNodes.length) {
      const label = n.title || (isChapterNode(n) ? 'Capítulo' : 'Nivel');
      walkMapTree(callback, n.subNodes, path.concat([label]));
    }
  });
}

function getAllMapNodes() {
  const result = [];
  walkMapTree((n, path) => {
    result.push({
      node: n,
      id: n.id,
      path: path.join(' › '),
      label: (n.title || 'Sin título') + ' (' + nodeTypeLabel(n) + ')'
    });
  });
  return result;
}

function nodeTypeLabel(n) {
  if (isChapterNode(n)) return 'capítulo';
  if (n.type === 'stack') return 'sub';
  if (n.type === 'label') return 'título';
  if (n.type === 'document') return 'doc';
  if (n.type === 'link') return 'link';
  if (n.type === 'photo') return 'foto';
  return 'nodo';
}

function findNodeById(id, nodes) {
  nodes = nodes || rootNodes;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) return n;
    if (n.subNodes && n.subNodes.length) {
      const found = findNodeById(id, n.subNodes);
      if (found) return found;
    }
  }
  return null;
}

function extractNodeReadableText(n) {
  if (isChapterNode(n)) {
    const parts = [];
    if (n.title) parts.push(n.title);
    if (n.closureNote) parts.push(n.closureNote);
    if (n.content) parts.push(n.content);
    return parts.join('\n');
  }
  if (n.type === 'document') return n.documentContent || n.content || '';
  if (n.type === 'link') return n.linkUrl || n.content || '';
  if (n.type === 'photo') return n.photoUrl || n.content || '';
  if (n.mode === 'list' || n.mode === 'check') {
    return (n.items || [])
      .map(item => {
        const t = (item.text || '').trim();
        if (!t) return '';
        return n.mode === 'check' && item.checked ? '[x] ' + t : t;
      })
      .filter(Boolean)
      .join('\n');
  }
  return n.content || '';
}

function escapeMapSelectLabel(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}
