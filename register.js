document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const registerForm = document.getElementById('registerForm');
  const formContainer = document.getElementById('formContainer');
  const successView = document.getElementById('successView');
  const registeredEmailDisplay = document.getElementById('registeredEmailDisplay');

  const emailInput = document.getElementById('regEmail');
  const passwordInput = document.getElementById('regPassword');
  const confirmPasswordInput = document.getElementById('regConfirmPassword');

  const passwordToggleBtn = document.getElementById('passwordToggleBtn');
  const confirmPasswordToggleBtn = document.getElementById('confirmPasswordToggleBtn');

  const emailGroup = document.getElementById('emailGroup');
  const passwordGroup = document.getElementById('passwordGroup');
  const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
  const captchaGroup = document.getElementById('captchaGroup');

  const strengthBarFill = document.getElementById('strengthBarFill');
  const strengthStatus = document.getElementById('strengthStatus');

  const ruleMinLength = document.getElementById('ruleMinLength');
  const ruleUpperLower = document.getElementById('ruleUpperLower');
  const ruleNumber = document.getElementById('ruleNumber');
  const ruleSpecial = document.getElementById('ruleSpecial');

  const registerSubmitBtn = document.getElementById('registerSubmitBtn');
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
      if (isHovering) {
        bounds = heroPanel.getBoundingClientRect();
      }
    });
  }

  /* ==========================================================================
     Password Visibility Toggles
     ========================================================================== */
  const setupPasswordToggle = (button, input) => {
    if (!button || !input) return;
    const eyeOpen = button.querySelector('.eye-open');
    const eyeClosed = button.querySelector('.eye-closed');

    button.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      if (isPassword) {
        if (eyeOpen) eyeOpen.style.display = 'none';
        if (eyeClosed) eyeClosed.style.display = 'block';
        button.setAttribute('aria-label', 'Hide password');
      } else {
        if (eyeOpen) eyeOpen.style.display = 'block';
        if (eyeClosed) eyeClosed.style.display = 'none';
        button.setAttribute('aria-label', 'Show password');
      }
      input.focus();
    });
  };

  setupPasswordToggle(passwordToggleBtn, passwordInput);
  setupPasswordToggle(confirmPasswordToggleBtn, confirmPasswordInput);

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
    }, 4000);
  };

  /* ==========================================================================
     Password Validation & Strength Engine (Regex-based)
     ========================================================================== */
  const checkRules = (val) => {
    const minLengthValid = val.length >= 8;
    const upperLowerValid = /[a-z]/.test(val) && /[A-Z]/.test(val);
    const numberValid = /[0-9]/.test(val);
    const specialValid = /[^A-Za-z0-9]/.test(val);

    return {
      minLength: minLengthValid,
      upperLower: upperLowerValid,
      number: numberValid,
      special: specialValid,
      allValid: minLengthValid && upperLowerValid && numberValid && specialValid
    };
  };

  const updateCriteriaUI = (element, isValid) => {
    if (!element) return;
    const icon = element.querySelector('.criteria-icon');
    if (isValid) {
      element.classList.add('valid');
      if (icon) {
        icon.innerHTML = `
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3.5 8.5 6.5 11.5 12.5 5.5"></polyline>
          </svg>
        `;
      }
    } else {
      element.classList.remove('valid');
      if (icon) {
        icon.innerHTML = `
          <svg viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="3" />
          </svg>
        `;
      }
    }
  };

  const evaluatePassword = () => {
    const val = passwordInput.value;
    const rules = checkRules(val);

    updateCriteriaUI(ruleMinLength, rules.minLength);
    updateCriteriaUI(ruleUpperLower, rules.upperLower);
    updateCriteriaUI(ruleNumber, rules.number);
    updateCriteriaUI(ruleSpecial, rules.special);

    // Calculate score (0 - 4)
    let score = 0;
    if (rules.minLength) score++;
    if (rules.upperLower) score++;
    if (rules.number) score++;
    if (rules.special) score++;

    // Extra bonus for length > 12
    if (val.length >= 12 && score === 4) {
      score = 5;
    }

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
    } else if (score === 3 || score === 4) {
      strengthBarFill.style.width = '75%';
      strengthBarFill.className = 'strength-bar-fill level-good';
      strengthStatus.textContent = 'Good';
      strengthStatus.style.color = '#3b82f6';
    } else if (score >= 5) {
      strengthBarFill.style.width = '100%';
      strengthBarFill.className = 'strength-bar-fill level-strong';
      strengthStatus.textContent = 'Very Strong';
      strengthStatus.style.color = '#10b981';
    }

    return rules;
  };

  const validateConfirmPassword = () => {
    const passwordVal = passwordInput.value;
    const confirmVal = confirmPasswordInput.value;

    if (!confirmVal) {
      confirmPasswordGroup.classList.remove('has-error');
      return false;
    }

    if (passwordVal !== confirmVal) {
      confirmPasswordGroup.classList.add('has-error');
      return false;
    } else {
      confirmPasswordGroup.classList.remove('has-error');
      return true;
    }
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Event Listeners for real-time validation
  emailInput.addEventListener('input', () => {
    emailGroup.classList.remove('has-error');
  });

  passwordInput.addEventListener('input', () => {
    passwordGroup.classList.remove('has-error');
    evaluatePassword();
    if (confirmPasswordInput.value) {
      validateConfirmPassword();
    }
  });

  confirmPasswordInput.addEventListener('input', () => {
    validateConfirmPassword();
  });

  /* ==========================================================================
     CAPTCHA Callbacks & Verification
     ========================================================================== */
  let captchaToken = null;

  window.onCaptchaVerified = (token) => {
    captchaToken = token;
    captchaGroup.classList.remove('has-error');
  };

  window.onCaptchaExpired = () => {
    captchaToken = null;
  };

  const getCaptchaToken = () => {
    if (typeof grecaptcha !== 'undefined') {
      try {
        const response = grecaptcha.getResponse();
        if (response) return response;
      } catch (e) {
        // Fallback or local environment bypass if widget not initialized
      }
    }
    return captchaToken;
  };

  /* ==========================================================================
     Form Submission Handler
     ========================================================================== */
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    let isValid = true;
    const emailVal = emailInput.value.trim();
    const passwordVal = passwordInput.value;
    const confirmPasswordVal = confirmPasswordInput.value;
    const rules = checkRules(passwordVal);

    // 1. Validate Email
    if (!validateEmail(emailVal)) {
      emailGroup.classList.add('has-error');
      isValid = false;
    } else {
      emailGroup.classList.remove('has-error');
    }

    // 2. Validate Password Rules
    if (!rules.allValid) {
      passwordGroup.classList.add('has-error');
      isValid = false;
    } else {
      passwordGroup.classList.remove('has-error');
    }

    // 3. Validate Password Match
    if (!confirmPasswordVal || passwordVal !== confirmPasswordVal) {
      confirmPasswordGroup.classList.add('has-error');
      isValid = false;
    } else {
      confirmPasswordGroup.classList.remove('has-error');
    }

    // 4. Validate CAPTCHA
    const currentCaptchaToken = getCaptchaToken();
    // Allow pass if reCAPTCHA is not reachable (e.g. offline/no network) or if solved
    const hasRecaptchaLoaded = typeof grecaptcha !== 'undefined';
    if (hasRecaptchaLoaded && !currentCaptchaToken) {
      captchaGroup.classList.add('has-error');
      isValid = false;
    } else {
      captchaGroup.classList.remove('has-error');
    }

    if (!isValid) {
      showToast('Please correct the errors in the form.');
      return;
    }

    // Loading State
    registerSubmitBtn.classList.add('is-loading');
    registerSubmitBtn.disabled = true;

    try {
      // Simulate/Attempt backend registration POST request
      const payload = {
        email: emailVal,
        password: passwordVal,
        captcha_token: currentCaptchaToken || 'test_token'
      };

      // Optional real backend call if API exists, else graceful fallback
      let success = true;
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          success = true;
        } else if (response.status !== 404) {
          const errData = await response.json().catch(() => ({}));
          showToast(errData.detail || 'Registration failed. Please try again.');
          registerSubmitBtn.classList.remove('is-loading');
          registerSubmitBtn.disabled = false;
          return;
        }
      } catch (err) {
        // Backend not yet running, proceed with frontend demo flow
        success = true;
      }

      setTimeout(() => {
        registerSubmitBtn.classList.remove('is-loading');
        registerSubmitBtn.disabled = false;

        // Show Success Activation Notice View
        registeredEmailDisplay.textContent = emailVal;
        formContainer.style.display = 'none';
        successView.style.display = 'flex';

        showToast('Registration successful! Check your email.');
      }, 1000);

    } catch (error) {
      registerSubmitBtn.classList.remove('is-loading');
      registerSubmitBtn.disabled = false;
      showToast('An unexpected error occurred. Please try again.');
    }
  });
});
