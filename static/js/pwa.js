/**
 * Celvass Resto & Bar PWA Installation & Service Worker Controller
 */

let deferredPrompt = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('✅ Celvass PWA: Service Worker registered. Scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('⚠️ Celvass PWA: Service Worker registration failed:', err);
      });
  });
}

// Capture BeforeInstallPrompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('📱 Celvass PWA: beforeinstallprompt captured!');
  showPwaInstallUI();
});

// Proactively check and display install UI after load if not in standalone mode
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (!isStandalone) {
      showPwaInstallUI();
    }
  }, 1200);
});

// App installed event
window.addEventListener('appinstalled', () => {
  console.log('🎉 Celvass PWA was installed successfully!');
  deferredPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  if (window.showToast) {
    showToast('Aplikasaun Celvass PWA instala ona iha ita-boot nia smartphone!', 'success');
  }
});

function showPwaInstallUI() {
  const dismissedTime = localStorage.getItem('celvass_pwa_dismissed');
  if (dismissedTime && (Date.now() - parseInt(dismissedTime, 10)) < 3600000 * 12) {
    // Dismissed within last 12 hours, keep banner hidden but navbar button visible
    return;
  }
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.display = 'block';
  }
}

function dismissPwaBanner() {
  localStorage.setItem('celvass_pwa_dismissed', Date.now().toString());
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted PWA installation prompt');
      } else {
        console.log('User dismissed PWA installation prompt');
      }
      deferredPrompt = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
    });
  } else {
    // If native prompt is not available, show guide modal (iOS Safari / Android guide)
    showPwaGuideModal();
  }
}

function showPwaGuideModal() {
  let modalEl = document.getElementById('pwaGuideModal');
  if (!modalEl) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const modalHtml = `
      <div class="modal fade" id="pwaGuideModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
            <div class="modal-header bg-dark text-white border-0 py-3">
              <div class="d-flex align-items-center gap-2">
                <i class="fa-solid fa-mobile-screen-button text-warning fs-5"></i>
                <h5 class="modal-title fw-bold">Instala Celvass PWA</h5>
              </div>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 text-center">
              <img src="/static/icons/icon-192.png" width="72" height="72" class="rounded-3 shadow-sm mb-3" alt="Celvass App">
              <h6 class="fw-bold mb-2">Asesu Lais & Menus Offline</h6>
              <p class="text-muted small mb-4">Aplikasaun ne'e bele instala direta iha ita-boot nia smartphone sem presiza Play Store ka App Store.</p>
              
              <div class="text-start bg-light rounded-3 p-3 mb-3 border">
                ${isIOS ? `
                  <div class="fw-bold small text-primary mb-2"><i class="fa-brands fa-apple me-1"></i> Dalan ba iPhone / iPad (Safari):</div>
                  <ol class="small text-secondary mb-0 ps-3">
                    <li class="mb-1">Klike butaun <strong>Fahe (Share)</strong> <i class="fa-solid fa-arrow-up-from-bracket text-primary"></i> iha kraik Safari.</li>
                    <li>Scroll ba kraik no hili <strong>"Add to Home Screen"</strong> (Aumenta ba Ekrã Prinsipál).</li>
                  </ol>
                ` : `
                  <div class="fw-bold small text-primary mb-2"><i class="fa-brands fa-android me-1"></i> Dalan ba Android (Chrome) / Laptop:</div>
                  <ol class="small text-secondary mb-0 ps-3">
                    <li class="mb-1">Klike menu pontu tolu <strong>[⋮]</strong> iha leten liman loos browser.</li>
                    <li>Hili <strong>"Install app"</strong> ka <strong>"Tambahkan ke Layar Utama"</strong>.</li>
                  </ol>
                `}
              </div>
              <button type="button" class="btn btn-primary w-100 py-2 rounded-pill fw-bold" data-bs-dismiss="modal">Entende Ona</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modalEl = document.getElementById('pwaGuideModal');
  }
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// Expose globally
window.installPWA = installPWA;
window.dismissPwaBanner = dismissPwaBanner;
