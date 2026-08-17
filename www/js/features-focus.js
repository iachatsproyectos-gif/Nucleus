function updateFocusHighlights() {
  document.querySelectorAll('.node.focus-dimmed').forEach(el => el.classList.remove('focus-dimmed'));
  document.querySelectorAll('.connection-line.focus-dimmed').forEach(el => el.classList.remove('focus-dimmed'));
}
