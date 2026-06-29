const AUTO_LABELS = {
  'auto-trigger': 'TRIGGER',
  'auto-text': 'TRANSFORM',
  'auto-copy': 'CLIPBOARD',
  'auto-log': 'LOG',
  'auto-delay': 'DELAY',
  'auto-notify': 'ALERT',
  'auto-read-map': 'READ MAP',
  'auto-write-map': 'WRITE MAP'
};

function isAutomationNode(n) {
  return n.type && n.type.startsWith('auto-');
}

function createNode(type = 'system') {
  pushUndo();
  const ctx = getCurrentContext();
  const x = (window.innerWidth / 2 - offsetX) / scale;
  const y = (window.innerHeight / 2 - offsetY) / scale;

  const node = {
    id: Date.now(),
    x: x - 120,
    y: y - 40,
    type: type,
    title: type === 'stack' ? "" : (AUTO_LABELS[type] || "OPTION_NODE_" + (ctx.nodes.length + 1)),
    mode: 'text',
    content: type === 'auto-delay' ? '1000' : '',
    items: [{ text: "", checked: false }],
    subNodes: [],
    connections: [],
    isPainted: false
  };

  if (type === 'auto-text') {
    node.autoConfig = { transform: 'uppercase' };
  }
  if (type === 'auto-read-map') {
    node.autoConfig = { targetId: null, includeChildren: false };
  }
  if (type === 'auto-write-map') {
    node.autoConfig = { targetId: null, writeMode: 'node', append: false };
  }

  ctx.nodes.push(node);
  saveState(false);
  render();
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function buildAutomationBodyHTML(n) {
  const label = AUTO_LABELS[n.type] || 'AUTO';
  let inner = `<div class="auto-badge">${label}</div>`;

  if (n.type === 'auto-trigger') {
    inner += `<textarea class="content-area auto-field" placeholder="[ SEED TEXT (OPTIONAL) ]">${n.content || ''}</textarea>`;
  } else if (n.type === 'auto-text') {
    const t = (n.autoConfig && n.autoConfig.transform) || 'uppercase';
    inner += `
      <select class="auto-select" data-auto="transform">
        <option value="none" ${t === 'none' ? 'selected' : ''}>Passthrough</option>
        <option value="uppercase" ${t === 'uppercase' ? 'selected' : ''}>UPPERCASE</option>
        <option value="lowercase" ${t === 'lowercase' ? 'selected' : ''}>lowercase</option>
        <option value="trim" ${t === 'trim' ? 'selected' : ''}>Trim spaces</option>
        <option value="prefix" ${t === 'prefix' ? 'selected' : ''}>Add prefix</option>
        <option value="suffix" ${t === 'suffix' ? 'selected' : ''}>Add suffix</option>
      </select>
      <textarea class="content-area auto-field" placeholder="[ PREFIX/SUFFIX TEXT ]">${n.content || ''}</textarea>`;
  } else if (n.type === 'auto-delay') {
    inner += `<input type="number" class="auto-number" min="0" step="100" value="${n.content || '1000'}" placeholder="ms">`;
  } else if (n.type === 'auto-notify') {
    inner += `<textarea class="content-area auto-field" placeholder="[ ALERT MESSAGE ]">${n.content || ''}</textarea>`;
  } else if (n.type === 'auto-read-map') {
    const cfg = ensureMapAutoConfig(n, 'auto-read-map');
    inner += `
      <div class="auto-hint">Lee contenido de cualquier nodo del mapa completo.</div>
      <select class="auto-select" data-auto="targetId">${buildMapTargetSelectOptions(cfg.targetId)}</select>
      <label class="auto-check-label">
        <input type="checkbox" class="auto-check" data-auto="includeChildren" ${cfg.includeChildren ? 'checked' : ''}>
        Incluir subnodos
      </label>`;
  } else if (n.type === 'auto-write-map') {
    const cfg = ensureMapAutoConfig(n, 'auto-write-map');
    inner += `
      <div class="auto-hint">Escribe en el mapa: texto completo o divide por líneas en tareas.</div>
      <select class="auto-select" data-auto="targetId">${buildMapTargetSelectOptions(cfg.targetId)}</select>
      <select class="auto-select" data-auto="writeMode">
        <option value="node" ${cfg.writeMode === 'node' ? 'selected' : ''}>Un nodo (texto completo)</option>
        <option value="tasks" ${cfg.writeMode === 'tasks' ? 'selected' : ''}>Dividir por tareas (1 línea = 1 nodo hijo)</option>
      </select>
      <label class="auto-check-label ${cfg.writeMode === 'tasks' ? 'auto-check-hidden' : ''}" data-append-wrap>
        <input type="checkbox" class="auto-check" data-auto="append" ${cfg.append ? 'checked' : ''}>
        Añadir al contenido existente
      </label>`;
  } else {
    inner += `<div class="auto-hint">Pasa el dato al siguiente nodo</div>`;
  }

  return inner;
}

function bindAutomationEvents(el, n) {
  const tx = el.querySelector('.content-area.auto-field');
  if (tx) {
    setTimeout(() => autoResize(tx), 0);
    tx.oninput = (e) => { n.content = e.target.value; autoResize(tx); saveState(false); };
    tx.onblur = () => saveState(true);
  }

  const num = el.querySelector('.auto-number');
  if (num) {
    num.oninput = (e) => { n.content = e.target.value; saveState(false); };
    num.onblur = () => saveState(true);
  }

  el.querySelectorAll('.auto-select[data-auto]').forEach(selectEl => {
    selectEl.onchange = (e) => {
      const key = e.target.dataset.auto;
      if (!n.autoConfig) n.autoConfig = {};
      if (key === 'targetId') {
        n.autoConfig.targetId = e.target.value ? Number(e.target.value) : null;
      } else {
        n.autoConfig[key] = e.target.value;
      }
      saveState(false);
      if (key === 'writeMode') render();
    };
  });

  el.querySelectorAll('.auto-check[data-auto]').forEach(checkEl => {
    checkEl.onchange = (e) => {
      const key = e.target.dataset.auto;
      if (!n.autoConfig) n.autoConfig = {};
      n.autoConfig[key] = e.target.checked;
      saveState(false);
    };
  });
}

function render() {
  nodesLayer.innerHTML = "";
  const ctx = getCurrentContext();
  breadcrumb.innerHTML = `<span id="breadcrumb-prompt">> </span>${ctx.title || "HOME"}`;

  ctx.nodes.forEach(n => {
    const el = document.createElement("div");
    const auto = isAutomationNode(n);
    const chapter = isChapterNode(n);
    const readOnly = isChapterReadOnlyContext();
    el.className = `node ${n.type === 'stack' ? 'stack-mode' : ''} ${n.isPainted ? 'is-painted' : ''} ${auto ? 'auto-node ' + n.type : ''} ${chapter ? 'chapter-node phase-' + (n.phase || 'active') : ''}`;
    el.dataset.id = n.id;
    el.style.left = n.x + "px";
    el.style.top = n.y + "px";

    if (chapter && n.phase === 'fogged' && n.lockedUntil && n.lockedUntil.length) {
      const labels = getPrereqLabels(n, ctx);
      if (labels.length) el.title = `Prerequisitos: ${labels.join(', ')}`;
    }

    const ro = new ResizeObserver(() => drawConnections());
    ro.observe(el);

    let bodyHTML = "";
    let footerHTML = "";

    if (chapter) {
      bodyHTML = buildChapterBodyHTML(n, ctx);
    } else if (auto) {
      bodyHTML = buildAutomationBodyHTML(n);
    } else if (n.mode === 'text') {
      let styleAttr = (n.type === 'stack' && n.w) ? `style="width:${n.w};"` : '';
      bodyHTML = `<textarea class="content-area" ${styleAttr} placeholder="[ ENTER VALUE ]">${n.content}</textarea>`;
    } else {
      bodyHTML = n.items.map((item, i) => `
        <div class="list-item">
          ${n.mode === 'list' ? '<span style="color:var(--dim); font-size:10px;">■</span>' : `<input type="checkbox" class="check-box" ${item.checked ? 'checked' : ''} data-idx="${i}">`}
          <input type="text" class="list-input" value="${item.text}" data-idx="${i}" placeholder="...">
        </div>
      `).join("") + `<div class="add-item">+ ADD SETTING</div>`;
    }

    if (!auto && !chapter && n.type !== 'stack') {
      footerHTML = `
        <div class="node-toolbar">
          <button class="mode-btn ${n.mode === 'text' ? 'active' : ''}" data-mode="text">TXT</button>
          <button class="mode-btn ${n.mode === 'list' ? 'active' : ''}" data-mode="list">LST</button>
          <button class="mode-btn ${n.mode === 'check' ? 'active' : ''}" data-mode="check">PRMPT</button>
        </div>`;
    }

    const portsHTML = nodeHasPorts(n) ? buildPortsHTML() : '';
    el.innerHTML = `
      ${portsHTML}
      <div class="node-header"><input type="text" class="title-input" value="${n.title}"></div>
      <div class="node-body">${bodyHTML}</div>
      ${footerHTML}
    `;

    if (auto) {
      bindAutomationEvents(el, n);
    } else if (chapter) {
      /* chapter body is static hint — no content editors */
    } else if (n.mode === 'text') {
      const tx = el.querySelector("textarea.content-area:not(.auto-field)");
      if (tx) {
        setTimeout(() => autoResize(tx), 0);
        if (!readOnly && chapterAllowsEdit(n)) {
          if (n.type === 'stack') {
            tx.oninput = (e) => { n.content = e.target.value; autoResize(tx); saveState(false); };
            tx.onmouseup = () => { if (tx.style.width) { n.w = tx.style.width; saveState(false); } };
          } else {
            tx.oninput = (e) => { n.content = e.target.value; autoResize(tx); saveState(false); };
          }
          tx.onblur = () => saveState(true);
        } else {
          tx.readOnly = true;
        }
      }
    } else if (!auto && !chapter && !readOnly) {
      el.querySelectorAll(".list-input").forEach(inp => {
        inp.oninput = (e) => { n.items[e.target.dataset.idx].text = e.target.value; saveState(false); };
        inp.onblur = () => saveState(true);
      });
      if (n.mode === 'check') el.querySelectorAll(".check-box").forEach(cb => cb.onchange = (e) => {
        pushUndo();
        n.items[e.target.dataset.idx].checked = e.target.checked;
        saveState(false);
      });
      const addItem = el.querySelector(".add-item");
      if (addItem) addItem.onclick = () => {
        pushUndo();
        n.items.push({ text: "", checked: false });
        render();
        saveState(false);
      };
    }

    const titleInp = el.querySelector(".title-input");
    if (titleInp) {
      const canEditTitle = !readOnly && chapterTitleEditable(n);
      if (!canEditTitle) titleInp.readOnly = true;
      if (canEditTitle) {
        titleInp.oninput = (e) => { n.title = e.target.value.toUpperCase(); saveState(false); };
        titleInp.onblur = () => saveState(true);
      }
    }

    if (!auto && !chapter && !readOnly) {
      el.querySelectorAll(".mode-btn").forEach(btn => btn.onclick = () => {
        pushUndo();
        n.mode = btn.dataset.mode;
        render();
        saveState(false);
      });
    }

    el.querySelector(".node-header").onmousedown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      pushUndo();

      let isDraggingNode = false;
      let wasSelected = selectedNodeIds.has(n.id);

      if (e.shiftKey) {
        if (!wasSelected) selectedNodeIds.add(n.id);
      } else {
        if (!wasSelected) {
          selectedNodeIds.clear();
          selectedNodeIds.add(n.id);
        }
      }
      updateSelectionVisuals();

      const sX = e.clientX, sY = e.clientY;
      const startPositions = Array.from(selectedNodeIds).map(id => {
        let node = ctx.nodes.find(x => x.id === id);
        return node ? { id: id, oX: node.x, oY: node.y } : null;
      }).filter(Boolean);

      const move = (ev) => {
        isDraggingNode = true;
        let dx = (ev.clientX - sX) / scale;
        let dy = (ev.clientY - sY) / scale;
        startPositions.forEach(pos => {
          let node = ctx.nodes.find(x => x.id === pos.id);
          if (node) {
            node.x = pos.oX + dx; node.y = pos.oY + dy;
            let nodeEl = document.querySelector(`.node[data-id="${node.id}"]`);
            if (nodeEl) { nodeEl.style.left = node.x + "px"; nodeEl.style.top = node.y + "px"; }
          }
        });
        drawConnections();
      };

      document.addEventListener("mousemove", move);
      document.onmouseup = () => {
        document.removeEventListener("mousemove", move);
        if (!isDraggingNode) {
          if (e.shiftKey && wasSelected) selectedNodeIds.delete(n.id);
          else if (!e.shiftKey) { selectedNodeIds.clear(); selectedNodeIds.add(n.id); }
          updateSelectionVisuals();
        }
        saveState(false);
      };
    };

    if (n.type === 'stack') {
      el.onmousedown = (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.classList.contains('port')) return;
        pushUndo();
        let isDraggingNode = false;
        let wasSelected = selectedNodeIds.has(n.id);
        if (e.shiftKey) { if (!wasSelected) selectedNodeIds.add(n.id); }
        else { if (!wasSelected) { selectedNodeIds.clear(); selectedNodeIds.add(n.id); } }
        updateSelectionVisuals();
        const sX = e.clientX, sY = e.clientY;
        const startPositions = Array.from(selectedNodeIds).map(id => {
          let node = ctx.nodes.find(x => x.id === id);
          return node ? { id: id, oX: node.x, oY: node.y } : null;
        }).filter(Boolean);
        const move = (ev) => {
          isDraggingNode = true;
          let dx = (ev.clientX - sX) / scale, dy = (ev.clientY - sY) / scale;
          startPositions.forEach(pos => {
            let node = ctx.nodes.find(x => x.id === pos.id);
            if (node) {
              node.x = pos.oX + dx; node.y = pos.oY + dy;
              let nodeEl = document.querySelector(`.node[data-id="${node.id}"]`);
              if (nodeEl) { nodeEl.style.left = node.x + "px"; nodeEl.style.top = node.y + "px"; }
            }
          });
          drawConnections();
        };
        document.addEventListener("mousemove", move);
        document.onmouseup = () => {
          document.removeEventListener("mousemove", move);
          if (!isDraggingNode) {
            if (e.shiftKey && wasSelected) selectedNodeIds.delete(n.id);
            else if (!e.shiftKey) { selectedNodeIds.clear(); selectedNodeIds.add(n.id); }
            updateSelectionVisuals();
          }
          saveState(false);
        };
      };
    }

    if (nodeHasPorts(n)) setupPortHandlers(el, n, ctx);

    el.oncontextmenu = (e) => {
      e.preventDefault(); e.stopPropagation();
      selectedNode = n;
      if (!selectedNodeIds.has(n.id)) {
        selectedNodeIds.clear();
        selectedNodeIds.add(n.id);
        updateSelectionVisuals();
      }
      document.getElementById("menu-paint").style.display = (n.type === 'stack' || Array.from(selectedNodeIds).some(id => ctx.nodes.find(x => x.id === id && x.type === 'stack'))) ? "block" : "none";
      document.getElementById("menu-run-from").style.display = isAutomationNode(n) ? "block" : "none";
      updateChapterContextMenu(n);
      menu.style.left = e.clientX + "px";
      menu.style.top = e.clientY + "px";
      menu.style.display = "block";
    };

    nodesLayer.appendChild(el);
  });

  updateSelectionVisuals();
  lucide.createIcons();
  drawConnections();
}
