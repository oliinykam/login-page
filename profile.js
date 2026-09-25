import { apiFetch, fetchCurrentUser, getAccessToken, logout, showToast } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Check Authentication
  const token = getAccessToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // DOM Elements
  const profileLoading = document.getElementById('profileLoading');
  const profileContentWrap = document.getElementById('profileContentWrap');
  const profileAvatar = document.getElementById('profileAvatar');
  const userEmail = document.getElementById('userEmail');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const userStatusBadge = document.getElementById('userStatusBadge');
  const userIdVal = document.getElementById('userIdVal');
  const userAuthMethod = document.getElementById('userAuthMethod');
  const adminPanelLink = document.getElementById('adminPanelLink');
  const logoutBtn = document.getElementById('logoutBtn');

  // 2FA Elements
  const twoFaStatusBadge = document.getElementById('twoFaStatusBadge');
  const twoFaOffView = document.getElementById('twoFaOffView');
  const twoFaSetupView = document.getElementById('twoFaSetupView');
  const twoFaOnView = document.getElementById('twoFaOnView');
  const enable2FaBtn = document.getElementById('enable2FaBtn');
  const cancel2FaBtn = document.getElementById('cancel2FaBtn');
  const confirm2FaBtn = document.getElementById('confirm2FaBtn');
  const disable2FaBtn = document.getElementById('disable2FaBtn');
  const qrCodeImg = document.getElementById('qrCodeImg');
  const secretKeyText = document.getElementById('secretKeyText');
  const totpInput = document.getElementById('totpInput');

  // Hero Tilt Setup
  setupHeroTilt();

  // Load Profile Data
  let currentUser = null;

  async function loadProfile() {
    try {
      currentUser = await fetchCurrentUser();
      if (!currentUser) {
        // If not logged in, redirect
        window.location.href = 'index.html';
        return;
      }

      renderProfile(currentUser);
      profileLoading.style.display = 'none';
      profileContentWrap.style.display = 'flex';
    } catch (e) {
      showToast('Error loading profile. Please sign in again.');
      setTimeout(() => logout(), 1500);
    }
  }

  function renderProfile(user) {
    userEmail.textContent = user.email;
    profileAvatar.textContent = (user.email[0] || 'U').toUpperCase();
    userIdVal.textContent = `#${user.id}`;
    userAuthMethod.textContent = user.oauth_provider ? user.oauth_provider.toUpperCase() : 'Password';

    // Role Badge
    const isAdmin = user.role === 'admin';
    userRoleBadge.textContent = isAdmin ? 'Admin' : 'Member';
    userRoleBadge.className = `badge badge-role ${isAdmin ? 'badge-admin' : 'badge-member'}`;

    if (isAdmin && adminPanelLink) {
      adminPanelLink.style.display = 'inline-flex';
    } else if (adminPanelLink) {
      adminPanelLink.style.display = 'none';
    }

    // Active Status Badge
    if (user.is_active) {
      userStatusBadge.textContent = 'Active';
      userStatusBadge.className = 'badge badge-status badge-active';
    } else {
      userStatusBadge.textContent = 'Not Activated';
      userStatusBadge.className = 'badge badge-status badge-inactive';
    }

    // 2FA State
    update2FaState(user.is_totp_enabled);
  }

  function update2FaState(isEnabled) {
    if (isEnabled) {
      twoFaStatusBadge.textContent = 'Active';
      twoFaStatusBadge.className = 'badge badge-2fa badge-active';
      twoFaOffView.style.display = 'none';
      twoFaSetupView.style.display = 'none';
      twoFaOnView.style.display = 'block';
    } else {
      twoFaStatusBadge.textContent = 'Disabled';
      twoFaStatusBadge.className = 'badge badge-2fa badge-inactive';
      twoFaOffView.style.display = 'block';
      twoFaSetupView.style.display = 'none';
      twoFaOnView.style.display = 'none';
    }
  }

  // 2FA Setup Flow
  enable2FaBtn.addEventListener('click', async () => {
    enable2FaBtn.disabled = true;
    try {
      const res = await apiFetch('/api/auth/2fa/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        // Base64 QR code image or data URL
        const qrSrc = data.qr_code.startsWith('data:') ? data.qr_code : `data:image/png;base64,${data.qr_code}`;
        qrCodeImg.src = qrSrc;
        secretKeyText.textContent = data.secret || '------';

        twoFaOffView.style.display = 'none';
        twoFaSetupView.style.display = 'block';
        totpInput.value = '';
        totpInput.focus();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Could not generate 2FA QR code');
      }
    } catch (e) {
      showToast('Network error while generating 2FA');
    } finally {
      enable2FaBtn.disabled = false;
    }
  });

  cancel2FaBtn.addEventListener('click', () => {
    twoFaSetupView.style.display = 'none';
    twoFaOffView.style.display = 'block';
  });

  confirm2FaBtn.addEventListener('click', async () => {
    const code = totpInput.value.trim();
    if (!code || code.length < 6) {
      showToast('Please enter the 6-digit TOTP code.');
      return;
    }

    confirm2FaBtn.disabled = true;
    try {
      const res = await apiFetch('/api/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ totp_code: code })
      });

      if (res.ok) {
        showToast('Two-Factor Authentication successfully enabled!');
        await loadProfile();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Invalid 2FA code. Please try again.');
      }
    } catch (e) {
      showToast('Error enabling 2FA.');
    } finally {
      confirm2FaBtn.disabled = false;
    }
  });

  disable2FaBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to disable Two-Factor Authentication?')) {
      return;
    }

    disable2FaBtn.disabled = true;
    try {
      const res = await apiFetch('/api/auth/2fa/disable', { method: 'POST' });
      if (res.ok) {
        showToast('Two-Factor Authentication disabled.');
        await loadProfile();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Could not disable 2FA');
      }
    } catch (e) {
      showToast('Error disabling 2FA');
    } finally {
      disable2FaBtn.disabled = false;
    }
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    logout();
  });

  // Initial load
  await loadProfile();
});

/* ==========================================================================
   3D Mouse Tilt & Parallax Helper
   ========================================================================== */
function setupHeroTilt() {
  const heroPanel = document.getElementById('heroPanel');
  const heroBgImg = document.getElementById('heroBgImg');
  const heroShine = document.getElementById('heroShine');
  const quoteHeader = document.querySelector('.quote-header');
  const quoteBody = document.querySelector('.quote-body');

  if (!heroPanel || !window.matchMedia('(hover: hover)').matches) return;

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

  const startLoop = () => {
    if (!rafId) rafId = requestAnimationFrame(updateAnimation);
  };

  heroPanel.addEventListener('mouseenter', () => {
    isHovering = true;
    bounds = heroPanel.getBoundingClientRect();
    heroPanel.classList.add('is-tilting');
    startLoop();
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

    startLoop();
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
    startLoop();
  });
}
