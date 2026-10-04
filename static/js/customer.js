/**
 * Celvass Resto & Bar — Customer Dine-In PWA Controller
 * Pure Tetun Base Interface & Dynamic Multilingual System
 * Luxury Dark Glassmorphism & Device-Locked Table Security
 */

class CustomerApp {
  constructor(config) {
    this.sessionToken = config.sessionToken;
    this.qrToken = config.qrToken;
    this.tableCode = config.tableCode;
    this.deviceId = this.getOrCreateDeviceId();
    this.storageKey = `resto_cart_${this.sessionToken || 'default'}`;
    this.cart = this.loadCart();
    this.selectedItem = null;
    this.activeOrders = [];

    this.init();
  }

  getOrCreateDeviceId() {
    let id = localStorage.getItem('celvass_device_id');
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36));
      localStorage.setItem('celvass_device_id', id);
    }
    // Also store in cookie for server-side verification
    document.cookie = `celvass_device_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
    return id;
  }

  init() {
    this.renderCartUI();
    this.initWebSocket();
    this.loadActiveOrders();

    // Listen for language switch
    window.addEventListener('languageChanged', () => {
      this.renderCartUI();
      this.renderOrdersUI();
      this.checkBillButtonEligibility();
    });

    // Category Filter
    document.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const cat = btn.dataset.category;
        document.querySelectorAll('.menu-item-col').forEach((card) => {
          if (cat === 'all' || card.dataset.category === cat) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // Search bar
    const searchInput = document.getElementById('menu-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.menu-item-col').forEach((card) => {
          const name = (card.dataset.name || '').toLowerCase();
          const desc = (card.dataset.desc || '').toLowerCase();
          if (name.includes(q) || desc.includes(q)) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    }
  }

  loadCart() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveCart() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
    this.renderCartUI();
  }

  addToCart(item, quantity = 1, note = '') {
    const existing = this.cart.find((i) => i.id === item.id && i.note === note);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.cart.push({
        id: item.id,
        name: item.name,
        price: parseFloat(item.price),
        image: item.image,
        quantity: quantity,
        note: note,
      });
    }
    this.saveCart();
    showToast(`${t('added_to_cart')} ${item.name}`, 'success');
  }

  updateQuantity(index, delta) {
    if (this.cart[index]) {
      this.cart[index].quantity += delta;
      if (this.cart[index].quantity <= 0) {
        this.cart.splice(index, 1);
      }
      this.saveCart();
    }
  }

  clearCart() {
    this.cart = [];
    this.saveCart();
  }

  getCartTotal() {
    return this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  getCartCount() {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  renderCartUI() {
    const count = this.getCartCount();
    const total = this.getCartTotal();

    const bar = document.getElementById('floating-cart-bar');
    const badge = document.getElementById('cart-count-badge');
    const totalEl = document.getElementById('cart-total-price');
    const dockBadge = document.getElementById('dock-cart-badge');

    if (bar && count > 0) {
      bar.style.display = 'flex';
      if (badge) badge.textContent = `${count} ${count > 1 ? 'Itens' : 'Item'}`;
      if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    } else if (bar) {
      bar.style.display = 'none';
    }

    if (dockBadge) {
      if (count > 0) {
        dockBadge.textContent = count;
        dockBadge.style.display = 'block';
      } else {
        dockBadge.style.display = 'none';
      }
    }

    const drawerList = document.getElementById('cart-items-list');
    const drawerTotal = document.getElementById('cart-drawer-total');
    if (drawerTotal) drawerTotal.textContent = `$${total.toFixed(2)}`;

    if (drawerList) {
      if (this.cart.length === 0) {
        drawerList.innerHTML = `
          <div class="text-center py-5 text-white-50">
            <i class="fa-solid fa-basket-shopping fa-3x mb-3 text-warning opacity-50"></i>
            <p class="mb-0 fw-semibold">${t('cart_empty')}</p>
          </div>
        `;
      } else {
        drawerList.innerHTML = this.cart
          .map(
            (item, index) => `
          <div class="d-flex align-items-center justify-content-between py-3 border-bottom border-secondary border-opacity-25">
            <div class="pe-2">
              <div class="fw-bold text-white fs-6">${item.name}</div>
              <div class="text-warning fw-bold fs-6">
                $${(item.price * item.quantity).toFixed(2)} 
                <span class="text-white-50 small fw-normal">($${item.price.toFixed(2)}/item)</span>
              </div>
              ${item.note ? `<div class="small text-warning bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-pill px-2 py-0 d-inline-block mt-1"><i class="fa-solid fa-pen small me-1"></i>${item.note}</div>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center" style="width:34px; height:34px;" onclick="customerApp.updateQuantity(${index}, -1)">
                <i class="fa-solid fa-minus small"></i>
              </button>
              <span class="fw-bold text-white fs-5 px-1">${item.quantity}</span>
              <button class="btn btn-sm btn-outline-warning rounded-circle d-flex align-items-center justify-content-center" style="width:34px; height:34px;" onclick="customerApp.updateQuantity(${index}, 1)">
                <i class="fa-solid fa-plus small"></i>
              </button>
            </div>
          </div>
        `
          )
          .join('');
      }
    }
  }

  async submitOrder() {
    if (this.cart.length === 0) {
      showToast(t('cart_empty_toast'), 'warning');
      return;
    }
    if (!this.sessionToken) {
      showToast(t('session_not_open_toast'), 'error');
      return;
    }

    const customerNote = document.getElementById('order-customer-note')?.value || '';
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('ord_' + Date.now());

    const payload = {
      items: this.cart.map((item) => ({
        menu_item_id: item.id,
        quantity: item.quantity,
        note: item.note,
      })),
      customer_note: customerNote,
    };

    const submitBtn = document.getElementById('btn-submit-order');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> ...';
    }

    try {
      const order = await apiPost(`/api/v1/public/sessions/${this.sessionToken}/orders/`, payload, {
        'Idempotency-Key': idempotencyKey,
        'X-Device-Token': this.deviceId,
      });

      this.clearCart();
      const cartModal = bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas'));
      if (cartModal) cartModal.hide();

      showToast(`${t('order_sent_toast')} ${order.order_code}. ${t('waiting_cashier_toast')}`, 'success');
      SoundEffects.playSuccess();

      this.loadActiveOrders();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane me-1"></i> ${t('btn_submit_order')}`;
      }
    }
  }

  async loadActiveOrders() {
    if (!this.sessionToken) return;

    try {
      const orders = await apiGet(`/api/v1/public/sessions/${this.sessionToken}/orders/list/`, {
        'X-Device-Token': this.deviceId,
      });
      this.activeOrders = orders || [];
      this.renderOrdersUI();
      this.checkBillButtonEligibility();
    } catch (e) {
      // Session closed or inactive
    }
  }

  checkBillButtonEligibility() {
    const btn = document.getElementById('btn-request-bill');
    if (!btn) return;

    // Check if at least one order is SERVED
    const hasServedOrder = this.activeOrders.some((o) => o.status === 'SERVED');
    const hasCookingOrder = this.activeOrders.some((o) =>
      ['WAITING_CASHIER_CONFIRMATION', 'CONFIRMED', 'PREPARING'].includes(o.status)
    );

    // If button already shows requested or paid, preserve
    if (btn.dataset.status === 'BILL_REQUESTED' || btn.dataset.status === 'PAID') {
      return;
    }

    if (!hasServedOrder) {
      btn.dataset.eligible = 'false';
    } else if (hasCookingOrder) {
      btn.dataset.eligible = 'cooking';
    } else {
      btn.dataset.eligible = 'true';
    }
  }

  renderOrdersUI() {
    const listEl = document.getElementById('customer-active-orders');
    if (!listEl) return;

    if (this.activeOrders.length === 0) {
      listEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = `
      <div class="glass-card p-3 mb-3 border-warning border-opacity-40 shadow-lg">
        <h6 class="fw-bold mb-3 text-warning d-flex align-items-center justify-content-between" style="font-family: 'Outfit', sans-serif;">
          <span><i class="fa-solid fa-clock-rotate-left me-2"></i> ${t('order_status_title')}</span>
          <span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25 rounded-pill px-2 py-1">${this.activeOrders.length} ${t('total_orders')}</span>
        </h6>
        ${this.activeOrders
          .map((ord) => {
            const statusClass = {
              WAITING_CASHIER_CONFIRMATION: 'status-waiting',
              CONFIRMED: 'status-confirmed',
              PREPARING: 'status-preparing',
              READY: 'status-ready',
              SERVED: 'status-served',
              COMPLETED: 'status-completed',
              REJECTED: 'status-rejected',
            }[ord.status] || 'bg-secondary text-white';

            const statusText = {
              WAITING_CASHIER_CONFIRMATION: t('status_waiting'),
              CONFIRMED: t('status_confirmed'),
              PREPARING: t('status_preparing'),
              READY: t('status_ready'),
              SERVED: t('status_served'),
              COMPLETED: t('status_completed'),
              REJECTED: `${t('status_rejected')}: ${ord.rejection_reason || ''}`,
            }[ord.status] || ord.status;

            return `
            <div class="p-3 border border-secondary border-opacity-25 rounded-3 mb-2 bg-dark bg-opacity-40">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-white fs-6">${ord.order_code}</span>
                <span class="badge badge-status ${statusClass}">${statusText}</span>
              </div>
              <div class="small text-white-50 mb-2">
                ${ord.items.map((i) => `<span class="text-white">${i.quantity}x</span> ${i.menu_name_snapshot}`).join(', ')}
              </div>
              <div class="d-flex justify-content-between align-items-center small fw-bold pt-2 border-top border-secondary border-opacity-25">
                <span class="text-warning fs-6">$${ord.grand_total}</span>
                <a href="/t/${this.qrToken}/order/${ord.order_code}/" class="btn btn-sm btn-outline-warning rounded-pill px-3 py-1">
                  ${t('btn_view_order')}
                </a>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;
  }

  async requestBill() {
    if (!this.sessionToken) return;

    const hasServedOrder = this.activeOrders.some((o) => o.status === 'SERVED');
    if (!hasServedOrder) {
      showToast(t('alert_waiting_desc') || "Presiza iha pelumenus pedidu 1 ne'ebé entrega tiha ona ba meza (SERVED).", 'warning');
      return;
    }

    const hasCookingOrder = this.activeOrders.some((o) =>
      ['WAITING_CASHIER_CONFIRMATION', 'CONFIRMED', 'PREPARING'].includes(o.status)
    );
    if (hasCookingOrder) {
      showToast("Sei iha hahan ne'ebé tein hela iha dapur. Favór hein to'o hahan hotu to'o meza molok husu konta.", 'warning');
      return;
    }

    const btn = document.getElementById('btn-request-bill');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> ...';
    }

    try {
      const res = await apiPost(
        `/api/v1/public/sessions/${this.sessionToken}/request-bill/`,
        {},
        { 'X-Device-Token': this.deviceId }
      );
      const msg = res.message || t('bill_sent_toast');
      showToast(msg, 'info');
      SoundEffects.playBell();
      if (btn) {
        btn.disabled = true;
        btn.dataset.status = 'BILL_REQUESTED';
        btn.className = 'btn btn-sm btn-secondary text-white fw-bold rounded-pill px-3 shadow-sm';
        btn.innerHTML = `<i class="fa-solid fa-clock me-1"></i> ${t('bill_requested')}`;
      }
    } catch (e) {
      showToast(e.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-receipt me-1"></i> ${t('request_bill')}`;
      }
    }
  }

  initWebSocket() {
    if (!this.sessionToken) return;

    this.ws = new WebSocketClient(`/ws/customer/${this.sessionToken}/`, (msg) => {
      if (msg.event === 'ORDER_CONFIRMED') {
        showToast(`${t('order_confirmed_toast')} ${msg.data.order_code}!`, 'success');
        SoundEffects.playSuccess();
        this.loadActiveOrders();
      } else if (msg.event === 'ORDER_REJECTED') {
        showToast(`${t('order_rejected_toast')} ${msg.data.order_code}: ${msg.data.reason}`, 'error');
        this.loadActiveOrders();
      } else if (msg.event === 'ORDER_PREPARING' || msg.event === 'ORDER_READY' || msg.event === 'ORDER_SERVED') {
        showToast(`${t('order_status_toast')} ${msg.data.order_code}`, 'info');
        this.loadActiveOrders();
      } else if (msg.event === 'SESSION_CLOSED') {
        showToast(t('session_closed_toast'), 'info');
        setTimeout(() => window.location.reload(), 2000);
      }
    });

    // Fallback polling every 8 seconds
    setInterval(() => this.loadActiveOrders(), 8000);
  }

  scrollToActiveOrders() {
    const el = document.getElementById('customer-active-orders');
    if (el && el.children.length > 0) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      showToast(t('alert_waiting_desc') || "Seidauk iha pedidu ativu ba sesi meza ne'e.", 'info');
    }
  }
}
