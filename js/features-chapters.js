function initChapters() {
  document.getElementById('add-chapter-active-btn').onclick = () => createChapter('active');
  document.getElementById('add-chapter-fogged-btn').onclick = () => openPrereqsModalForNewHorizon();

  document.getElementById('menu-approach').onclick = () => {
    const target = getContextMenuNode();
    if (target) {
      menu.style.display = 'none';
      openApproachChapterModal(target);
    }
  };

  document.getElementById('menu-close-chapter').onclick = () => {
    const target = getContextMenuNode();
    if (target && isChapterNode(target) && target.phase === 'active') {
      menu.style.display = 'none';
      openCloseChapterModal(target);
    }
  };

  document.getElementById('menu-send-horizon').onclick = () => {
    const target = getContextMenuNode();
    if (target) {
      sendChapterToHorizon(target);
      menu.style.display = 'none';
    }
  };

  document.getElementById('menu-prereqs').onclick = () => {
    const target = getContextMenuNode();
    if (target && isChapterNode(target)) {
      menu.style.display = 'none';
      openPrereqsModal(target);
    }
  };

  document.getElementById('chapter-close-cancel').onclick = closeChapterModals;
  document.getElementById('chapter-close-skip').onclick = () => confirmCloseChapter(true);
  document.getElementById('chapter-close-confirm').onclick = () => confirmCloseChapter(false);
  document.getElementById('chapter-approach-cancel').onclick = closeChapterModals;
  document.getElementById('chapter-approach-skip').onclick = () => confirmApproachChapter(true);
  document.getElementById('chapter-approach-confirm').onclick = () => confirmApproachChapter(false);
  document.getElementById('chapter-prereqs-cancel').onclick = closeChapterModals;
  document.getElementById('chapter-prereqs-save').onclick = confirmPrereqsModal;

  document.getElementById('chapter-modal-overlay').onclick = closeChapterModals;
}

let chapterModalTarget = null;
let chapterModalMode = null;

function buildClosureNoteFromPrompts() {
  const learned = document.getElementById('chapter-close-learned')?.value.trim() || '';
  const leave = document.getElementById('chapter-close-leave')?.value.trim() || '';
  const free = document.getElementById('chapter-close-note')?.value.trim() || '';
  const parts = [];
  if (learned) parts.push('¿Qué aprendiste?\n' + learned);
  if (leave) parts.push('¿Qué dejas atrás?\n' + leave);
  if (free) parts.push('Nota libre\n' + free);
  return parts.join('\n\n---\n\n');
}

function clearClosePromptFields() {
  ['chapter-close-learned', 'chapter-close-leave', 'chapter-close-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function openCloseChapterModal(node) {
  chapterModalTarget = node;
  chapterModalMode = 'close';
  clearClosePromptFields();
  if (node.closureNote) {
    const noteEl = document.getElementById('chapter-close-note');
    if (noteEl) noteEl.value = node.closureNote;
  }
  document.getElementById('chapter-close-modal').classList.add('visible');
  document.getElementById('chapter-modal-overlay').classList.add('visible');
}

function openApproachChapterModal(node) {
  if (!node || !isChapterNode(node) || node.phase !== 'unlocked') return;
  chapterModalTarget = node;
  chapterModalMode = 'approach';
  const noteEl = document.getElementById('chapter-approach-note');
  if (noteEl) noteEl.value = node.approachNote || '';
  document.getElementById('chapter-approach-modal').classList.add('visible');
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

function confirmCloseChapter(skipNote) {
  if (!chapterModalTarget) return;
  const note = skipNote ? '' : buildClosureNoteFromPrompts();
  const unlocked = closeChapter(chapterModalTarget, note);
  closeChapterModals();
  unlocked.forEach(n => animateChapterReveal(n.id));
}

function confirmApproachChapter(skipNote) {
  if (!chapterModalTarget) return;
  const note = skipNote ? '' : (document.getElementById('chapter-approach-note')?.value.trim() || '');
  approachChapter(chapterModalTarget, note);
  closeChapterModals();
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
  document.getElementById('chapter-close-modal')?.classList.remove('visible');
  document.getElementById('chapter-approach-modal')?.classList.remove('visible');
  document.getElementById('chapter-prereqs-modal')?.classList.remove('visible');
  document.getElementById('chapter-modal-overlay')?.classList.remove('visible');
  clearClosePromptFields();
  const approachNote = document.getElementById('chapter-approach-note');
  if (approachNote) approachNote.value = '';
}
