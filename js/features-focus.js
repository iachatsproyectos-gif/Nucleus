function updateFocusHighlights() {
  if (!focusModeEnabled) {
    document.querySelectorAll('.node.focus-dimmed').forEach(el => el.classList.remove('focus-dimmed'));
    document.querySelectorAll('.connection-line.focus-dimmed').forEach(el => el.classList.remove('focus-dimmed'));
    return;
  }
  const ctx = getCurrentContext();
  let focusIds = new Set();
  if (selectedNodeIds.size > 0) {
    selectedNodeIds.forEach(id => getFocusConnectedIds(id, ctx).forEach(i => focusIds.add(i)));
  } else if (selectedNode) {
    focusIds = getFocusConnectedIds(selectedNode.id, ctx);
  } else {
    return;
  }
  document.querySelectorAll('.node').forEach(el => {
    const id = Number(el.dataset.id);
    el.classList.toggle('focus-dimmed', !focusIds.has(id));
  });
  document.querySelectorAll('.connection-line').forEach(el => {
    const from = Number(el.dataset.from);
    const to = Number(el.dataset.to);
    const lit = focusIds.has(from) && focusIds.has(to);
    el.classList.toggle('focus-dimmed', !lit);
  });
}

function initFocusFeatures() {
  const btn = document.getElementById('focus-toggle-btn');
  if (btn) {
    btn.onclick = () => {
      focusModeEnabled = !focusModeEnabled;
      btn.classList.toggle('active', focusModeEnabled);
      btn.textContent = focusModeEnabled ? 'enfoque: on' : 'enfoque: off';
      updateFocusHighlights();
    };
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !isTypingInInput()) {
      focusModeEnabled = !focusModeEnabled;
      if (btn) {
        btn.classList.toggle('active', focusModeEnabled);
        btn.textContent = focusModeEnabled ? 'enfoque: on' : 'enfoque: off';
      }
      updateFocusHighlights();
    }
  });
}

function isTypingInInput() {
  const t = document.activeElement;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
}
