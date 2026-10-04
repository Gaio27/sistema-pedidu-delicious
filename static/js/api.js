/**
 * Central API Client with CSRF, error normalization, and toast notifications.
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

  const bgClass = {
    success: 'bg-success text-white',
    error: 'bg-danger text-white',
    warning: 'bg-warning text-dark',
    info: 'bg-primary text-white',
  }[type] || 'bg-dark text-white';

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center ${bgClass} border-0 show mb-2 shadow-lg`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-bold">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.remove(), 300);
  }, 4000);
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
      const errMsg = data?.error?.message || 'Permintaan gagal diproses.';
      throw new Error(errMsg);
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
