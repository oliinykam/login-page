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

    // Target values (from mouse)
    let targetRotateX = 0;
    let targetRotateY = 0;
    let targetImgX = 0;
    let targetImgY = 0;
    let targetTextX = 0;
    let targetTextY = 0;
    let targetShineX = 50;
    let targetShineY = 50;

    // Current interpolated values
    let currentRotateX = 0;
    let currentRotateY = 0;
    let currentImgX = 0;
    let currentImgY = 0;
    let currentTextX = 0;
    let currentTextY = 0;
    let currentShineX = 50;
    let currentShineY = 50;

    let rafId = null;

    // Linear interpolation helper
    const lerp = (start, end, factor) => start + (end - start) * factor;

    const updateAnimation = () => {
      // Smooth lerp factor (0.1 for fluid response)
      const factor = isHovering ? 0.1 : 0.06;

      currentRotateX = lerp(currentRotateX, targetRotateX, factor);
      currentRotateY = lerp(currentRotateY, targetRotateY, factor);
      currentImgX = lerp(currentImgX, targetImgX, factor);
      currentImgY = lerp(currentImgY, targetImgY, factor);
      currentTextX = lerp(currentTextX, targetTextX, factor);
      currentTextY = lerp(currentTextY, targetTextY, factor);
      currentShineX = lerp(currentShineX, targetShineX, factor);
      currentShineY = lerp(currentShineY, targetShineY, factor);

      // Apply 3D rotation & depth to hero panel
      heroPanel.style.transform = `perspective(1000px) rotateX(${currentRotateX.toFixed(2)}deg) rotateY(${currentRotateY.toFixed(2)}deg) translateZ(0)`;

      // Apply parallax displacement to background image
      if (heroBgImg) {
        heroBgImg.style.transform = `translate3d(${currentImgX.toFixed(2)}px, ${currentImgY.toFixed(2)}px, -20px) scale(1.12)`;
      }

      // Apply specular glare position
      if (heroShine) {
        heroPanel.style.setProperty('--shine-x', `${currentShineX.toFixed(1)}%`);
        heroPanel.style.setProperty('--shine-y', `${currentShineY.toFixed(1)}%`);
      }

      // Apply parallax layering to foreground typography
      if (quoteHeader) {
        quoteHeader.style.transform = `translate3d(${currentTextX.toFixed(2)}px, ${currentTextY.toFixed(2)}px, 32px)`;
      }
      if (quoteBody) {
        quoteBody.style.transform = `translate3d(${(currentTextX * 1.3).toFixed(2)}px, ${(currentTextY * 1.3).toFixed(2)}px, 48px)`;
      }

      // Stop loop when idle and back near zero
      const isSettled =
        !isHovering &&
        Math.abs(currentRotateX) < 0.05 &&
        Math.abs(currentRotateY) < 0.05 &&
        Math.abs(currentImgX) < 0.05 &&
        Math.abs(currentImgY) < 0.05;

      if (!isSettled) {
        rafId = requestAnimationFrame(updateAnimation);
      } else {
        // Reset precisely
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

      const normX = (mouseX / bounds.width) * 2 - 1; // -1 to +1
      const normY = (mouseY / bounds.height) * 2 - 1; // -1 to +1

      // Subtle, elegant 3D tilt max angles (deg)
      const maxTilt = 3.5;
      targetRotateX = -normY * maxTilt;
      targetRotateY = normX * maxTilt;

      // Subtle parallax shifts
      targetImgX = -normX * 8; // opposite direction for subtle depth
      targetImgY = -normY * 8;

      targetTextX = normX * 3; // subtle forward pop
      targetTextY = normY * 3;

      // Glare highlight tracking percentage
      targetShineX = (mouseX / bounds.width) * 100;
      targetShineY = (mouseY / bounds.height) * 100;

      startAnimationLoop();
    });

    heroPanel.addEventListener('mouseleave', () => {
      isHovering = false;
      heroPanel.classList.remove('is-tilting');

      // Return smoothly to center
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

    // Handle window resize dynamically
    window.addEventListener('resize', () => {
      if (isHovering) {
        bounds = heroPanel.getBoundingClientRect();
      }
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
    if (formGroup) {
      formGroup.classList.remove('has-error');
    }
  };

  [emailInput, passwordInput].forEach((input) => {
    if (input) {
      input.addEventListener('input', () => clearError(input));
    }
  });

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      let isValid = true;
      const emailVal = emailInput.value.trim();
      const passwordVal = passwordInput.value;

      // Validate Email
      const emailGroup = emailInput.closest('.form-group');
      if (!validateEmail(emailVal)) {
        emailGroup.classList.add('has-error');
        isValid = false;
      } else {
        emailGroup.classList.remove('has-error');
      }

      // Validate Password
      const passwordGroup = passwordInput.closest('.form-group');
      if (!passwordVal || passwordVal.length < 6) {
        passwordGroup.classList.add('has-error');
        isValid = false;
      } else {
        passwordGroup.classList.remove('has-error');
      }

      if (isValid) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;

        setTimeout(() => {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
          showToast(`Welcome back, ${emailVal}!`);
        }, 1200);
      }
    });
  }

  // Google Sign-In button interaction
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      showToast('Connecting to Google Account...');
    });
  }
});
