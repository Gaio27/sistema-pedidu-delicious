/**
 * Customer Dine-In PWA Controller
 */

class CustomerApp {
  constructor(config) {
    this.sessionToken = config.sessionToken;
    this.qrToken = config.qrToken;
    this.tableCode = config.tableCode;
    this.storageKey = `resto_cart_${this.sessionToken || 'default'}`;
    this.cart = this.loadCart();
    this.selectedItem = null;
    this.activeOrders = [];

    this.init();
  }

  init() {
    this.renderCartUI();
    this.initWebSocket();
    this.loadActiveOrders();

    // Category Filter
    document.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
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
        drawerList.innerHTML = '<div class="text-center py-4 text-muted"><i class="fa-solid fa-basket-shopping fa-2x mb-2"></i><p>Keranjang Anda masih kosong.</p></div>';
      } else {
        drawerList.innerHTML = this.cart
          .map(
            (item, index) => `
          <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
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
      showToast(t('cart_empty_toast'), 'warning');
      return;
    }
    if (!this.sessionToken) {
      showToast(t('session_not_open_toast'), 'error');
      return;
    }

    const customerNote = document.getElementById('order-customer-note')?.value || '';
    const idempotencyKey = crypto.randomUUID();

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
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Mengirim Pesanan...';
    }

    try {
      const order = await apiPost(`/api/v1/public/sessions/${this.sessionToken}/orders/`, payload, {
        'Idempotency-Key': idempotencyKey,
      });

      this.clearCart();
      const cartModal = bootstrap.Modal.getInstance(document.getElementById('cartOffcanvas'));
      if (cartModal) cartModal.hide();

      showToast(`${t('order_sent_toast')} ${order.order_code}! ${t('waiting_cashier_toast')}`, 'success');
      SoundEffects.playSuccess();

      this.loadActiveOrders();
    } catch (err) {
      showToast(t(err.message), 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> Kirim Pesanan ke Kasir';
      }
    }
  }

  async loadActiveOrders() {
    if (!this.sessionToken) return;

    try {
      const orders = await apiGet(`/api/v1/public/sessions/${this.sessionToken}/orders/list/`);
      this.activeOrders = orders;
      this.renderOrdersUI();
    } catch (e) {
      console.log('No active orders or session not open');
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
          <span><i class="fa-solid fa-clock-rotate-left me-1"></i> Status Pesanan Anda</span>
          <span class="badge bg-primary">${this.activeOrders.length} Pesanan</span>
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
              WAITING_CASHIER_CONFIRMATION: '⏳ Menunggu Verifikasi Kasir',
              CONFIRMED: '✅ Dikonfirmasi Kasir',
              PREPARING: '🍳 Sedang Dimasak',
              READY: '🔔 Makanan Siap Disajikan',
              SERVED: '🍽️ Sudah Disajikan',
              COMPLETED: '🏁 Selesai',
              REJECTED: `❌ Ditolak: ${ord.rejection_reason || ''}`,
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
                <a href="/t/${this.qrToken}/order/${ord.order_code}/" class="text-primary text-decoration-none">Lihat Detail & Tracking →</a>
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

    const btn = document.getElementById('btn-request-bill');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Haruka Hela...';
    }

    try {
      const res = await apiPost(`/api/v1/public/sessions/${this.sessionToken}/request-bill/`);
      const msg = res.message || t('bill_sent_toast');
      showToast(msg, 'info');
      SoundEffects.playBell();
      if (btn) {
        btn.disabled = true;
        btn.className = 'btn btn-sm btn-secondary text-white fw-bold rounded-pill px-3 shadow-sm';
        btn.innerHTML = '<i class="fa-solid fa-clock me-1"></i> Konta Husu Tiha Ona';
      }
    } catch (e) {
      showToast(t(e.message), 'error');
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
        showToast(`${t('order_confirmed_toast')} ${msg.data.order_code}!`, 'success');
        SoundEffects.playSuccess();
        this.loadActiveOrders();
      } else if (msg.event === 'ORDER_REJECTED') {
        showToast(`${t('order_rejected_toast')} ${msg.data.order_code}: ${msg.data.reason}`, 'error');
        this.loadActiveOrders();
      } else if (msg.event === 'ORDER_PREPARING' || msg.event === 'ORDER_READY' || msg.event === 'ORDER_SERVED') {
        showToast(`${t('order_status_toast')} ${msg.data.order_code}: ${msg.event}`, 'info');
        this.loadActiveOrders();
      } else if (msg.event === 'SESSION_CLOSED') {
        showToast(t('session_closed_toast'), 'info');
        setTimeout(() => window.location.reload(), 2000);
      }
    });

    // Fallback polling every 8 seconds
    setInterval(() => this.loadActiveOrders(), 8000);
  }
}
