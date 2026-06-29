function initChapters() {
  document.getElementById('add-chapter-active-btn').onclick = () => createChapter('active');
  document.getElementById('add-chapter-fogged-btn').onclick = () => openPrereqsModalForNewHorizon();

  document.getElementById('menu-approach').onclick = () => {
    if (selectedNode) {
      approachChapter(selectedNode);
      menu.style.display = 'none';
    }
  };

  document.getElementById('menu-close-chapter').onclick = () => {
    if (selectedNode && isChapterNode(selectedNode) && selectedNode.phase === 'active') {
      menu.style.display = 'none';
      openCloseChapterModal(selectedNode);
    }
  };

  document.getElementById('menu-send-horizon').onclick = () => {
    if (selectedNode) {
      sendChapterToHorizon(selectedNode);
      menu.style.display = 'none';
    }
  };

  document.getElementById('menu-prereqs').onclick = () => {
    if (selectedNode && isChapterNode(selectedNode)) {
      menu.style.display = 'none';
      openPrereqsModal(selectedNode);
    }
  };

  document.getElementById('chapter-close-cancel').onclick = closeChapterModals;
  document.getElementById('chapter-close-confirm').onclick = confirmCloseChapter;
  document.getElementById('chapter-prereqs-cancel').onclick = closeChapterModals;
  document.getElementById('chapter-prereqs-save').onclick = confirmPrereqsModal;

  document.getElementById('chapter-modal-overlay').onclick = closeChapterModals;
}

let chapterModalTarget = null;
let chapterModalMode = null;

function openCloseChapterModal(node) {
  chapterModalTarget = node;
  chapterModalMode = 'close';
  document.getElementById('chapter-close-note').value = node.closureNote || '';
  document.getElementById('chapter-close-modal').classList.add('visible');
  document.getElementById('chapter-modal-overlay').classList.add('visible');
}

function openPrereqsModal(node) {
  chapterModalTarget = node;
  chapterModalMode = 'prereqs';
  renderPrereqsChecklist(node);
  document.getElementById('chapter-prereqs-modal').classList.add('visible');
  document.getElementById('chapter-modal-overlay').classList.add('visible');
}

function openPrereqsModalForNewHorizon() {
  chapterModalTarget = null;
  chapterModalMode = 'new-horizon';
  renderPrereqsChecklist(null);
  document.getElementById('chapter-prereqs-modal').classList.add('visible');
  document.getElementById('chapter-modal-overlay').classList.add('visible');
}

function renderPrereqsChecklist(node) {
  const ctx = getCurrentContext();
  const chapters = getChaptersInContext(ctx).filter(n => !node || n.id !== node.id);
  const selected = node ? (node.lockedUntil || []) : [];
  const list = document.getElementById('chapter-prereq-list');

  if (chapters.length === 0) {
    list.innerHTML = '<p style="font-size:12px;color:#666;margin:0;">No hay otros capítulos en este nivel.</p>';
    return;
  }

  list.innerHTML = chapters.map(ch => `
    <label class="chapter-prereq-item">
      <input type="checkbox" value="${ch.id}" ${selected.includes(ch.id) ? 'checked' : ''}>
      <span>${ch.title || 'Capítulo'} (${ch.phase})</span>
    </label>
  `).join('');
}

function getSelectedPrereqIds() {
  return Array.from(document.querySelectorAll('#chapter-prereq-list input:checked'))
    .map(cb => Number(cb.value));
}

function confirmCloseChapter() {
  if (!chapterModalTarget) return;
  const note = document.getElementById('chapter-close-note').value.trim();
  const unlocked = closeChapter(chapterModalTarget, note);
  closeChapterModals();
  unlocked.forEach(n => animateChapterReveal(n.id));
}

function confirmPrereqsModal() {
  const ids = getSelectedPrereqIds();
  if (chapterModalMode === 'new-horizon') {
    const node = createChapter('fogged', ids);
    closeChapterModals();
    if (node && arePrereqsMet(node, getCurrentContext())) {
      node.phase = 'unlocked';
      saveState(false);
      render();
      animateChapterReveal(node.id);
      showChapterToast(`Un capítulo en el horizonte toma forma: ${node.title}`);
    }
    return;
  }
  if (chapterModalTarget) {
    setChapterPrereqs(chapterModalTarget, ids);
    if (chapterModalTarget.phase === 'unlocked') {
      animateChapterReveal(chapterModalTarget.id);
    }
  }
  closeChapterModals();
}

function closeChapterModals() {
  chapterModalTarget = null;
  chapterModalMode = null;
  document.getElementById('chapter-close-modal').classList.remove('visible');
  document.getElementById('chapter-prereqs-modal').classList.remove('visible');
  document.getElementById('chapter-modal-overlay').classList.remove('visible');
  document.getElementById('chapter-close-note').value = '';
}
