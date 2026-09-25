import { apiFetch, showToast } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const forgotForm = document.getElementById('forgotForm');
  const forgotEmail = document.getElementById('forgotEmail');
  const emailGroup = document.getElementById('emailGroup');
  const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
  const forgotFormContainer = document.getElementById('forgotFormContainer');
  const forgotSuccessView = document.getElementById('forgotSuccessView');
  const sentEmailDisplay = document.getElementById('sentEmailDisplay');

  // Hero Tilt
  setupHeroTilt();

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  forgotEmail.addEventListener('input', () => {
    emailGroup.classList.remove('has-error');
  });

  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = forgotEmail.value.trim();
    if (!validateEmail(email)) {
      emailGroup.classList.add('has-error');
      showToast('Please enter a valid email address.');
      return;
    }

    forgotSubmitBtn.classList.add('is-loading');
    forgotSubmitBtn.disabled = true;

    try {
      // Call backend POST /api/auth/forgot-password
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      // Show success view regardless of backend response (security best practice)
      setTimeout(() => {
        forgotSubmitBtn.classList.remove('is-loading');
        forgotSubmitBtn.disabled = false;
        sentEmailDisplay.textContent = email;
        forgotFormContainer.style.display = 'none';
        forgotSuccessView.style.display = 'flex';
        showToast('Password reset link sent.');
      }, 800);

    } catch (err) {
      setTimeout(() => {
        forgotSubmitBtn.classList.remove('is-loading');
        forgotSubmitBtn.disabled = false;
        sentEmailDisplay.textContent = email;
        forgotFormContainer.style.display = 'none';
        forgotSuccessView.style.display = 'flex';
        showToast('Password reset instructions sent.');
      }, 800);
    }
  });
});

function setupHeroTilt() {
  const heroPanel = document.getElementById('heroPanel');
  const heroBgImg = document.getElementById('heroBgImg');
  const heroShine = document.getElementById('heroShine');
  const quoteHeader = document.querySelector('.quote-header');
  const quoteBody = document.querySelector('.quote-body');

  if (!heroPanel || !window.matchMedia('(hover: hover)').matches) return;

  let isHovering = false;
  let bounds = null;

  let targetRotateX = 0, targetRotateY = 0, targetImgX = 0, targetImgY = 0;
  let targetTextX = 0, targetTextY = 0, targetShineX = 50, targetShineY = 50;
  let currentRotateX = 0, currentRotateY = 0, currentImgX = 0, currentImgY = 0;
  let currentTextX = 0, currentTextY = 0, currentShineX = 50, currentShineY = 50;
  let rafId = null;

  const lerp = (start, end, factor) => start + (end - start) * factor;

  const updateAnimation = () => {
    const factor = isHovering ? 0.1 : 0.06;
    currentRotateX = lerp(currentRotateX, targetRotateX, factor);
    currentRotateY = lerp(currentRotateY, targetRotateY, factor);
    currentImgX = lerp(currentImgX, targetImgX, factor);
    currentImgY = lerp(currentImgY, targetImgY, factor);
    currentTextX = lerp(currentTextX, targetTextX, factor);
    currentTextY = lerp(currentTextY, targetTextY, factor);
    currentShineX = lerp(currentShineX, targetShineX, factor);
    currentShineY = lerp(currentShineY, targetShineY, factor);

    heroPanel.style.transform = `perspective(1000px) rotateX(${currentRotateX.toFixed(2)}deg) rotateY(${currentRotateY.toFixed(2)}deg) translateZ(0)`;
    if (heroBgImg) heroBgImg.style.transform = `translate3d(${currentImgX.toFixed(2)}px, ${currentImgY.toFixed(2)}px, -20px) scale(1.12)`;
    if (heroShine) {
      heroPanel.style.setProperty('--shine-x', `${currentShineX.toFixed(1)}%`);
      heroPanel.style.setProperty('--shine-y', `${currentShineY.toFixed(1)}%`);
    }
    if (quoteHeader) quoteHeader.style.transform = `translate3d(${currentTextX.toFixed(2)}px, ${currentTextY.toFixed(2)}px, 32px)`;
    if (quoteBody) quoteBody.style.transform = `translate3d(${(currentTextX * 1.3).toFixed(2)}px, ${(currentTextY * 1.3).toFixed(2)}px, 48px)`;

    const isSettled = !isHovering && Math.abs(currentRotateX) < 0.05 && Math.abs(currentRotateY) < 0.05;
    if (!isSettled) {
      rafId = requestAnimationFrame(updateAnimation);
    } else {
      heroPanel.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
      rafId = null;
    }
  };

  heroPanel.addEventListener('mouseenter', () => {
    isHovering = true;
    bounds = heroPanel.getBoundingClientRect();
    heroPanel.classList.add('is-tilting');
    if (!rafId) rafId = requestAnimationFrame(updateAnimation);
  });

  heroPanel.addEventListener('mousemove', (e) => {
    if (!bounds) bounds = heroPanel.getBoundingClientRect();
    const mouseX = e.clientX - bounds.left;
    const mouseY = e.clientY - bounds.top;
    const normX = (mouseX / bounds.width) * 2 - 1;
    const normY = (mouseY / bounds.height) * 2 - 1;

    targetRotateX = -normY * 3.5;
    targetRotateY = normX * 3.5;
    targetImgX = -normX * 8;
    targetImgY = -normY * 8;
    targetTextX = normX * 3;
    targetTextY = normY * 3;
    targetShineX = (mouseX / bounds.width) * 100;
    targetShineY = (mouseY / bounds.height) * 100;

    if (!rafId) rafId = requestAnimationFrame(updateAnimation);
  });

  heroPanel.addEventListener('mouseleave', () => {
    isHovering = false;
    heroPanel.classList.remove('is-tilting');
    targetRotateX = 0; targetRotateY = 0;
    targetImgX = 0; targetImgY = 0;
    targetTextX = 0; targetTextY = 0;
    targetShineX = 50; targetShineY = 50;
    if (!rafId) rafId = requestAnimationFrame(updateAnimation);
  });
}
