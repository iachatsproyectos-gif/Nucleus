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

function getAllMapNodes(options) {
  options = options || {};
  const skipAutomation = options.skipAutomation !== false;
  const result = [];
  walkMapTree((n, path) => {
    if (skipAutomation && isAutomationNode(n)) return;
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

function collectDescendantTexts(nodes, parts) {
  (nodes || []).forEach(n => {
    if (isAutomationNode(n)) return;
    const t = extractNodeReadableText(n);
    if (t) parts.push('[' + (n.title || 'Nodo') + ']\n' + t);
    if (n.subNodes && n.subNodes.length) collectDescendantTexts(n.subNodes, parts);
  });
}

function readFromMapTarget(targetId, includeChildren) {
  const target = findNodeById(targetId);
  if (!target) throw new Error('Nodo origen no encontrado en el mapa (id: ' + targetId + ')');

  const parts = [];
  const main = extractNodeReadableText(target);
  if (main) parts.push(main);

  if (includeChildren) {
    collectDescendantTexts(target.subNodes, parts);
  }

  return parts.join('\n\n');
}

function splitInputToTasks(text) {
  return String(text)
    .split(/\r?\n/)
    .map(line => line.replace(/^[-*•]\s+/, '').replace(/^\[ \]\s+/, '').replace(/^\[x\]\s+/i, '').trim())
    .filter(Boolean);
}

function canWriteToNodeTarget(target) {
  if (isChapterNode(target) && !chapterAllowsEdit(target) && target.phase !== 'active') {
    if (target.phase === 'closed') return false;
    if (target.phase === 'fogged' || target.phase === 'unlocked') return false;
  }
  return true;
}

function writeToMapTarget(targetId, input, config) {
  config = config || {};
  const target = findNodeById(targetId);
  if (!target) throw new Error('Nodo destino no encontrado en el mapa (id: ' + targetId + ')');

  const writeMode = config.writeMode || 'node';
  const append = !!config.append;

  if (writeMode === 'node' && !canWriteToNodeTarget(target)) {
    throw new Error('No se puede escribir en "' + (target.title || 'nodo') + '" en su fase actual');
  }

  pushUndo();

  if (writeMode === 'tasks') {
    const lines = splitInputToTasks(input);
    if (lines.length === 0) {
      saveState(false);
      return { written: 0, mode: 'tasks', passThrough: String(input) };
    }
    if (!target.subNodes) target.subNodes = [];
    const baseId = Date.now();
    lines.forEach((line, i) => {
      target.subNodes.push({
        id: baseId + i + 1,
        x: 40 + (i % 3) * 260,
        y: 60 + Math.floor(i / 3) * 100,
        type: 'system',
        title: line.length > 28 ? line.slice(0, 28).toUpperCase() + '…' : line.toUpperCase(),
        mode: 'text',
        content: line,
        items: [{ text: '', checked: false }],
        subNodes: [],
        connections: [],
        isPainted: false
      });
    });
    saveState(false);
    render();
    return { written: lines.length, mode: 'tasks', passThrough: String(input) };
  }

  const text = String(input);

  if (target.mode === 'list' || target.mode === 'check') {
    if (!target.items) target.items = [{ text: '', checked: false }];
    if (append) {
      target.items.push({ text: text, checked: false });
    } else {
      target.items = [{ text: text, checked: false }];
    }
  } else {
    if (append && target.content) {
      target.content = target.content + '\n' + text;
    } else {
      target.content = text;
    }
    if (target.mode !== 'text' && target.type !== 'stack') target.mode = 'text';
  }

  saveState(false);
  render();
  return { written: 1, mode: 'node', passThrough: text };
}

function buildMapTargetSelectOptions(selectedId) {
  const entries = getAllMapNodes();
  let html = '<option value="">— elegir en el mapa —</option>';
  entries.forEach(entry => {
    const sel = entry.id === selectedId ? ' selected' : '';
    html += '<option value="' + entry.id + '"' + sel + '>' + escapeMapSelectLabel(entry.path + ' › ' + entry.label) + '</option>';
  });
  return html;
}

function escapeMapSelectLabel(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function ensureMapAutoConfig(n, type) {
  if (!n.autoConfig) n.autoConfig = {};
  if (type === 'auto-read-map') {
    if (n.autoConfig.targetId === undefined) n.autoConfig.targetId = null;
    if (n.autoConfig.includeChildren === undefined) n.autoConfig.includeChildren = false;
  }
  if (type === 'auto-write-map') {
    if (n.autoConfig.targetId === undefined) n.autoConfig.targetId = null;
    if (n.autoConfig.writeMode === undefined) n.autoConfig.writeMode = 'node';
    if (n.autoConfig.append === undefined) n.autoConfig.append = false;
  }
  return n.autoConfig;
}
