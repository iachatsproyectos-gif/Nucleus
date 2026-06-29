function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setNodeRunState(nodeId, state) {
  const el = document.querySelector(`.node[data-id="${nodeId}"]`);
  if (!el) return;
  el.classList.remove('node-running', 'node-done', 'node-error');
  if (state) el.classList.add(state);
}

function clearAllRunStates() {
  document.querySelectorAll('.node-running, .node-done, .node-error').forEach(el => {
    el.classList.remove('node-running', 'node-done', 'node-error');
  });
}

function appendAutoLog(message, level = 'info') {
  const body = document.getElementById('auto-log-body');
  if (!body) return;
  const line = document.createElement('div');
  line.className = `auto-log-line auto-log-${level}`;
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${message}`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

function clearAutoLog() {
  const body = document.getElementById('auto-log-body');
  if (body) body.innerHTML = '';
}

async function executeNodeAction(node, input) {
  switch (node.type) {
    case 'auto-trigger':
      return node.content || input || '';

    case 'auto-text': {
      const op = (node.autoConfig && node.autoConfig.transform) || 'none';
      let out = String(input);
      switch (op) {
        case 'uppercase': out = out.toUpperCase(); break;
        case 'lowercase': out = out.toLowerCase(); break;
        case 'trim': out = out.trim(); break;
        case 'prefix': out = (node.content || '') + out; break;
        case 'suffix': out = out + (node.content || ''); break;
        default: break;
      }
      return out;
    }

    case 'auto-copy':
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(input));
        appendAutoLog(`Copiado al portapapeles: "${String(input).slice(0, 60)}${String(input).length > 60 ? '…' : ''}"`, 'success');
      } else {
        appendAutoLog('Portapapeles no disponible en este contexto', 'error');
      }
      return input;

    case 'auto-log':
      appendAutoLog(String(input), 'data');
      return input;

    case 'auto-delay': {
      const ms = Math.max(0, parseInt(node.content, 10) || 0);
      appendAutoLog(`Esperando ${ms}ms…`, 'info');
      await sleep(ms);
      return input;
    }

    case 'auto-notify': {
      const msg = node.content || String(input);
      appendAutoLog(`Alert: ${msg}`, 'success');
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('Nucleus Flow', { body: msg });
      } else {
        appendAutoLog(`(Notificación: ${msg})`, 'info');
      }
      return input;
    }

    case 'auto-read-map': {
      const cfg = ensureMapAutoConfig(node, 'auto-read-map');
      if (!cfg.targetId) {
        appendAutoLog('READ MAP: elige un nodo origen en el mapa', 'error');
        return input;
      }
      const text = readFromMapTarget(cfg.targetId, cfg.includeChildren);
      const target = findNodeById(cfg.targetId);
      const name = target ? (target.title || 'nodo') : cfg.targetId;
      appendAutoLog(`Leído de "${name}" (${text.length} caracteres)`, 'success');
      return text;
    }

    case 'auto-write-map': {
      const cfg = ensureMapAutoConfig(node, 'auto-write-map');
      if (!cfg.targetId) {
        appendAutoLog('WRITE MAP: elige un nodo destino en el mapa', 'error');
        return input;
      }
      const result = writeToMapTarget(cfg.targetId, input, cfg);
      const target = findNodeById(cfg.targetId);
      const name = target ? (target.title || 'nodo') : cfg.targetId;
      if (result.mode === 'tasks') {
        appendAutoLog(`Escritas ${result.written} tareas en "${name}"`, 'success');
      } else {
        appendAutoLog(`Escrito en "${name}" (${result.mode})`, 'success');
      }
      return result.passThrough;
    }

    default:
      return input;
  }
}

async function executeFromNode(node, input, ctx, visited) {
  if (visited.has(node.id)) {
    appendAutoLog(`Ciclo detectado en nodo "${node.title}" — detenido`, 'error');
    return;
  }
  visited.add(node.id);

  setNodeRunState(node.id, 'node-running');
  appendAutoLog(`▶ ${node.title}`, 'info');

  let output;
  try {
    output = await executeNodeAction(node, input);
    setNodeRunState(node.id, 'node-done');
  } catch (err) {
    setNodeRunState(node.id, 'node-error');
    appendAutoLog(`Error en "${node.title}": ${err.message}`, 'error');
    return;
  }

  const outConns = ctx.connections.filter(c => c.from === node.id);
  for (const conn of outConns) {
    const next = ctx.nodes.find(n => n.id === conn.to);
    if (next) await executeFromNode(next, output, ctx, visited);
  }
}

async function runWorkflow(fromNode) {
  const ctx = getCurrentContext();
  clearAutoLog();
  clearAllRunStates();

  let triggers;
  if (fromNode) {
    triggers = [fromNode];
    appendAutoLog(`Ejecutando desde "${fromNode.title}"…`, 'info');
  } else {
    triggers = ctx.nodes.filter(n => n.type === 'auto-trigger');
    if (triggers.length === 0) {
      appendAutoLog('Añade un nodo TRIGGER y conéctalo al flujo.', 'error');
      return;
    }
    appendAutoLog(`Iniciando ${triggers.length} flujo(s)…`, 'info');
  }

  const runBtn = document.getElementById('run-flow-btn');
  if (runBtn) runBtn.disabled = true;

  try {
    for (const trigger of triggers) {
      await executeFromNode(trigger, '', ctx, new Set());
    }
    appendAutoLog('Flujo completado.', 'success');
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}
