import { apiFetch, getQueryParams, showToast } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const query = getQueryParams();
  const token = query.get('token');

  const missingTokenWarning = document.getElementById('missingTokenWarning');
  const resetForm = document.getElementById('resetForm');
  const resetFormContainer = document.getElementById('resetFormContainer');
  const resetSuccessView = document.getElementById('resetSuccessView');
  const resetSubmitBtn = document.getElementById('resetSubmitBtn');

  const newPasswordInput = document.getElementById('newPassword');
  const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
  const newPasswordToggleBtn = document.getElementById('newPasswordToggleBtn');
  const confirmNewPasswordToggleBtn = document.getElementById('confirmNewPasswordToggleBtn');

  const passwordGroup = document.getElementById('passwordGroup');
  const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
  const passwordValidationBlock = document.getElementById('passwordValidationBlock');

  const strengthBarFill = document.getElementById('strengthBarFill');
  const strengthStatus = document.getElementById('strengthStatus');

  const ruleMinLength = document.getElementById('ruleMinLength');
  const ruleUpperLower = document.getElementById('ruleUpperLower');
  const ruleNumber = document.getElementById('ruleNumber');
  const ruleSpecial = document.getElementById('ruleSpecial');

  setupHeroTilt();
  setupToggle(newPasswordToggleBtn, newPasswordInput);
  setupToggle(confirmNewPasswordToggleBtn, confirmNewPasswordInput);

  if (!token) {
    missingTokenWarning.style.display = 'flex';
  }

  // Password rules validation
  const checkRules = (val) => {
    const minLength = val.length >= 8;
    const upperLower = /[a-z]/.test(val) && /[A-Z]/.test(val);
    const number = /[0-9]/.test(val);
    const special = /[^A-Za-z0-9]/.test(val);
    return {
      minLength,
      upperLower,
      number,
      special,
      allValid: minLength && upperLower && number && special
    };
  };

  const updateRuleUI = (el, valid) => {
    if (!el) return;
    const icon = el.querySelector('.criteria-icon');
    if (valid) {
      el.classList.add('valid');
      if (icon) {
        icon.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3.5 8.5 6.5 11.5 12.5 5.5"></polyline></svg>`;
      }
    } else {
      el.classList.remove('valid');
      if (icon) {
        icon.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="3" /></svg>`;
      }
    }
  };

  const evaluate = () => {
    const val = newPasswordInput.value;
    const rules = checkRules(val);

    updateRuleUI(ruleMinLength, rules.minLength);
    updateRuleUI(ruleUpperLower, rules.upperLower);
    updateRuleUI(ruleNumber, rules.number);
    updateRuleUI(ruleSpecial, rules.special);

    let score = (rules.minLength ? 1 : 0) + (rules.upperLower ? 1 : 0) + (rules.number ? 1 : 0) + (rules.special ? 1 : 0);
    if (val.length >= 12 && score === 4) score = 5;

    if (!val) {
      strengthBarFill.style.width = '0%';
      strengthBarFill.className = 'strength-bar-fill';
      strengthStatus.textContent = 'Too weak';
      strengthStatus.style.color = 'var(--text-muted)';
      return rules;
    }

    if (score <= 1) {
      strengthBarFill.style.width = '25%';
      strengthBarFill.className = 'strength-bar-fill level-weak';
      strengthStatus.textContent = 'Weak';
      strengthStatus.style.color = '#ef4444';
    } else if (score === 2) {
      strengthBarFill.style.width = '50%';
      strengthBarFill.className = 'strength-bar-fill level-fair';
      strengthStatus.textContent = 'Fair';
      strengthStatus.style.color = '#f59e0b';
    } else if (score >= 3 && score < 5) {
      strengthBarFill.style.width = '75%';
      strengthBarFill.className = 'strength-bar-fill level-good';
      strengthStatus.textContent = 'Good';
      strengthStatus.style.color = '#3b82f6';
    } else {
      strengthBarFill.style.width = '100%';
      strengthBarFill.className = 'strength-bar-fill level-strong';
      strengthStatus.textContent = 'Very Strong';
      strengthStatus.style.color = '#10b981';
    }
    return rules;
  };

  newPasswordInput.addEventListener('input', () => {
    passwordGroup.classList.remove('has-error');
    passwordValidationBlock.classList.remove('has-error');
    evaluate();
    if (confirmNewPasswordInput.value) validateMatch();
  });

  confirmNewPasswordInput.addEventListener('input', () => {
    validateMatch();
  });

  function validateMatch() {
    const p = newPasswordInput.value;
    const c = confirmNewPasswordInput.value;
    if (c && p !== c) {
      confirmPasswordGroup.classList.add('has-error');
      return false;
    } else {
      confirmPasswordGroup.classList.remove('has-error');
      return true;
    }
  }

  function setupToggle(btn, input) {
    if (!btn || !input) return;
    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');
    btn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      if (isPass) {
        eyeOpen.style.display = 'none';
        eyeClosed.style.display = 'block';
      } else {
        eyeOpen.style.display = 'block';
        eyeClosed.style.display = 'none';
      }
      input.focus();
    });
  }

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!token) {
      showToast('Error: No reset token provided. Please use the email link.');
      return;
    }

    const passwordVal = newPasswordInput.value;
    const confirmVal = confirmNewPasswordInput.value;
    const rules = checkRules(passwordVal);

    let isValid = true;
    if (!rules.allValid) {
      passwordGroup.classList.add('has-error');
      passwordValidationBlock.classList.add('has-error');
      isValid = false;
    }

    if (!confirmVal || passwordVal !== confirmVal) {
      confirmPasswordGroup.classList.add('has-error');
      isValid = false;
    }

    if (!isValid) {
      showToast('Please fix the password errors.');
      return;
    }

    resetSubmitBtn.classList.add('is-loading');
    resetSubmitBtn.disabled = true;

    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: token,
          new_password: passwordVal
        })
      });

      if (res.ok) {
        setTimeout(() => {
          resetSubmitBtn.classList.remove('is-loading');
          resetSubmitBtn.disabled = false;
          resetFormContainer.style.display = 'none';
          resetSuccessView.style.display = 'flex';
          showToast('Password reset successful!');
        }, 600);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Password reset failed. Link may have expired.');
        resetSubmitBtn.classList.remove('is-loading');
        resetSubmitBtn.disabled = false;
      }
    } catch (error) {
      showToast('Password reset error.');
      resetSubmitBtn.classList.remove('is-loading');
      resetSubmitBtn.disabled = false;
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
