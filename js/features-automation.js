function initAutomation() {
  document.getElementById('add-trigger-btn').onclick = () => createNode('auto-trigger');
  document.getElementById('add-transform-btn').onclick = () => createNode('auto-text');
  document.getElementById('add-copy-btn').onclick = () => createNode('auto-copy');
  document.getElementById('add-log-action-btn').onclick = () => createNode('auto-log');
  document.getElementById('add-delay-btn').onclick = () => createNode('auto-delay');
  document.getElementById('add-notify-btn').onclick = () => createNode('auto-notify');
  document.getElementById('add-read-map-btn').onclick = () => createNode('auto-read-map');
  document.getElementById('add-write-map-btn').onclick = () => createNode('auto-write-map');

  document.getElementById('run-flow-btn').onclick = () => runWorkflow(null);

  document.getElementById('auto-log-clear').onclick = () => clearAutoLog();
  document.getElementById('auto-log-toggle').onclick = () => {
    document.getElementById('auto-log-panel').classList.toggle('collapsed');
  };

  document.getElementById('menu-run-from').onclick = () => {
    if (selectedNode && isAutomationNode(selectedNode)) {
      menu.style.display = 'none';
      runWorkflow(selectedNode);
    }
  };

  if (window.Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
