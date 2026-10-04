/**
 * Celvass Resto & Bar — Customer Dine-In PWA Controller
 * Pure Tetun Interface & Device-Locked Session Security
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
    // Also store in cookie for seamless server-side verification
    document.cookie = `celvass_device_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
    return id;
  }

  init() {
    this.renderCartUI();
    this.initWebSocket();
    this.loadActiveOrders();

    // Category Filter
    document.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach((b) => b.classList.remove('active', 'btn-primary'));
        document.querySelectorAll('.cat-pill').forEach((b) => b.classList.add('btn-outline-secondary'));
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-outline-secondary');

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
    showToast(`Aumenta ba karreta: ${item.name}`, 'success');
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

    if (bar && count > 0) {
      bar.style.display = 'flex';
      if (badge) badge.textContent = `${count} Item`;
      if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    } else if (bar) {
      bar.style.display = 'none';
    }

    const drawerList = document.getElementById('cart-items-list');
    const drawerTotal = document.getElementById('cart-drawer-total');
    if (drawerTotal) drawerTotal.textContent = `$${total.toFixed(2)}`;

    if (drawerList) {
      if (this.cart.length === 0) {
        drawerList.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="fa-solid fa-basket-shopping fa-2x mb-2 text-secondary"></i>
            <p class="mb-0">Ita-boot nia karreta mamuk hela.</p>
          </div>
        `;
      } else {
        drawerList.innerHTML = this.cart
          .map(
            (item, index) => `
          <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-light">
            <div>
              <div class="fw-bold">${item.name}</div>
              <div class="text-primary fw-semibold">$${(item.price * item.quantity).toFixed(2)} <span class="text-muted small">($${item.price.toFixed(2)}/item)</span></div>
              ${item.note ? `<div class="small text-muted fst-italic"><i class="fa-solid fa-pen small"></i> ${item.note}</div>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-sm btn-outline-secondary px-2" onclick="customerApp.updateQuantity(${index}, -1)">-</button>
              <span class="fw-bold">${item.quantity}</span>
              <button class="btn btn-sm btn-outline-secondary px-2" onclick="customerApp.updateQuantity(${index}, 1)">+</button>
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
      showToast('Ita-boot nia karreta mamuk hela!', 'warning');
      return;
    }
    if (!this.sessionToken) {
      showToast('Sesi meza seidauk loke hosi kaixa.', 'error');
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
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Haruka hela pedidu...';
    }

    try {
      const order = await apiPost(`/api/v1/public/sessions/${this.sessionToken}/orders/`, payload, {
        'Idempotency-Key': idempotencyKey,
        'X-Device-Token': this.deviceId,
      });

      this.clearCart();
      const cartModal = bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas'));
      if (cartModal) cartModal.hide();

      showToast(`Pedidu ${order.order_code} haruka ona! Hein konfirmasaun kaixa.`, 'success');
      SoundEffects.playSuccess();

      this.loadActiveOrders();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> Haruka Pedidu ba Kaixa';
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
      console.log('No active orders or session not open');
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

    // If button already shows "Konta Husu Tiha Ona" or "Selu Tiha Ona", preserve it
    if (btn.textContent.includes('Konta Husu') || btn.textContent.includes('Selu Tiha')) {
      return;
    }

    if (!hasServedOrder) {
      btn.dataset.eligible = 'false';
      btn.title = "Presiza iha pelumenus pedidu 1 ne'ebé entrega ona (SERVED)";
    } else if (hasCookingOrder) {
      btn.dataset.eligible = 'cooking';
      btn.title = "Sei iha hahan ne'ebé tein hela iha dapur";
    } else {
      btn.dataset.eligible = 'true';
      btn.title = "Husu Konta (Bill)";
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
      <div class="card card-custom p-3 mb-3 border-primary shadow-sm">
        <h6 class="fw-bold mb-2 text-primary d-flex align-items-center justify-content-between">
          <span><i class="fa-solid fa-clock-rotate-left me-1"></i> Status Ita-boot nia Pedidu</span>
          <span class="badge bg-primary">${this.activeOrders.length} Pedidu</span>
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
              WAITING_CASHIER_CONFIRMATION: '⏳ Hein Verifikasaun Kaixa',
              CONFIRMED: '✅ Kaixa Konfirma Ona',
              PREPARING: '🍳 Dapur Hahu Tein',
              READY: '🔔 Hahan Prontu Ona',
              SERVED: '🍽️ Entrega ba Meza Ona',
              COMPLETED: '🏁 Remata Ona',
              REJECTED: `❌ Kaixa Rekuza: ${ord.rejection_reason || ''}`,
            }[ord.status] || ord.status;

            return `
            <div class="p-2 border rounded mb-2 bg-light">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold">${ord.order_code}</span>
                <span class="badge badge-status ${statusClass}">${statusText}</span>
              </div>
              <div class="small text-muted mb-1">
                ${ord.items.map((i) => `${i.quantity}x ${i.menu_name_snapshot}`).join(', ')}
              </div>
              <div class="d-flex justify-content-between small fw-bold">
                <span>Total: $${ord.grand_total}</span>
                <a href="/t/${this.qrToken}/order/${ord.order_code}/" class="text-primary text-decoration-none">Haree Detalle & Rastreia →</a>
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

    // Check client eligibility before sending
    const hasServedOrder = this.activeOrders.some((o) => o.status === 'SERVED');
    if (!hasServedOrder) {
      showToast("Ita-boot seidauk bele husu konta tanba seidauk iha pedidu ne'ebé entrega tiha ona ba meza (SERVED).", 'warning');
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
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Haruka Hela...';
    }

    try {
      const res = await apiPost(
        `/api/v1/public/sessions/${this.sessionToken}/request-bill/`,
        {},
        { 'X-Device-Token': this.deviceId }
      );
      const msg = res.message || 'Husu konta haruka ona ba kaixa.';
      showToast(msg, 'info');
      SoundEffects.playBell();
      if (btn) {
        btn.disabled = true;
        btn.className = 'btn btn-sm btn-secondary text-white fw-bold rounded-pill px-3 shadow-sm';
        btn.innerHTML = '<i class="fa-solid fa-clock me-1"></i> Konta Husu Tiha Ona';
      }
    } catch (e) {
      showToast(e.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-receipt me-1"></i> Husu Konta';
      }
    }
  }

  initWebSocket() {
    if (!this.sessionToken) return;

    this.ws = new WebSocketClient(`/ws/customer/${this.sessionToken}/`, (msg) => {
      console.log('Customer WS update:', msg);
      if (msg.event === 'ORDER_CONFIRMED') {
        showToast(`Kaixa konfirma ona pedidu ${msg.data.order_code}!`, 'success');
        SoundEffects.playSuccess();
        this.loadActiveOrders();
      } else if (msg.event === 'ORDER_REJECTED') {
        showToast(`Kaixa rekuza pedidu ${msg.data.order_code}: ${msg.data.reason}`, 'error');
        this.loadActiveOrders();
      } else if (msg.event === 'ORDER_PREPARING' || msg.event === 'ORDER_READY' || msg.event === 'ORDER_SERVED') {
        showToast(`Status pedidu ${msg.data.order_code}: ${msg.event}`, 'info');
        this.loadActiveOrders();
      } else if (msg.event === 'SESSION_CLOSED') {
        showToast('Sesi meza taka ona hosi kaixa. Obrigadu barak!', 'info');
        setTimeout(() => window.location.reload(), 2000);
      }
    });

    // Fallback polling every 8 seconds
    setInterval(() => this.loadActiveOrders(), 8000);
  }
}
