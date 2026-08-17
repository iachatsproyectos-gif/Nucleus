const navHistory = [];
let navHistoryIndex = -1;

function pushNavHistory(nodeId) {
  if (nodeId == null) return;
  if (navHistoryIndex >= 0 && navHistory[navHistoryIndex] === nodeId) return;
  navHistory.splice(navHistoryIndex + 1);
  navHistory.push(nodeId);
  if (navHistory.length > 20) navHistory.shift();
  navHistoryIndex = navHistory.length - 1;
}

function navigateHistory(delta) {
  const next = navHistoryIndex + delta;
  if (next < 0 || next >= navHistory.length) return;
  navHistoryIndex = next;
  navigateToNode(navHistory[navHistoryIndex]);
}

function initShortcutFeatures() {
  window.addEventListener('keydown', (e) => {
    if (typeof isTypingInInput === 'function' && isTypingInInput()) return;

    if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (navigationStack.length > 0) {
        e.preventDefault();
        exitNavigationLevel();
      }
    }
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      exitNavigationLevel();
    }
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateHistory(-1);
    }
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      navigateHistory(1);
    }
  });
}
