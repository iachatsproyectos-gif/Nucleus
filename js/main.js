function initApp() {
  initMarkers();
  initDocuments();
  initMedia();
  initAutomation();
  initChapters();
  initToolbar();

  loadState();
  updateTransform();
  render();
  lucide.createIcons();
}

initApp();
