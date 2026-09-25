import { apiFetch, getQueryParams, showToast } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const query = getQueryParams();
  const token = query.get('token');

  const stateVerifying = document.getElementById('stateVerifying');
  const stateSuccess = document.getElementById('stateSuccess');
  const stateError = document.getElementById('stateError');
  const errorMessageText = document.getElementById('errorMessageText');

  setupHeroTilt();

  if (!token) {
    stateVerifying.style.display = 'none';
    errorMessageText.textContent = 'No activation token provided in URL. Please check your email link.';
    stateError.style.display = 'flex';
    return;
  }

  try {
    const res = await apiFetch(`/api/auth/activate?token=${encodeURIComponent(token)}`);
    
    // Smooth transition timeout
    setTimeout(async () => {
      stateVerifying.style.display = 'none';
      if (res.ok) {
        stateSuccess.style.display = 'flex';
        showToast('Account activated successfully!');
      } else {
        const err = await res.json().catch(() => ({}));
        errorMessageText.textContent = err.detail || 'Activation link is invalid or expired.';
        stateError.style.display = 'flex';
      }
    }, 900);

  } catch (error) {
    setTimeout(() => {
      stateVerifying.style.display = 'none';
      errorMessageText.textContent = 'Failed to connect to verification server.';
      stateError.style.display = 'flex';
    }, 900);
  }
});

function setupHeroTilt() {
  const heroPanel = document.getElementById('heroPanel');
  const heroBgImg = document.getElementById('heroBgImg');
  const heroShine = document.getElementById('heroShine');
  const quoteHeader = document.querySelector('.quote-header');
  const quoteBody = document.querySelector('.quote-body');

  if (!heroPanel || !window.matchMedia('(hover: hover)').matches) return;

  let isHovering = false, bounds = null;
  let targetRotateX = 0, targetRotateY = 0, targetImgX = 0, targetImgY = 0;
  let targetTextX = 0, targetTextY = 0, targetShineX = 50, targetShineY = 50;
  let currentRotateX = 0, currentRotateY = 0, currentImgX = 0, currentImgY = 0;
  let currentTextX = 0, currentTextY = 0, currentShineX = 50, currentShineY = 50;
  let rafId = null;

  const lerp = (start, end, factor) => start + (end - start) * factor;

  const update = () => {
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
      rafId = requestAnimationFrame(update);
    } else {
      heroPanel.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
      rafId = null;
    }
  };

  heroPanel.addEventListener('mouseenter', () => {
    isHovering = true;
    bounds = heroPanel.getBoundingClientRect();
    heroPanel.classList.add('is-tilting');
    if (!rafId) rafId = requestAnimationFrame(update);
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

    if (!rafId) rafId = requestAnimationFrame(update);
  });

  heroPanel.addEventListener('mouseleave', () => {
    isHovering = false;
    heroPanel.classList.remove('is-tilting');
    targetRotateX = 0; targetRotateY = 0;
    targetImgX = 0; targetImgY = 0;
    targetTextX = 0; targetTextY = 0;
    targetShineX = 50; targetShineY = 50;
    if (!rafId) rafId = requestAnimationFrame(update);
  });
}
