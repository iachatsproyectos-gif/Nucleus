function updateEmptyState() {
  const overlay = document.getElementById('empty-state-overlay');
  if (!overlay) return;
  const isEmpty = rootNodes.length === 0 && navigationStack.length === 0;
  overlay.classList.toggle('visible', isEmpty);
}

function initOnboarding() {
  updateEmptyState();

  document.getElementById('empty-add-stack')?.addEventListener('click', () => {
    createNode('stack');
    updateEmptyState();
  });
  document.getElementById('empty-add-node')?.addEventListener('click', () => {
    createNode('system');
    updateEmptyState();
  });
  document.getElementById('empty-add-horizon')?.addEventListener('click', () => {
    if (typeof openPrereqsModalForNewHorizon === 'function') {
      openPrereqsModalForNewHorizon();
    } else {
      createChapter('fogged');
    }
    updateEmptyState();
  });

  const modal = document.getElementById('onboarding-modal');
  if (!modal) return;

  if (localStorage.getItem(ONBOARDING_KEY)) return;

  modal.classList.add('visible');

  let step = 0;
  const steps = modal.querySelectorAll('.onboarding-step');
  const nextBtn = document.getElementById('onboarding-next');
  const skipBtn = document.getElementById('onboarding-skip');

  function showStep(i) {
    steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
    if (nextBtn) nextBtn.textContent = i >= steps.length - 1 ? 'Entendido' : 'Siguiente';
  }

  showStep(0);

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, '1');
    modal.classList.remove('visible');
  }

  if (skipBtn) skipBtn.onclick = finish;
  if (nextBtn) {
    nextBtn.onclick = () => {
      step += 1;
      if (step >= steps.length) finish();
      else showStep(step);
    };
  }
}
