/**
 * Cashier Command Center & POS Controller
 */

class CashierApp {
  constructor() {
    this.pendingOrders = [];
    this.tables = [];
    this.selectedTable = null;
    this.selectedOrderForReject = null;
    this.init();
  }

  init() {
    this.loadPendingOrders();
    this.loadTables();
    this.initWebSocket();

    // Polling fallback every 6 seconds
    setInterval(() => {
      this.loadPendingOrders();
      this.loadTables();
    }, 6000);
  }

  async loadPendingOrders() {
    try {
      this.pendingOrders = await apiGet('/api/v1/cashier/orders/');
      this.renderPendingOrdersUI();
    } catch (e) {
      console.error('Error loading pending orders:', e);
    }
  }

  async loadTables() {
    try {
      this.tables = await apiGet('/api/v1/cashier/tables/');
      this.renderTablesUI();
    } catch (e) {
      console.error('Error loading tables:', e);
    }
  }

  renderPendingOrdersUI() {
    const container = document.getElementById('pending-orders-container');
    const countBadge = document.getElementById('pending-count-badge');
    if (countBadge) countBadge.textContent = this.pendingOrders.length;

    if (!container) return;

    if (this.pendingOrders.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="fa-solid fa-circle-check fa-3x text-success mb-2"></i>
          <h6>Semua pesanan telah diverifikasi.</h6>
          <p class="small">Pesanan baru dari pelanggan akan muncul di sini secara real-time.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.pendingOrders
      .map(
        (order) => `
      <div class="card card-custom p-3 mb-3 border-start border-4 border-warning shadow-sm">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <span class="badge bg-dark me-1">${order.table_name || order.table_code}</span>
            <span class="fw-bold">${order.order_code}</span>
            <span class="text-muted small ms-2"><i class="fa-regular fa-clock"></i> ${new Date(order.submitted_at).toLocaleTimeString()}</span>
          </div>
          <span class="badge badge-status status-waiting">Verifikasi Kasir</span>
        </div>

        <div class="border rounded p-2 bg-light mb-2">
          <ul class="list-unstyled mb-0 small">
            ${order.items
              .map(
                (item) => `
              <li class="d-flex justify-content-between py-1 border-bottom border-light">
                <span><strong>${item.quantity}x</strong> ${item.menu_name_snapshot} ${item.note ? `<span class="badge bg-warning text-dark ms-1"><i class="fa-solid fa-pen"></i> ${item.note}</span>` : ''}</span>
                <span class="fw-semibold">$${item.subtotal}</span>
              </li>
            `
              )
              .join('')}
          </ul>
          ${order.customer_note ? `<div class="mt-2 p-1 bg-white rounded small text-danger"><strong>Catatan Pelanggan:</strong> ${order.customer_note}</div>` : ''}
        </div>

        <div class="d-flex justify-content-between align-items-center">
          <div class="fw-bold fs-5 text-primary">Total: $${order.grand_total}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-danger" onclick="cashierApp.promptReject('${order.id}', '${order.order_code}')">
              <i class="fa-solid fa-xmark me-1"></i> Tolak
            </button>
            <button class="btn btn-sm btn-success px-3 fw-bold" onclick="cashierApp.confirmOrder('${order.id}')">
              <i class="fa-solid fa-check me-1"></i> Konfirmasi & Kirim Dapur
            </button>
          </div>
        </div>
      </div>
    `
      )
      .join('');
  }

  renderTablesUI() {
    const container = document.getElementById('tables-grid-container');
    if (!container) return;

    container.innerHTML = this.tables
      .map((table) => {
        const session = table.active_session;
        const isOccupied = session !== null;
        const statusClass = {
          AVAILABLE: 'status-available',
          OCCUPIED: 'status-occupied',
          CLEANING: 'status-cleaning',
          MAINTENANCE: 'status-maintenance',
        }[table.status] || 'bg-secondary text-white';

        return `
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="card card-custom p-3 h-100 ${isOccupied ? 'border-primary' : ''}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="fw-bold mb-0">${table.display_name}</h5>
              <span class="badge badge-status ${statusClass}">${table.status}</span>
            </div>
            
            <div class="text-muted small mb-3">
              Kapasitas: ${table.capacity || 4} Kursi | Kode: ${table.table_code}
            </div>

            ${
              isOccupied
                ? `
              <div class="p-2 bg-light rounded small mb-3">
                <div class="d-flex justify-content-between">
                  <span>Tamu: <strong>${session.guest_count} Orang</strong></span>
                  <span class="badge ${session.status === 'BILL_REQUESTED' ? 'bg-danger text-white' : 'bg-info text-dark'}">${session.status}</span>
                </div>
                <div class="d-flex justify-content-between mt-1">
                  <span>Pesanan: ${session.orders_count}</span>
                  <span class="fw-bold text-primary">Bill: $${session.bill_total}</span>
                </div>
              </div>
              <div class="d-flex gap-2 mt-auto">
                <button class="btn btn-sm btn-primary flex-fill fw-bold" onclick="cashierApp.openPaymentModal('${session.id}', '${table.display_name}', '${session.bill_total}')">
                  <i class="fa-solid fa-cash-register me-1"></i> Pembayaran / POS
                </button>
                <button class="btn btn-sm btn-outline-secondary" title="Tutup Meja" onclick="cashierApp.closeSession('${session.id}', '${table.display_name}')">
                  <i class="fa-solid fa-lock"></i>
                </button>
              </div>
            `
                : `
              <div class="text-center py-3 text-muted small">
                Meja Kosong / Siap Digunakan
              </div>
              <button class="btn btn-sm btn-outline-primary w-100 mt-auto" onclick="cashierApp.openSessionModal('${table.id}', '${table.display_name}')">
                <i class="fa-solid fa-door-open me-1"></i> Buka Sesi Meja
              </button>
            `
            }
          </div>
        </div>
      `;
      })
      .join('');
  }

  async confirmOrder(orderId) {
    try {
      await apiPost(`/api/v1/cashier/orders/${orderId}/confirm/`);
      this.loadPendingOrders();
      this.loadTables();
      showToast(t('order_confirmed_success'), 'success');
      SoundEffects.playSuccess();
    } catch (e) {
      showToast(t(e.message), 'error');
    }
  }

  promptReject(orderId, orderCode) {
    this.selectedOrderForReject = orderId;
    document.getElementById('reject-order-code').textContent = orderCode;
    document.getElementById('reject-reason-input').value = '';
    const modal = new bootstrap.Modal(document.getElementById('rejectOrderModal'));
    modal.show();
  }

  async submitRejectOrder() {
    const reason = document.getElementById('reject-reason-input').value.trim();
    if (!reason) {
      showToast(t('reason_required'), 'warning');
      return;
    }

    try {
      await apiPost(`/api/v1/cashier/orders/${this.selectedOrderForReject}/reject/`, { reason });
      bootstrap.Modal.getInstance(document.getElementById('rejectOrderModal')).hide();
      this.loadPendingOrders();
      showToast(t('order_rejected_success'), 'info');
      SoundEffects.playError();
    } catch (e) {
      showToast(t(e.message), 'error');
    }
  }

  openSessionModal(tableId, tableName) {
    this.selectedTableId = tableId;
    document.getElementById('open-session-table-name').textContent = tableName;
    document.getElementById('open-session-guests').value = '2';
    const modal = new bootstrap.Modal(document.getElementById('openSessionModal'));
    modal.show();
  }

  async submitOpenSession() {
    const guests = document.getElementById('open-session-guests').value;
    try {
      await apiPost(`/api/v1/cashier/tables/${this.selectedTableId}/open-session/`, {
        guest_count: parseInt(guests) || 1,
      });
      bootstrap.Modal.getInstance(document.getElementById('openSessionModal')).hide();
      this.loadTables();
      showToast(t('session_opened_success'), 'success');
      SoundEffects.playSuccess();
    } catch (e) {
      showToast(t(e.message), 'error');
    }
  }

  async openPaymentModal(sessionId, tableName, billTotal) {
    this.currentPaymentSessionId = sessionId;
    document.getElementById('pos-table-name').textContent = tableName;
    document.getElementById('pos-bill-total').textContent = `$${billTotal}`;
    document.getElementById('pos-tendered-amount').value = billTotal;
    this.currentBillAmount = parseFloat(billTotal);
    this.calculateChange();

    const modal = new bootstrap.Modal(document.getElementById('paymentModal'));
    modal.show();
  }

  setTenderedAmount(val) {
    document.getElementById('pos-tendered-amount').value = val.toFixed(2);
    this.calculateChange();
  }

  calculateChange() {
    const tendered = parseFloat(document.getElementById('pos-tendered-amount').value) || 0;
    const change = tendered - this.currentBillAmount;
    const changeEl = document.getElementById('pos-change-amount');
    const payBtn = document.getElementById('btn-submit-payment');

    if (changeEl) {
      if (change < 0) {
        changeEl.textContent = `Osan Kurang $${Math.abs(change).toFixed(2)}`;
        changeEl.className = 'fw-bold fs-5 text-danger';
        if (payBtn) payBtn.disabled = true;
      } else {
        changeEl.textContent = `$${change.toFixed(2)}`;
        changeEl.className = 'fw-bold fs-4 text-success';
        if (payBtn) payBtn.disabled = false;
      }
    }
  }

  async processPayment() {
    const tendered = parseFloat(document.getElementById('pos-tendered-amount').value) || 0;
    const method = document.getElementById('pos-payment-method').value;

    try {
      const payment = await apiPost(`/api/v1/cashier/table-sessions/${this.currentPaymentSessionId}/payments/`, {
        tendered_amount: tendered,
        method: method,
        idempotency_key: crypto.randomUUID(),
      });

      bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
      this.loadTables();
      
      showToast(`${t('payment_success')} $${payment.amount}! ${t('change_label')} $${payment.change_amount}`, 'success');
      SoundEffects.playSuccess();
      
      this.showReceiptModal(payment);
    } catch (e) {
      showToast(t(e.message), 'error');
    }
  }

  showReceiptModal(payment) {
    const receiptContent = document.getElementById('receipt-print-content');
    if (receiptContent) {
      receiptContent.innerHTML = `
        <div class="receipt-paper" id="printable-receipt">
          <div class="text-center mb-2">
            <h5 class="fw-bold mb-0">CELVASS RESTO & BAR</h5>
            <small>Av. Nicolau Lobato, Dili, Timor-Leste</small><br>
            <small>Tel: +670 7712 3456</small>
          </div>
          <div class="border-top border-bottom py-1 my-2 small">
            <div>Resibu Nu: <strong>${payment.payment_code}</strong></div>
            <div>Data: ${new Date(payment.paid_at).toLocaleString()}</div>
          </div>
          <div class="d-flex justify-content-between fw-bold my-1">
            <span>TOTÁL KANTA:</span>
            <span>$${payment.amount}</span>
          </div>
          <div class="d-flex justify-content-between small">
            <span>OSAN SIMU:</span>
            <span>$${payment.tendered_amount}</span>
          </div>
          <div class="d-flex justify-content-between fw-bold text-success border-top pt-1 mt-1">
            <span>OSAN FILA:</span>
            <span>$${payment.change_amount}</span>
          </div>
          <div class="text-center mt-3 small text-muted">
            <p>Obrigado barak ba ita-boot nia vizita!</p>
          </div>
        </div>
      `;
      new bootstrap.Modal(document.getElementById('receiptModal')).show();
    }
  }

  async handleCloseSession(sessionId, tableName) {
    if (!confirm(`Tutup sesi untuk ${tableName}? (Pastikan semua pembayaran selesai)`)) return;
    try {
      await apiPost(`/api/v1/cashier/table-sessions/${sessionId}/close/`);
      this.loadTables();
      showToast(`${t('session_closed')} ${tableName}.`, 'info');
      SoundEffects.playBell();
    } catch (e) {
      showToast(t(e.message), 'error');
    }
  }

  initWebSocket() {
    this.ws = new WebSocketClient('/ws/cashier/', (msg) => {
      console.log('Cashier WS update:', msg);
      if (msg.event === 'NEW_ORDER_WAITING') {
        SoundEffects.playBell();
        showToast(`🔔 ${t('new_order_toast')} ${msg.data.order_code} - ${msg.data.table_name || msg.data.table_code}!`, 'warning');
        this.loadPendingOrders();
      } else if (msg.event === 'BILL_REQUESTED') {
        SoundEffects.playBell();
        showToast(`💳 ${t('bill_request_toast')} ${msg.data.table_name || msg.data.table_code}!`, 'info');
        this.loadTables();
      } else if (msg.event === 'SESSION_OPENED' || msg.event === 'SESSION_CLOSED' || msg.event === 'PAYMENT_COMPLETED') {
        this.loadTables();
      }
    });
  }
}
