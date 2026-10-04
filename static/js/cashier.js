/**
 * Cashier Command Center & POS Controller
 */

class CashierApp {
  constructor() {
    this.pendingOrders = [];
    this.tables = [];
    this.tableFilter = 'ALL';
    this.selectedTableId = null;
    this.selectedOrderForReject = null;
    this.currentPaymentSessionId = null;
    this.currentBillAmount = 0;
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

  setTableFilter(filter) {
    this.tableFilter = filter;
    
    // Update button states
    const btnAll = document.getElementById('filter-table-all');
    const btnOpen = document.getElementById('filter-table-open');
    const btnAvail = document.getElementById('filter-table-avail');

    if (btnAll) btnAll.className = filter === 'ALL' ? 'btn btn-primary btn-sm px-2 fw-bold' : 'btn btn-outline-primary btn-sm px-2';
    if (btnOpen) btnOpen.className = filter === 'OPEN' ? 'btn btn-success btn-sm px-2 fw-bold' : 'btn btn-outline-success btn-sm px-2';
    if (btnAvail) btnAvail.className = filter === 'AVAILABLE' ? 'btn btn-secondary btn-sm px-2 fw-bold' : 'btn btn-outline-secondary btn-sm px-2';

    this.renderTablesUI();
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

    // Filter tables based on user selection
    let filteredTables = this.tables;
    if (this.tableFilter === 'OPEN') {
      filteredTables = this.tables.filter((t) => t.active_session !== null);
    } else if (this.tableFilter === 'AVAILABLE') {
      filteredTables = this.tables.filter((t) => t.active_session === null);
    }

    if (filteredTables.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
          <i class="fa-solid fa-chair fa-3x mb-2 text-secondary"></i>
          <h6>La iha meza tuir filtru ne'e.</h6>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredTables
      .map((table) => {
        const session = table.active_session;
        const isOccupied = session !== null;
        const remaining = session ? parseFloat(session.remaining_balance !== undefined ? session.remaining_balance : session.bill_total) : 0;
        const isPaid = session && (session.is_fully_paid || session.status === 'PAID' || remaining <= 0);

        let sessionBadge = '';
        if (session) {
          if (isPaid) {
            sessionBadge = '<span class="badge bg-success text-white"><i class="fa-solid fa-check-circle me-1"></i> PAID</span>';
          } else if (session.status === 'BILL_REQUESTED') {
            sessionBadge = '<span class="badge bg-danger text-white pulse"><i class="fa-solid fa-receipt me-1"></i> Husu Konta</span>';
          } else {
            sessionBadge = '<span class="badge bg-info text-dark">Sesi Loke</span>';
          }
        }

        return `
        <div class="col-md-6 mb-3">
          <div class="card card-custom p-3 h-100 ${isOccupied ? (isPaid ? 'border-success' : 'border-primary') : ''}">
            <div class="d-flex justify-content-between align-items-start mb-1">
              <div>
                <h5 class="fw-bold mb-0 text-dark">${table.display_name}</h5>
                <span class="text-muted small">${table.table_code} | Kapasidade: ${table.capacity || 4} Kursi</span>
              </div>
              <div>${isOccupied ? sessionBadge : '<span class="badge bg-light text-secondary border">Mamuk</span>'}</div>
            </div>

            ${
              isOccupied
                ? `
              <div class="p-2 bg-light rounded small my-2 border">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span>Bainaka: <strong>${session.guest_count} Ema</strong></span>
                  <span>Pedidu: <strong>${session.orders_count}</strong></span>
                </div>
                <div class="d-flex justify-content-between align-items-center border-top pt-1">
                  <span class="text-muted">Konta Totál:</span>
                  <span class="fw-bold fs-6 ${isPaid ? 'text-success' : 'text-primary'}">
                    $${session.bill_total}
                    ${isPaid ? ' <span class="badge bg-success-subtle text-success small">Selu Tiha Ona</span>' : (remaining < parseFloat(session.bill_total) ? ` <small class="text-danger">($${remaining.toFixed(2)} resta)</small>` : '')}
                  </span>
                </div>
              </div>

              <div class="d-flex gap-2 mt-auto flex-wrap">
                ${
                  isPaid
                    ? `
                  <button class="btn btn-sm btn-success flex-fill fw-bold" onclick="cashierApp.viewReceiptForSession('${session.id}')" title="Haree Resibu Pagamentu">
                    <i class="fa-solid fa-receipt me-1"></i> Resibu (Selu Tiha)
                  </button>
                `
                    : `
                  <button class="btn btn-sm btn-primary flex-fill fw-bold" onclick="cashierApp.openPaymentModal('${session.id}', '${table.display_name}')">
                    <i class="fa-solid fa-cash-register me-1"></i> Selu Bill ($${remaining.toFixed(2)})
                  </button>
                `
                }
                
                <a href="/t/${table.qr_token}/" target="_blank" class="btn btn-sm btn-outline-info" title="Loke Menu Dine-in Meza Ne'e">
                  <i class="fa-solid fa-qrcode me-1"></i> Menu
                </a>

                <button class="btn btn-sm btn-outline-danger" title="Tutup / Taka Meza" onclick="cashierApp.handleCloseSession('${session.id}', '${table.display_name}')">
                  <i class="fa-solid fa-lock"></i>
                </button>
              </div>
            `
                : `
              <div class="text-center py-3 text-muted small">
                Meza Mamuk / Prontu atu simu bainaka
              </div>
              <div class="d-flex gap-2 mt-auto">
                <button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="cashierApp.openSessionModal('${table.id}', '${table.display_name}')">
                  <i class="fa-solid fa-door-open me-1"></i> Loke Sesi Meza
                </button>
                <a href="/t/${table.qr_token}/" target="_blank" class="btn btn-sm btn-outline-secondary" title="Haree Menu">
                  <i class="fa-solid fa-qrcode"></i>
                </a>
              </div>
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

  openPaymentModal(sessionId, tableName) {
    this.currentPaymentSessionId = sessionId;

    // Find table & active session details
    const table = this.tables.find((t) => t.active_session && t.active_session.id === sessionId);
    const session = table ? table.active_session : null;

    if (!session) {
      showToast('Sesi meza la hetan.', 'error');
      return;
    }

    const remaining = parseFloat(session.remaining_balance !== undefined ? session.remaining_balance : session.bill_total) || 0;

    document.getElementById('pos-table-name').textContent = tableName;
    document.getElementById('pos-bill-total').textContent = `$${remaining.toFixed(2)}`;
    document.getElementById('pos-tendered-amount').value = remaining.toFixed(2);
    this.currentBillAmount = remaining;
    this.calculateChange();

    const statusEl = document.getElementById('pos-paid-status');
    if (statusEl) {
      if (session.total_paid && parseFloat(session.total_paid) > 0) {
        statusEl.textContent = `Selu tiha ona: $${session.total_paid} | Totál Pedidu: $${session.bill_total}`;
      } else {
        statusEl.textContent = `Totál Pedidu: $${session.bill_total}`;
      }
    }

    // Populate itemized order breakdown
    const itemsContainer = document.getElementById('pos-order-items-container');
    if (itemsContainer) {
      if (!session.items || session.items.length === 0) {
        itemsContainer.innerHTML = '<div class="text-center py-3 text-muted small">La iha item pedidu atu selu.</div>';
      } else {
        itemsContainer.innerHTML = `
          <table class="table table-sm table-borderless mb-0 small">
            <thead class="border-bottom text-muted">
              <tr>
                <th>Item</th>
                <th class="text-center">Qtd</th>
                <th class="text-end">Presu</th>
                <th class="text-end">Subtotál</th>
              </tr>
            </thead>
            <tbody>
              ${session.items
                .map(
                  (item) => `
                <tr class="border-bottom border-light">
                  <td>
                    <strong>${item.name}</strong>
                    ${item.note ? `<div class="badge bg-warning text-dark"><i class="fa-solid fa-pen small"></i> ${item.note}</div>` : ''}
                    <div class="text-muted" style="font-size: 0.75rem;">${item.order_code}</div>
                  </td>
                  <td class="text-center fw-bold">${item.quantity}</td>
                  <td class="text-end text-muted">$${item.unit_price}</td>
                  <td class="text-end fw-bold text-dark">$${item.subtotal}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `;
      }
    }

    // Ensure submit button is enabled and reset
    const payBtn = document.getElementById('btn-submit-payment');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.innerHTML = '<i class="fa-solid fa-check-circle me-1"></i> Kompleta Pagamentu';
    }

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
    const payBtn = document.getElementById('btn-submit-payment');

    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Prosesu Hela...';
    }

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
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerHTML = '<i class="fa-solid fa-check-circle me-1"></i> Kompleta Pagamentu';
      }
    }
  }

  async viewReceiptForSession(sessionId) {
    try {
      const payment = await apiGet(`/api/v1/cashier/table-sessions/${sessionId}/payments/`);
      this.showReceiptModal(payment);
    } catch (e) {
      showToast(t(e.message) || 'Resibu la hetan.', 'error');
    }
  }

  showReceiptModal(payment) {
    const receiptContent = document.getElementById('receipt-print-content');
    if (receiptContent) {
      receiptContent.innerHTML = `
        <div class="receipt-paper" id="printable-receipt">
          <div class="text-center mb-2">
            <h5 class="fw-bold mb-0">CELVASS RESTO &amp; BAR</h5>
            <small>Praia dos Coqueiros, Dili, Timor-Leste</small><br>
            <small>Tel: +670 7712 3456</small>
          </div>
          <div class="border-top border-bottom py-1 my-2 small text-start">
            <div><strong>Meza:</strong> ${payment.table_name || payment.table_code || '-'}</div>
            <div><strong>Resibu Nu:</strong> ${payment.payment_code}</div>
            <div><strong>Data:</strong> ${new Date(payment.paid_at).toLocaleString()}</div>
          </div>
          <div class="my-2 text-start">
            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px dashed #666;">
                  <th style="text-align: left; padding: 2px 0;">Item</th>
                  <th style="text-align: center; padding: 2px 0;">Qtd</th>
                  <th style="text-align: right; padding: 2px 0;">Subtotál</th>
                </tr>
              </thead>
              <tbody>
                ${(payment.items || [])
                  .map(
                    (i) => `
                  <tr>
                    <td style="padding: 2px 0;">
                      <strong>${i.name}</strong>
                      ${i.note ? `<br><small style="color: #666;">* ${i.note}</small>` : ''}
                    </td>
                    <td style="text-align: center; padding: 2px 0;">${i.quantity}</td>
                    <td style="text-align: right; padding: 2px 0;">$${i.subtotal}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <div class="border-top border-dark pt-1 small text-start">
            <div class="d-flex justify-content-between fw-bold">
              <span>TOTÁL KANTA:</span>
              <span>$${payment.amount}</span>
            </div>
            <div class="d-flex justify-content-between">
              <span>OSAN SIMU:</span>
              <span>$${payment.tendered_amount}</span>
            </div>
            <div class="d-flex justify-content-between fw-bold text-success border-top pt-1 mt-1">
              <span>OSAN FILA (CHANGE):</span>
              <span>$${payment.change_amount}</span>
            </div>
          </div>
          <div class="text-center mt-3 small text-muted">
            <p class="mb-0">Obrigado barak ba ita-boot nia vizita!</p>
            <small>Sistema PWA Celvass Resto &amp; Bar</small>
          </div>
        </div>
      `;
      new bootstrap.Modal(document.getElementById('receiptModal')).show();
    }
  }

  printCurrentReceipt() {
    const receiptEl = document.getElementById('printable-receipt');
    if (!receiptEl) {
      window.print();
      return;
    }

    // Open an isolated print window strictly formatted for 1-page 80mm thermal receipt
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - Celvass Resto &amp; Bar</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          html, body {
            margin: 0;
            padding: 8px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.25;
            background: #fff;
            color: #000;
            width: 76mm;
            max-width: 100%;
          }
          .text-center { text-align: center; }
          .text-start { text-align: left; }
          .text-end { text-align: right; }
          .fw-bold { font-weight: bold; }
          .d-flex { display: flex; }
          .justify-content-between { display: flex; justify-content: space-between; }
          .border-top { border-top: 1px dashed #000; }
          .border-bottom { border-bottom: 1px dashed #000; }
          .my-1 { margin-top: 4px; margin-bottom: 4px; }
          .my-2 { margin-top: 8px; margin-bottom: 8px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .pt-1 { padding-top: 4px; }
          .mt-1 { margin-top: 4px; }
          .mt-3 { margin-top: 12px; }
          .mb-0 { margin-bottom: 0; }
          .mb-2 { margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 2px 0; }
          @media print {
            body { margin: 0; padding: 4px; }
          }
        </style>
      </head>
      <body>
        ${receiptEl.outerHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
