function isChapterNode(n) {
  return n && n.type === 'chapter';
}

function chapterAllowsPorts(n) {
  return isChapterNode(n) && n.phase === 'active';
}

function chapterAllowsEnter(n) {
  if (!isChapterNode(n)) return true;
  return n.phase === 'active' || n.phase === 'closed';
}

function chapterAllowsEdit(n) {
  if (!isChapterNode(n)) return true;
  if (n.phase === 'fogged') return false;
  if (n.phase === 'unlocked') return false;
  if (n.phase === 'closed') return false;
  return true;
}

function chapterTitleEditable(n) {
  if (!isChapterNode(n)) return true;
  return n.phase !== 'closed';
}

function getChapterHint(n, ctx) {
  switch (n.phase) {
    case 'fogged': {
      const pending = getPendingPrereqLabels(n, ctx);
      return pending.length
        ? `Aún lejos · Se revelará cuando cierres: ${pending.join(', ')}`
        : 'En el horizonte · Aún no es el momento';
    }
    case 'unlocked':
      return 'Ya estás lo bastante cerca · Acércate para explorar';
    case 'active':
      return 'Capítulo presente · Entra para desarrollar';
    case 'closed':
      return n.closureNote || 'Capítulo cerrado · Memoria en el mapa';
    default:
      return '';
  }
}

function getPendingPrereqLabels(n, ctx) {
  if (!n.lockedUntil || !n.lockedUntil.length) return [];
  return n.lockedUntil
    .map(id => ctx.nodes.find(x => x.id === id))
    .filter(Boolean)
    .filter(prereq => prereq.phase !== 'closed')
    .map(prereq => prereq.title || 'Capítulo');
}

function arePrereqsMet(n, ctx) {
  if (!n.lockedUntil || !n.lockedUntil.length) return false;
  return n.lockedUntil.every(id => {
    const prereq = ctx.nodes.find(x => x.id === id);
    return prereq && prereq.phase === 'closed';
  });
}

function createChapter(phase = 'active', lockedUntil = []) {
  pushUndo();
  const ctx = getCurrentContext();
  const x = (window.innerWidth / 2 - offsetX) / scale;
  const y = (window.innerHeight / 2 - offsetY) / scale;
  const count = ctx.nodes.filter(n => isChapterNode(n)).length + 1;

  const node = {
    id: Date.now(),
    x: x - 120,
    y: y - 40,
    type: 'chapter',
    phase: phase,
    lockedUntil: lockedUntil.slice(),
    closureNote: '',
    closedAt: null,
    title: phase === 'fogged' ? `HORIZONTE_${count}` : `CAPITULO_${count}`,
    mode: 'text',
    content: '',
    items: [{ text: '', checked: false }],
    subNodes: [],
    connections: [],
    isPainted: false
  };

  ctx.nodes.push(node);
  saveState(false);
  render();
  return node;
}

function closeChapter(node, closureNote = '') {
  if (!isChapterNode(node) || node.phase !== 'active') return [];

  pushUndo();
  node.phase = 'closed';
  node.closedAt = new Date().toISOString();
  node.closureNote = closureNote || '';

  const unlocked = checkUnlocks(getCurrentContext());
  saveState(false);
  render();
  return unlocked;
}

function approachChapter(node) {
  if (!isChapterNode(node) || node.phase !== 'unlocked') return;

  pushUndo();
  node.phase = 'active';
  saveState(false);
  render();
  showChapterToast('Ya estás lo bastante cerca. Este capítulo es tuyo ahora.');
}

function sendChapterToHorizon(node) {
  if (!isChapterNode(node) || node.phase !== 'active') return;

  pushUndo();
  node.phase = 'fogged';
  saveState(false);
  render();
}

function setChapterPrereqs(node, lockedUntil) {
  if (!isChapterNode(node)) return;

  pushUndo();
  node.lockedUntil = lockedUntil.slice();
  if (node.phase === 'fogged' && arePrereqsMet(node, getCurrentContext())) {
    node.phase = 'unlocked';
    showChapterToast(`Un capítulo en el horizonte toma forma: ${node.title}`);
  }
  saveState(false);
  render();
}

function checkUnlocks(ctx) {
  const unlocked = [];
  ctx.nodes.forEach(n => {
    if (isChapterNode(n) && n.phase === 'fogged' && arePrereqsMet(n, ctx)) {
      n.phase = 'unlocked';
      unlocked.push(n);
    }
  });
  unlocked.forEach(n => {
    showChapterToast(`Un capítulo en el horizonte toma forma: ${n.title}`);
  });
  return unlocked;
}

function getChaptersInContext(ctx) {
  return ctx.nodes.filter(n => isChapterNode(n));
}

function showChapterToast(message) {
  const el = document.getElementById('chapter-toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(showChapterToast._timer);
  showChapterToast._timer = setTimeout(() => el.classList.remove('visible'), 4000);
}

function buildChapterBodyHTML(n, ctx) {
  const hint = getChapterHint(n, ctx);
  const phaseLabel = {
    fogged: 'HORIZONTE',
    unlocked: 'DISPONIBLE',
    active: 'PRESENTE',
    closed: 'CERRADO'
  }[n.phase] || 'CAPÍTULO';

  return `
    <div class="chapter-badge">${phaseLabel}</div>
    <div class="chapter-hint">${hint}</div>
  `;
}

function getPrereqLabels(n, ctx) {
  if (!n.lockedUntil || !n.lockedUntil.length) return [];
  return n.lockedUntil
    .map(id => ctx.nodes.find(x => x.id === id))
    .filter(Boolean)
    .map(p => p.title || 'Capítulo');
}

function updateChapterContextMenu(n) {
  const isCh = isChapterNode(n);
  const enter = document.getElementById('menu-enter');
  const approach = document.getElementById('menu-approach');
  const closeCh = document.getElementById('menu-close-chapter');
  const horizon = document.getElementById('menu-send-horizon');
  const prereqs = document.getElementById('menu-prereqs');

  enter.style.display = (!isCh || chapterAllowsEnter(n)) ? 'block' : 'none';
  approach.style.display = (isCh && n.phase === 'unlocked') ? 'block' : 'none';
  closeCh.style.display = (isCh && n.phase === 'active') ? 'block' : 'none';
  horizon.style.display = (isCh && n.phase === 'active') ? 'block' : 'none';
  prereqs.style.display = isCh ? 'block' : 'none';

  const divider = document.getElementById('menu-chapter-divider');
  if (divider) divider.style.display = isCh ? 'block' : 'none';
}

function isChapterReadOnlyContext() {
  if (navigationStack.length === 0) return false;
  const parent = navigationStack[navigationStack.length - 1];
  return isChapterNode(parent) && parent.phase === 'closed';
}

function animateChapterReveal(nodeId) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`.node[data-id="${nodeId}"]`);
    if (!el) return;
    el.classList.add('chapter-revealing');
    setTimeout(() => el.classList.remove('chapter-revealing'), 1500);
  });
}
