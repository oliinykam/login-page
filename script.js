import { setAccessToken, setStoredUser, apiFetch } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const passwordToggleBtn = document.getElementById('passwordToggleBtn');
  const eyeOpen = document.querySelector('.eye-open');
  const eyeClosed = document.querySelector('.eye-closed');
  const submitBtn = document.getElementById('submitBtn');
  const googleBtn = document.getElementById('googleSignInBtn');
  const toast = document.getElementById('toast');

  // Hero Panel 3D Tilt & Parallax Elements
  const heroPanel = document.getElementById('heroPanel');
  const heroBgImg = document.getElementById('heroBgImg');
  const heroShine = document.getElementById('heroShine');
  const quoteHeader = document.querySelector('.quote-header');
  const quoteBody = document.querySelector('.quote-body');

  /* ==========================================================================
     3D Mouse Tilt & Parallax Controller (Vanilla JS + rAF Lerp)
     ========================================================================== */
  if (heroPanel && window.matchMedia('(hover: hover)').matches) {
    let isHovering = false;
    let bounds = null;

    let targetRotateX = 0;
    let targetRotateY = 0;
    let targetImgX = 0;
    let targetImgY = 0;
    let targetTextX = 0;
    let targetTextY = 0;
    let targetShineX = 50;
    let targetShineY = 50;

    let currentRotateX = 0;
    let currentRotateY = 0;
    let currentImgX = 0;
    let currentImgY = 0;
    let currentTextX = 0;
    let currentTextY = 0;
    let currentShineX = 50;
    let currentShineY = 50;

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

      if (heroBgImg) {
        heroBgImg.style.transform = `translate3d(${currentImgX.toFixed(2)}px, ${currentImgY.toFixed(2)}px, -20px) scale(1.12)`;
      }

      if (heroShine) {
        heroPanel.style.setProperty('--shine-x', `${currentShineX.toFixed(1)}%`);
        heroPanel.style.setProperty('--shine-y', `${currentShineY.toFixed(1)}%`);
      }

      if (quoteHeader) {
        quoteHeader.style.transform = `translate3d(${currentTextX.toFixed(2)}px, ${currentTextY.toFixed(2)}px, 32px)`;
      }
      if (quoteBody) {
        quoteBody.style.transform = `translate3d(${(currentTextX * 1.3).toFixed(2)}px, ${(currentTextY * 1.3).toFixed(2)}px, 48px)`;
      }

      const isSettled =
        !isHovering &&
        Math.abs(currentRotateX) < 0.05 &&
        Math.abs(currentRotateY) < 0.05 &&
        Math.abs(currentImgX) < 0.05 &&
        Math.abs(currentImgY) < 0.05;

      if (!isSettled) {
        rafId = requestAnimationFrame(updateAnimation);
      } else {
        heroPanel.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
        if (heroBgImg) heroBgImg.style.transform = 'scale(1.08) translate3d(0, 0, -20px)';
        if (quoteHeader) quoteHeader.style.transform = 'translate3d(0, 0, 30px)';
        if (quoteBody) quoteBody.style.transform = 'translate3d(0, 0, 45px)';
        rafId = null;
      }
    };

    const startAnimationLoop = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(updateAnimation);
      }
    };

    heroPanel.addEventListener('mouseenter', () => {
      isHovering = true;
      bounds = heroPanel.getBoundingClientRect();
      heroPanel.classList.add('is-tilting');
      startAnimationLoop();
    });

    heroPanel.addEventListener('mousemove', (e) => {
      if (!bounds) bounds = heroPanel.getBoundingClientRect();

      const mouseX = e.clientX - bounds.left;
      const mouseY = e.clientY - bounds.top;
      const normX = (mouseX / bounds.width) * 2 - 1;
      const normY = (mouseY / bounds.height) * 2 - 1;

      const maxTilt = 3.5;
      targetRotateX = -normY * maxTilt;
      targetRotateY = normX * maxTilt;
      targetImgX = -normX * 8;
      targetImgY = -normY * 8;
      targetTextX = normX * 3;
      targetTextY = normY * 3;
      targetShineX = (mouseX / bounds.width) * 100;
      targetShineY = (mouseY / bounds.height) * 100;

      startAnimationLoop();
    });

    heroPanel.addEventListener('mouseleave', () => {
      isHovering = false;
      heroPanel.classList.remove('is-tilting');
      targetRotateX = 0;
      targetRotateY = 0;
      targetImgX = 0;
      targetImgY = 0;
      targetTextX = 0;
      targetTextY = 0;
      targetShineX = 50;
      targetShineY = 50;
      startAnimationLoop();
    });

    window.addEventListener('resize', () => {
      if (isHovering) bounds = heroPanel.getBoundingClientRect();
    });
  }

  /* ==========================================================================
     Password Visibility Toggle
     ========================================================================== */
  if (passwordToggleBtn && passwordInput) {
    passwordToggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      if (isPassword) {
        eyeOpen.style.display = 'none';
        eyeClosed.style.display = 'block';
        passwordToggleBtn.setAttribute('aria-label', 'Hide password');
      } else {
        eyeOpen.style.display = 'block';
        eyeClosed.style.display = 'none';
        passwordToggleBtn.setAttribute('aria-label', 'Show password');
      }
      passwordInput.focus();
    });
  }

  /* ==========================================================================
     Toast Notification Helper
     ========================================================================== */
  let toastTimer;
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  };

  /* ==========================================================================
     Input Validation & Form Handling
     ========================================================================== */
  const clearError = (input) => {
    const formGroup = input.closest('.form-group');
    if (formGroup) formGroup.classList.remove('has-error');
  };

  [emailInput, passwordInput].forEach((input) => {
    if (input) input.addEventListener('input', () => clearError(input));
  });

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // 2FA step elements
  const totpStep      = document.getElementById('totpStep');
  const totpCode      = document.getElementById('totpCode');
  const totpGroup     = document.getElementById('totpGroup');
  const totpSubmitBtn = document.getElementById('totpSubmitBtn');
  const totpBackBtn   = document.getElementById('totpBackBtn');
  let pendingTempToken = null;

  const showTotpStep = (tempToken) => {
    pendingTempToken = tempToken;
    loginForm.style.display = 'none';
    totpStep.style.display = 'block';
    totpCode.value = '';
    totpCode.focus();
  };

  const showLoginForm = () => {
    pendingTempToken = null;
    loginForm.style.display = 'block';
    totpStep.style.display = 'none';
  };

  if (totpBackBtn) totpBackBtn.addEventListener('click', showLoginForm);

  // Check URL parameters for OAuth errors or 2FA challenge
  const urlParams = new URLSearchParams(window.location.search);
  const oauthError = urlParams.get('error');
  if (oauthError) {
    showToast(`Google Sign-In: ${decodeURIComponent(oauthError)}`);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  const isTwoFa = urlParams.get('two_factor');
  const tempTokenParam = urlParams.get('temp_token');
  if (isTwoFa && tempTokenParam) {
    showTotpStep(tempTokenParam);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Auto-submit when 6 digits entered
  if (totpCode) {
    totpCode.addEventListener('input', () => {
      totpGroup.classList.remove('has-error');
      totpCode.value = totpCode.value.replace(/\D/g, '').slice(0, 6);
      if (totpCode.value.length === 6) totpSubmitBtn.click();
    });
  }

  if (totpSubmitBtn) {
    totpSubmitBtn.addEventListener('click', async () => {
      const code = totpCode.value.trim();
      if (code.length !== 6) {
        totpGroup.classList.add('has-error');
        return;
      }

      totpSubmitBtn.classList.add('is-loading');
      totpSubmitBtn.disabled = true;

      try {
        const res = await apiFetch('/api/auth/2fa/verify', {
          method: 'POST',
          body: JSON.stringify({ temp_token: pendingTempToken, totp_code: code })
        });

        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.access_token);
          showToast('Authenticated! Redirecting…');
          setTimeout(() => { window.location.href = 'profile.html'; }, 700);
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.detail || 'Invalid code. Please try again.');
          totpCode.value = '';
          totpCode.focus();
        }
      } catch {
        showToast('Could not connect to server.');
      } finally {
        totpSubmitBtn.classList.remove('is-loading');
        totpSubmitBtn.disabled = false;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      let isValid = true;
      const emailVal = emailInput.value.trim();
      const passwordVal = passwordInput.value;

      const emailGroup = emailInput.closest('.form-group');
      if (!validateEmail(emailVal)) {
        emailGroup.classList.add('has-error');
        isValid = false;
      } else {
        emailGroup.classList.remove('has-error');
      }

      const passwordGroup = passwordInput.closest('.form-group');
      if (!passwordVal) {
        passwordGroup.classList.add('has-error');
        isValid = false;
      } else {
        passwordGroup.classList.remove('has-error');
      }

      if (!isValid) return;

      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;

      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: emailVal, password: passwordVal })
        });

        if (res.ok) {
          const data = await res.json();

          // 2FA required — switch to TOTP step
          if (data.token_type === '2fa_required') {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
            showTotpStep(data.access_token);
            return;
          }

          setAccessToken(data.access_token);
          showToast(`Welcome back, ${emailVal}!`);
          setTimeout(() => { window.location.href = 'profile.html'; }, 800);

        } else if (res.status === 423) {
          const err = await res.json().catch(() => ({}));
          showToast(err.detail || 'Account is temporarily locked. Try again later.');

        } else if (res.status === 403) {
          showToast('Account not activated. Please check your email inbox.');

        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.detail || 'Invalid email or password.');
        }
      } catch {
        showToast('Could not connect to server. Please try again.');
      } finally {
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      }
    });
  }

  // Google Sign-In button
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      window.location.href = '/api/auth/oauth/login';
    });
  }
});
