/**
 * Shared API & Auth Utilities
 * Handles token storage, Bearer headers, 401 interception, and unified API fetching.
 */

const API_BASE = ''; // Same-origin when served by FastAPI or configured backend

export const TOKEN_KEY = 'cogie_auth_token';
export const USER_KEY = 'cogie_user_data';

// Token Management
export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = 'index.html';
}

/**
 * Unified API Fetch Wrapper with automatic Authorization header & 401 redirect
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);

    // 401 Unauthorized handling
    if (response.status === 401) {
      // If we are already on login or register, don't loop redirect
      const isAuthPage = window.location.pathname.endsWith('index.html') ||
                         window.location.pathname.endsWith('register.html') ||
                         window.location.pathname.endsWith('forgot-password.html') ||
                         window.location.pathname.endsWith('reset-password.html') ||
                         window.location.pathname.endsWith('activate.html') ||
                         window.location.pathname === '/';

      if (!isAuthPage) {
        setAccessToken(null);
        setStoredUser(null);
        window.location.href = 'index.html?unauthorized=1';
        return response;
      }
    }

    return response;
  } catch (error) {
    console.error('API Fetch Error:', error);
    throw error;
  }
}

/**
 * Get current authenticated user profile
 */
export async function fetchCurrentUser() {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const res = await apiFetch('/api/users/me');
    if (res.ok) {
      const user = await res.json();
      setStoredUser(user);
      return user;
    }
  } catch (e) {
    console.warn('Could not fetch user profile:', e);
  }
  return null;
}

/**
 * Global Toast Notification Helper
 */
let toastTimer = null;
export function showToast(message, duration = 3500) {
  let toastEl = document.getElementById('toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

/**
 * Parse URL Query Parameters helper
 */
export function getQueryParams() {
  return new URLSearchParams(window.location.search);
}
