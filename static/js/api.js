/**
 * Central API Client with CSRF, error normalization, dynamic i18n translation,
 * and dark glassmorphic toast notifications.
 */

function getCsrfToken() {
  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrftoken='))
    ?.split('=')[1];
  return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const styleConfig = {
    success: {
      border: 'rgba(16, 185, 129, 0.4)',
      bg: 'linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(15, 23, 42, 0.95))',
      color: '#a7f3d0',
      icon: 'fa-circle-check text-success'
    },
    error: {
      border: 'rgba(239, 68, 68, 0.4)',
      bg: 'linear-gradient(135deg, rgba(127, 29, 29, 0.95), rgba(15, 23, 42, 0.95))',
      color: '#fecaca',
      icon: 'fa-circle-exclamation text-danger'
    },
    warning: {
      border: 'rgba(245, 158, 11, 0.4)',
      bg: 'linear-gradient(135deg, rgba(120, 53, 15, 0.95), rgba(15, 23, 42, 0.95))',
      color: '#fef3c7',
      icon: 'fa-triangle-exclamation text-warning'
    },
    info: {
      border: 'rgba(14, 165, 233, 0.4)',
      bg: 'linear-gradient(135deg, rgba(12, 74, 110, 0.95), rgba(15, 23, 42, 0.95))',
      color: '#bae6fd',
      icon: 'fa-circle-info text-info'
    },
  }[type] || {
    border: 'rgba(255, 255, 255, 0.15)',
    bg: 'rgba(15, 23, 42, 0.95)',
    color: '#ffffff',
    icon: 'fa-bell text-warning'
  };

  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center border-0 show mb-2';
  toastEl.style.cssText = `
    background: ${styleConfig.bg} !important;
    border: 1px solid ${styleConfig.border} !important;
    border-radius: 16px !important;
    backdrop-filter: blur(20px) !important;
    -webkit-backdrop-filter: blur(20px) !important;
    box-shadow: 0 16px 36px rgba(0,0,0,0.5) !important;
    color: ${styleConfig.color} !important;
  `;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex align-items-center p-2 px-3">
      <i class="fa-solid ${styleConfig.icon} me-2 fs-5"></i>
      <div class="toast-body fw-semibold py-1 pe-2" style="font-family: 'Outfit', sans-serif;">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="toast" aria-label="Taka"></button>
    </div>
  `;

  container.appendChild(toastEl);
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.remove(), 350);
  }, 4200);
}

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCsrfToken(),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
      const code = data?.error?.code;
      // If translation key exists for this error code, use it
      let localizedMsg = (typeof t === 'function' && code && t(code)) ? t(code) : null;
      if (!localizedMsg) {
        localizedMsg = data?.error?.message || (typeof t === 'function' ? t('error_request_failed') : 'Pedidu falla atu prosesa.');
      }
      throw new Error(localizedMsg);
    }
    return data.data !== undefined ? data.data : data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

async function apiGet(endpoint) {
  return apiRequest(endpoint, { method: 'GET' });
}

async function apiPost(endpoint, body = {}, headers = {}) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}
