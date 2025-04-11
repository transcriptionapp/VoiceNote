import { onboardingManager } from '../js/modules/onboardingManager.js';

// Initialize onboarding manager and check if we should be on this page
(async () => {
  await onboardingManager.init();
  await onboardingManager.checkRedirect();
})();

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-button');
  if (startBtn) {
    const handler = async () => {
      await onboardingManager.nextStep();
    };
    startBtn.addEventListener('click', handler);
    startBtn.addEventListener('touchstart', handler);
  }
});