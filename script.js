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

  // Password Visibility Toggle
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

  // Toast notification helper
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

  // Input Error Clearing on Typing
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

  // Validation function
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Form Submit Handler
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
        // Simulate loading state
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
