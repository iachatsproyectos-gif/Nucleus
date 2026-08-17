const DAILY_CHECKLIST_KEY = 'nucleus_daily_checklist_v1';

let dailyChecklistState = { days: {}, activeDayKey: null };
let _checklistItemSeq = 0;

function generateChecklistItemId() {
  _checklistItemSeq += 1;
  return 'cl_' + Date.now() + '_' + _checklistItemSeq;
}

function getDayKey(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayTabDateShort(dayKey) {
  const parts = dayKey.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function formatDayTabLabel(dayKey) {
  if (isTodayKey(dayKey)) return 'hoy';

  const parts = dayKey.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const yesterdayKey = getDayKey(new Date(Date.now() - 86400000));
  if (dayKey === yesterdayKey) return 'ayer';

  return date.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function formatVisitStamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDayTabTitle(dayKey) {
  const parts = dayKey.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function loadDailyChecklistState() {
  try {
    const raw = localStorage.getItem(DAILY_CHECKLIST_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      dailyChecklistState = {
        days: data.days || {},
        activeDayKey: data.activeDayKey || null
      };
    }
  } catch (_) {
    dailyChecklistState = { days: {}, activeDayKey: null };
  }
}

function saveDailyChecklistState() {
  localStorage.setItem(DAILY_CHECKLIST_KEY, JSON.stringify(dailyChecklistState));
  window.setNucleusCoreActivity?.(getDailyChecklistProgress());
}

function findLatestDayKeyBefore(dayKey) {
  const keys = Object.keys(dailyChecklistState.days).filter(k => k < dayKey).sort();
  return keys.length ? keys[keys.length - 1] : null;
}

function cloneItemsUnchecked(items) {
  const copied = (items || []).map(item => ({
    id: generateChecklistItemId(),
    text: item.text || '',
    checked: false
  }));
  return copied.length ? copied : defaultDayItems();
}

function defaultDayItems() {
  return [{ id: generateChecklistItemId(), text: '', checked: false }];
}

function ensureDayEntry(dayKey, inheritFromPrev) {
  if (dailyChecklistState.days[dayKey]) return dayKey;

  const prevKey = findLatestDayKeyBefore(dayKey);
  const prevItems = inheritFromPrev && prevKey ? dailyChecklistState.days[prevKey]?.items : null;
  const items = prevItems?.length ? cloneItemsUnchecked(prevItems) : defaultDayItems();

  dailyChecklistState.days[dayKey] = { items };
  return dayKey;
}

function ensureTodayDay() {
  const today = getDayKey();
  ensureDayEntry(today, true);
  if (!dailyChecklistState.activeDayKey) dailyChecklistState.activeDayKey = today;
  return today;
}

function getChecklistTabKeys() {
  ensureTodayDay();
  const today = getDayKey();
  const keys = Object.keys(dailyChecklistState.days).filter(dayKey => {
    if (dayKey === today) return true;
    return Boolean(dailyChecklistState.days[dayKey]?.visitedAt);
  });
  if (!keys.includes(today)) keys.push(today);
  return keys.sort().reverse();
}

function recordNucleusVisit(dayKey) {
  const key = dayKey || getDayKey();
  const inherit = key <= getDayKey();
  ensureDayEntry(key, inherit);
  const entry = dailyChecklistState.days[key];
  const now = Date.now();
  entry.visitedAt = now;
  if (!entry.firstVisitedAt) entry.firstVisitedAt = now;
  dailyChecklistState.activeDayKey = key;
  saveDailyChecklistState();
}

function setActiveChecklistDay(dayKey) {
  if (!dayKey) return;
  ensureDayEntry(dayKey, dayKey <= getDayKey());
  dailyChecklistState.days[dayKey].visitedAt = dailyChecklistState.days[dayKey].visitedAt || Date.now();
  dailyChecklistState.activeDayKey = dayKey;
  saveDailyChecklistState();
  renderDailyChecklist();
}

function getActiveDayEntry() {
  ensureTodayDay();
  const key = dailyChecklistState.activeDayKey || getDayKey();
  if (!dailyChecklistState.days[key]) {
    dailyChecklistState.days[key] = { items: defaultDayItems() };
  }
  return { key, entry: dailyChecklistState.days[key] };
}

function isTodayKey(dayKey) {
  return dayKey === getDayKey();
}

function renderDailyChecklistTabs() {
  const tabsEl = document.getElementById('daily-checklist-tabs');
  if (!tabsEl) return;

  const keys = getChecklistTabKeys();

  tabsEl.innerHTML = keys.map(dayKey => {
    const active = dayKey === dailyChecklistState.activeDayKey;
    const entry = dailyChecklistState.days[dayKey] || {};
    const done = (entry.items || []).filter(i => i.checked).length;
    const total = (entry.items || []).length;
    const isToday = isTodayKey(dayKey);
    const visited = Boolean(entry.visitedAt);
    return `
      <button type="button"
        class="daily-checklist-tab${active ? ' active' : ''}${isToday ? ' is-today' : ''}${visited ? ' is-visited' : ''}"
        data-day="${dayKey}"
        title="${formatDayTabTitle(dayKey)}${entry.visitedAt ? ' · Nucleus ' + formatVisitStamp(entry.visitedAt) : ''}">
        <span class="daily-checklist-tab-label">${formatDayTabLabel(dayKey)}</span>
        <span class="daily-checklist-tab-date">${formatDayTabDateShort(dayKey)}</span>
        <span class="daily-checklist-tab-meta">${done}/${total}</span>
      </button>`;
  }).join('');

  tabsEl.querySelectorAll('.daily-checklist-tab').forEach(btn => {
    btn.onclick = () => setActiveChecklistDay(btn.dataset.day);
  });
}

function syncDailyChecklistDateInput() {
  const dateInput = document.getElementById('daily-checklist-date');
  if (!dateInput) return;
  const { key } = getActiveDayEntry();
  if (dateInput.value !== key) dateInput.value = key;
}

function renderDailyChecklistItems() {
  const listEl = document.getElementById('daily-checklist-list');
  const subtitleEl = document.getElementById('daily-checklist-subtitle');
  if (!listEl) return;

  const { key, entry } = getActiveDayEntry();
  const items = entry.items || [];
  const isToday = isTodayKey(key);

  if (subtitleEl) {
    const fullDate = formatDayTabTitle(key);
    const visitNote = entry.visitedAt ? ` · Nucleus ${formatVisitStamp(entry.visitedAt)}` : '';
    subtitleEl.textContent = isToday
      ? `${fullDate}${visitNote} · heredada del día anterior, checks en cero`
      : `${fullDate}${visitNote}`;
  }

  renderDailyChecklistStatus(key, entry, items);

  listEl.innerHTML = items.map((item, index) => `
    <div class="daily-checklist-row" data-id="${item.id}">
      <input type="checkbox" class="daily-checklist-check" ${item.checked ? 'checked' : ''} aria-label="Marcar ítem">
      <input type="text" class="daily-checklist-text" value="${escapeChecklistText(item.text)}" placeholder="Escribe un ítem…" spellcheck="false">
      <button type="button" class="daily-checklist-remove" aria-label="Quitar ítem" title="Quitar">×</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.daily-checklist-row').forEach(row => {
    const id = row.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    const check = row.querySelector('.daily-checklist-check');
    const text = row.querySelector('.daily-checklist-text');
    const remove = row.querySelector('.daily-checklist-remove');

    check.onchange = () => {
      item.checked = check.checked;
      saveDailyChecklistState();
      renderDailyChecklistTabs();
      renderDailyChecklistStatus(key, entry, items);
      window.updateNucleusHud?.();
    };

    text.oninput = () => {
      item.text = text.value;
      saveDailyChecklistState();
    };

    text.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDailyChecklistItemAfter(id);
      }
      if (e.key === 'Backspace' && !text.value && items.length > 1) {
        e.preventDefault();
        removeDailyChecklistItem(id);
      }
    };

    remove.onclick = () => removeDailyChecklistItem(id);
  });
}

function escapeChecklistText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function addDailyChecklistItemAfter(afterId) {
  const { entry } = getActiveDayEntry();
  const items = entry.items;
  const newItem = { id: generateChecklistItemId(), text: '', checked: false };
  const idx = afterId ? items.findIndex(i => i.id === afterId) : items.length - 1;
  items.splice(idx + 1, 0, newItem);
  saveDailyChecklistState();
  renderDailyChecklist();
  requestAnimationFrame(() => {
    const row = document.querySelector(`.daily-checklist-row[data-id="${newItem.id}"] .daily-checklist-text`);
    row?.focus();
  });
}

function removeDailyChecklistItem(id) {
  const { entry } = getActiveDayEntry();
  if (entry.items.length <= 1) {
    entry.items[0].text = '';
    entry.items[0].checked = false;
  } else {
    entry.items = entry.items.filter(i => i.id !== id);
  }
  saveDailyChecklistState();
  renderDailyChecklist();
}

function renderDailyChecklistStatus(dayKey, entry, items) {
  const statusEl = document.getElementById('daily-checklist-status');
  if (!statusEl) return;

  const list = items || entry?.items || [];
  const active = list.filter(i => String(i.text || '').trim());
  const done = active.filter(i => i.checked).length;
  const total = active.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const status = total === 0 ? 'sin ítems' : done === total ? 'completa' : done > 0 ? 'en curso' : 'pendiente';

  statusEl.textContent = `${dayKey} · ${done}/${total || list.length} marcados · ${pct}% · ${status}`;
}

function renderDailyChecklist() {
  renderDailyChecklistTabs();
  renderDailyChecklistItems();
  syncDailyChecklistDateInput();
  window.setNucleusCoreActivity?.(getDailyChecklistProgress());
  window.updateNucleusHud?.();
}

function getDailyChecklistProgress() {
  ensureTodayDay();
  const today = getDayKey();
  const items = dailyChecklistState.days[today]?.items || [];
  const activeItems = items.filter(item => String(item.text || '').trim());
  if (!activeItems.length) return 0.12;
  const done = activeItems.filter(item => item.checked).length;
  return Math.min(1, done / activeItems.length);
}

function openDailyChecklistPanel() {
  if (typeof openNucleusHub === 'function') openNucleusHub();
}

function closeDailyChecklistPanel() {
  if (typeof closeNucleusHub === 'function') closeNucleusHub();
}

function initDailyChecklist() {
  loadDailyChecklistState();
  ensureTodayDay();

  const panel = document.getElementById('daily-checklist-panel');
  const closeBtn = document.getElementById('daily-checklist-close');
  const addBtn = document.getElementById('daily-checklist-add');
  const dateInput = document.getElementById('daily-checklist-date');

  if (panel) {
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  if (dateInput) {
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) return;
      setActiveChecklistDay(dateInput.value);
    });
  }

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeDailyChecklistPanel();
    };
  }

  if (addBtn) {
    addBtn.onclick = () => {
      const { entry } = getActiveDayEntry();
      addDailyChecklistItemAfter(entry.items[entry.items.length - 1]?.id);
    };
  }

  window.openDailyChecklistPanel = openDailyChecklistPanel;
  window.closeDailyChecklistPanel = closeDailyChecklistPanel;
  window.getDailyChecklistProgress = getDailyChecklistProgress;
  window.renderDailyChecklist = renderDailyChecklist;
  window.recordNucleusVisit = recordNucleusVisit;
}
