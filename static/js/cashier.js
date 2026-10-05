/**
 * Celvass Resto & Bar — Cashier Command Center & POS Controller
 * Pure Tetun Interface, Dark Glassmorphism, Shift Report, & Anti-Double-Click POS
 */

class CashierApp {
  constructor() {
    this.pendingOrders = [];
    this.tables = [];
    this.activationRequests = [];
    this.tableFilter = 'ALL';
    this.todayOrdersHistory = [];
    this.selectedTableId = null;
    this.selectedOrderForReject = null;
    this.currentPaymentSessionId = null;
    this.currentBillAmount = 0;

    // Track known IDs to trigger sound alerts when new requests arrive via polling or WS
    this.knownActivationIds = null;
    this.knownOrderIds = null;
    this.knownBillSessionIds = null;

    this.init();
  }

  init() {
    this.loadPendingOrders();
    this.loadTables();
    this.loadActivationRequests();
    this.initWebSocket();

    window.addEventListener('languageChanged', () => {
      this.renderPendingOrdersUI();
      this.renderTablesUI();
      this.renderActivationRequestsUI();
    });

    // Polling fallback every 5 seconds
    setInterval(() => {
      this.loadPendingOrders();
      this.loadTables();
      this.loadActivationRequests();
    }, 5000);
  }


  setTableFilter(filter) {
    this.tableFilter = filter;

    const btnAll = document.getElementById('filter-table-all');
    const btnOpen = document.getElementById('filter-table-open');
    const btnAvail = document.getElementById('filter-table-avail');

    if (btnAll) btnAll.className = filter === 'ALL' ? 'btn btn-warning btn-sm px-3 fw-bold rounded-start-pill text-dark' : 'btn btn-outline-warning btn-sm px-3 fw-bold rounded-start-pill text-white';
    if (btnOpen) btnOpen.className = filter === 'OPEN' ? 'btn btn-success btn-sm px-3 fw-bold text-white' : 'btn btn-outline-success btn-sm px-3 fw-bold';
    if (btnAvail) btnAvail.className = filter === 'AVAILABLE' ? 'btn btn-secondary btn-sm px-3 fw-bold rounded-end-pill text-white' : 'btn btn-outline-secondary btn-sm px-3 fw-bold rounded-end-pill';

    this.renderTablesUI();
  }

  async loadPendingOrders() {
    try {
      this.pendingOrders = await apiGet('/api/v1/cashier/orders/');
      const currentOrderIds = new Set((this.pendingOrders || []).map((o) => String(o.id)));
      if (this.knownOrderIds !== null) {
        const hasNew = [...currentOrderIds].some((id) => !this.knownOrderIds.has(id));
        if (hasNew) {
          SoundEffects.playBell();
        }
      }
      this.knownOrderIds = currentOrderIds;
      this.renderPendingOrdersUI();
    } catch (e) {
      console.error('Error loading pending orders:', e);
    }
  }

  async loadActivationRequests() {
    try {
      this.activationRequests = await apiGet('/api/v1/cashier/activation-requests/');
      const currentIds = new Set((this.activationRequests || []).map((r) => String(r.id)));
      if (this.knownActivationIds !== null) {
        const hasNew = [...currentIds].some((id) => !this.knownActivationIds.has(id));
        if (hasNew) {
          SoundEffects.playBell();
        }
      }
      this.knownActivationIds = currentIds;
      this.renderActivationRequestsUI();
    } catch (e) {
      console.error('Error loading activation requests:', e);
    }
  }

  renderActivationRequestsUI() {
    const container = document.getElementById('activation-requests-container');
    if (!container) return;

    if (!this.activationRequests || this.activationRequests.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.activationRequests
      .map(
        (req) => `
      <div class="glass-card p-2 p-sm-2.5 mb-2 border-warning border-2 bg-dark bg-opacity-70 shadow-sm animate__animated animate__fadeIn">
        <div class="d-flex justify-content-between align-items-center mb-1 gap-1">
          <div class="d-flex align-items-center gap-1.5 flex-wrap">
            <span class="badge bg-warning text-dark fw-bold px-2 py-0.5" style="font-size:0.8rem;">
              <i class="fa-solid fa-bell fa-shake me-1"></i> ${req.table_name || req.table_code}
            </span>
            <span class="badge bg-dark bg-opacity-75 text-warning border border-warning border-opacity-50 px-1.5 py-0.5" style="font-size:0.72rem;">
              <i class="fa-solid fa-users me-1"></i>${req.guest_count || 2} ${t('people')}
            </span>
          </div>
          <span class="badge bg-warning text-dark fw-bold px-1.5 py-0.5" style="font-size:0.7rem;">
            Husu Sesi
          </span>
        </div>
        <div class="d-flex align-items-center justify-content-between gap-2 mt-1">
          <small class="text-white-50 text-truncate" style="font-size:0.78rem;">
            <i class="fa-solid fa-qrcode me-1 text-warning"></i>${t('table_activation_requested_title')}
          </small>
          <div class="d-flex gap-1.5 ms-auto flex-shrink-0">
            <button class="btn btn-sm btn-success fw-bold rounded-pill px-2.5 py-1 shadow-sm d-flex align-items-center" style="font-size:0.78rem;" onclick="cashierApp.approveActivation('${req.id}')">
              <i class="fa-solid fa-check me-1"></i> ${t('btn_approve_activation')}
            </button>
            <button class="btn btn-sm btn-outline-danger rounded-circle d-flex align-items-center justify-content-center" style="width:28px; height:28px; padding:0;" onclick="cashierApp.rejectActivation('${req.id}')" title="${t('cancel')}">
              <i class="fa-solid fa-xmark small"></i>
            </button>
          </div>
        </div>
      </div>
    `
      )
      .join('');
  }

  async approveActivation(requestId) {
    try {
      await apiPost(`/api/v1/cashier/activation-requests/${requestId}/approve/`);
      SoundEffects.playSuccess();
      showToast(t('session_opened_success') || 'Sesi meza loke ho susesu!', 'success');
      this.loadActivationRequests();
      this.loadTables();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async rejectActivation(requestId) {
    if (!confirm('Rekuza pedidu loke meza ne\'e?')) return;
    try {
      await apiPost(`/api/v1/cashier/activation-requests/${requestId}/reject/`, { reason: 'Rekuza hosi Kaixa' });
      showToast('Pedidu loke meza rekuza ona.', 'info');
      this.loadActivationRequests();
      this.loadTables();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async loadTables() {
    try {
      this.tables = await apiGet('/api/v1/cashier/tables/');
      const billSessions = (this.tables || [])
        .filter((t) => t.active_session && t.active_session.status === 'BILL_REQUESTED')
        .map((t) => String(t.active_session.id));
      const currentBillSet = new Set(billSessions);
      if (this.knownBillSessionIds !== null) {
        const hasNewBill = [...currentBillSet].some((id) => !this.knownBillSessionIds.has(id));
        if (hasNewBill) {
          SoundEffects.playBell();
        }
      }
      this.knownBillSessionIds = currentBillSet;
      this.renderTablesUI();
      this.updateBillAlertsUI();
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
        <div class="text-center py-4 text-white-50">
          <i class="fa-solid fa-circle-check fa-2x text-success mb-2"></i>
          <h6 class="text-white small mb-1">${t('all_verified')}</h6>
          <p class="small text-white-50 mb-0" style="font-size:0.75rem;">${t('new_orders_appear_here')}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.pendingOrders
      .map(
        (order) => `
      <div class="glass-card p-2 p-sm-2.5 mb-2 border-warning border-opacity-50 shadow-sm animate__animated animate__fadeIn">
        <div class="d-flex justify-content-between align-items-center mb-1.5 gap-1">
          <div class="d-flex align-items-center gap-1.5 flex-wrap">
            <span class="badge bg-warning text-dark fw-bold px-2 py-0.5" style="font-size:0.8rem;">${order.table_name || order.table_code}</span>
            <span class="fw-bold text-white small">${order.order_code}</span>
            <span class="text-white-50 small ms-1" style="font-size:0.72rem;"><i class="fa-regular fa-clock me-0.5"></i>${new Date(order.submitted_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
          <span class="badge bg-warning bg-opacity-25 border border-warning text-warning rounded-pill px-2 py-0.5" style="font-size:0.7rem;">${t('status_waiting')}</span>
        </div>

        <div class="border border-secondary border-opacity-25 rounded-2 p-1.5 px-2 bg-dark bg-opacity-60 mb-2">
          <ul class="list-unstyled mb-0" style="font-size:0.8rem;">
            ${order.items
              .map(
                (item) => `
              <li class="d-flex justify-content-between py-0.5 border-bottom border-secondary border-opacity-25">
                <span class="text-white text-truncate pe-1"><strong>${item.quantity}x</strong> ${item.menu_name_snapshot} ${item.note ? `<span class="badge bg-warning text-dark ms-1 py-0 px-1" style="font-size:0.68rem;"><i class="fa-solid fa-pen small"></i> ${item.note}</span>` : ''}</span>
                <span class="fw-semibold text-warning flex-shrink-0">$${item.subtotal}</span>
              </li>
            `
              )
              .join('')}
          </ul>
          ${order.customer_note ? `<div class="mt-1 p-1 bg-danger bg-opacity-20 border border-danger border-opacity-25 rounded small text-danger" style="font-size:0.75rem;"><strong>${t('customer_notes')}</strong> ${order.customer_note}</div>` : ''}
        </div>

        <div class="d-flex justify-content-between align-items-center gap-2">
          <div class="fw-bold text-warning fs-6">${t('total')}: $${order.grand_total}</div>
          <div class="d-flex gap-1.5">
            <button class="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1 d-flex align-items-center" style="font-size:0.78rem;" onclick="cashierApp.promptReject('${order.id}', '${order.order_code}')">
              <i class="fa-solid fa-xmark me-1 small"></i> ${t('btn_reject')}
            </button>
            <button class="btn btn-sm btn-success rounded-pill px-2.5 py-1 fw-bold shadow-sm d-flex align-items-center" style="font-size:0.78rem;" onclick="cashierApp.confirmOrder('${order.id}')">
              <i class="fa-solid fa-check me-1 small"></i> ${t('btn_confirm_send')}
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

    let filteredTables = this.tables;
    if (this.tableFilter === 'OPEN') {
      filteredTables = this.tables.filter((t) => t.active_session !== null);
    } else if (this.tableFilter === 'AVAILABLE') {
      filteredTables = this.tables.filter((t) => t.active_session === null);
    }

    if (filteredTables.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-4 text-white-50">
          <i class="fa-solid fa-chair fa-2x mb-2 text-secondary"></i>
          <h6 class="text-white small mb-0">${t('no_orders_history')}</h6>
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
        const hasPendingActivation = !isOccupied && table.pending_activation;

        let cardBorder = 'border-secondary border-opacity-25';
        if (isOccupied) {
          cardBorder = isPaid ? 'border-success' : (session.status === 'BILL_REQUESTED' ? 'border-danger' : 'border-primary');
        } else if (hasPendingActivation) {
          cardBorder = 'border-warning border-2 shadow-sm';
        }

        let sessionBadge = '';
        if (session) {
          if (isPaid) {
            sessionBadge = `<span class="badge bg-success text-white rounded-pill px-1.5 py-0.5" style="font-size:0.7rem;"><i class="fa-solid fa-check-circle me-1"></i> ${t('paid_status')}</span>`;
          } else if (session.status === 'BILL_REQUESTED') {
            sessionBadge = `<span class="badge bg-danger text-white rounded-pill pulse px-1.5 py-0.5" style="font-size:0.7rem;"><i class="fa-solid fa-receipt me-1"></i> ${t('request_bill')}</span>`;
          } else {
            sessionBadge = `<span class="badge bg-info bg-opacity-25 border border-info text-info rounded-pill px-1.5 py-0.5" style="font-size:0.7rem;">${t('active_session')}</span>`;
          }
        } else if (hasPendingActivation) {
          sessionBadge = `<span class="badge bg-warning text-dark rounded-pill pulse px-1.5 py-0.5" style="font-size:0.7rem;"><i class="fa-solid fa-bell fa-shake me-1"></i> Husu Loke</span>`;
        } else {
          sessionBadge = `<span class="badge bg-secondary bg-opacity-25 border border-secondary text-secondary rounded-pill px-1.5 py-0.5" style="font-size:0.7rem;">${t('filter_avail_tables')}</span>`;
        }

        return `
        <div class="col-12 col-sm-6 col-xl-4 mb-2">
          <div class="glass-card p-2 p-sm-2.5 h-100 ${cardBorder} d-flex flex-column shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-1 gap-1">
              <div class="text-truncate">
                <span class="fw-bold text-white fs-6 text-truncate d-block">${table.display_name}</span>
                <span class="text-white-50" style="font-size:0.72rem;">${table.table_code} &bull; ${table.capacity || 4} <i class="fa-solid fa-user-group ms-0.5 small"></i></span>
              </div>
              <div class="flex-shrink-0">${sessionBadge}</div>
            </div>

            ${
              isOccupied
                ? `
              <div class="p-1.5 px-2 bg-dark bg-opacity-60 rounded-2 small my-1.5 border border-secondary border-opacity-25">
                <div class="d-flex justify-content-between align-items-center mb-0.5" style="font-size:0.75rem;">
                  <span class="text-white-50">${t('guests')}: <strong class="text-white">${session.guest_count}</strong></span>
                  <span class="text-white-50">${t('total_orders')}: <strong class="text-white">${session.orders_count}</strong></span>
                </div>
                <div class="d-flex justify-content-between align-items-center border-top border-secondary border-opacity-25 pt-1" style="font-size:0.78rem;">
                  <span class="text-white-50">${t('remaining_bill')}:</span>
                  <span class="fw-bold ${isPaid ? 'text-success' : 'text-warning'}">
                    $${session.bill_total}
                    ${isPaid ? ` <span class="badge bg-success-subtle text-success small px-1 py-0">${t('paid_status')}</span>` : (remaining < parseFloat(session.bill_total) ? ` <small class="text-danger">($${remaining.toFixed(2)})</small>` : '')}
                  </span>
                </div>
              </div>

              <div class="d-flex gap-1.5 mt-auto pt-1">
                ${
                  isPaid
                    ? `
                  <button class="btn btn-sm btn-success flex-fill fw-bold rounded-pill py-1 px-2 d-flex align-items-center justify-content-center" style="font-size:0.78rem;" onclick="cashierApp.viewReceiptForSession('${session.id}')" title="${t('receipt_title')}">
                    <i class="fa-solid fa-receipt me-1"></i> ${t('receipt_title')}
                  </button>
                `
                    : `
                  <button class="btn btn-sm btn-warning flex-fill fw-bold rounded-pill text-dark shadow-sm py-1 px-2 text-truncate d-flex align-items-center justify-content-center" style="font-size:0.78rem;" onclick="cashierApp.openPaymentModal('${session.id}', '${table.display_name}')">
                    <i class="fa-solid fa-cash-register me-1"></i> ${t('btn_pay_pos')} ($${remaining.toFixed(2)})
                  </button>
                `
                }
                
                <a href="/t/${table.qr_token}/" target="_blank" class="btn btn-sm btn-outline-info rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px; height:28px; padding:0;" title="QR Menu">
                  <i class="fa-solid fa-qrcode small"></i>
                </a>

                <button class="btn btn-sm btn-outline-danger rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px; height:28px; padding:0;" title="${t('close')}" onclick="cashierApp.handleCloseSession('${session.id}', '${table.display_name}')">
                  <i class="fa-solid fa-lock small"></i>
                </button>
              </div>
            `
                : `
              <div class="my-1">
                ${
                  hasPendingActivation
                    ? `<div class="p-1.5 px-2 bg-dark bg-opacity-70 border border-warning border-opacity-50 rounded-2 shadow-sm">
                        <div class="d-flex align-items-center justify-content-between mb-1">
                          <span class="badge bg-warning text-dark fw-bold px-1.5 py-0.5" style="font-size:0.7rem;">
                            <i class="fa-solid fa-bell fa-shake me-1"></i>Husu Loke Sesi
                          </span>
                          <span class="badge bg-dark border border-warning border-opacity-40 text-warning px-1.5 py-0.5" style="font-size:0.7rem;">
                            <i class="fa-solid fa-users me-1"></i>${table.pending_activation.guest_count || 2} Ema
                          </span>
                        </div>
                        <div class="d-flex align-items-center justify-content-between text-white-50" style="font-size:0.72rem;">
                          <span><i class="fa-solid fa-qrcode text-warning me-1"></i>Kliente scan QR</span>
                          <span class="text-warning fw-semibold"><i class="fa-regular fa-clock me-1"></i>Hein verifikasaun</span>
                        </div>
                       </div>`
                    : `<div class="py-1 text-white-50 text-center" style="font-size:0.78rem;"><i class="fa-solid fa-chair me-1 text-secondary"></i> ${t('table_empty')}</div>`
                }
              </div>
              <div class="d-flex gap-1.5 mt-auto pt-1">
                ${
                  hasPendingActivation
                    ? `<button class="btn btn-sm btn-success flex-fill fw-bold rounded-pill shadow-sm py-1 px-2 d-flex align-items-center justify-content-center text-truncate" style="font-size:0.78rem;" onclick="cashierApp.approveActivation('${table.pending_activation.id}')">
                        <i class="fa-solid fa-check-circle me-1"></i> ${t('btn_approve_activation')}
                       </button>`
                    : `<button class="btn btn-sm btn-outline-warning flex-fill fw-bold rounded-pill py-1 px-2 d-flex align-items-center justify-content-center text-truncate" style="font-size:0.78rem;" onclick="cashierApp.openSessionModal('${table.id}', '${table.display_name}')">
                        <i class="fa-solid fa-door-open me-1"></i> ${t('btn_open_session')}
                       </button>`
                }
                <a href="/t/${table.qr_token}/" target="_blank" class="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width:28px; height:28px; padding:0;" title="QR">
                  <i class="fa-solid fa-qrcode small"></i>
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

  updateBillAlertsUI() {
    const alertsContainer = document.getElementById('bill-alerts-container');
    const badge = document.getElementById('bill-alerts-count');

    const billTables = (this.tables || []).filter((tbl) => tbl.active_session && tbl.active_session.status === 'BILL_REQUESTED');

    if (badge) {
      if (billTables.length > 0) {
        badge.textContent = billTables.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (!alertsContainer) return;

    if (billTables.length === 0) {
      alertsContainer.innerHTML = `
        <div class="col-12 text-center py-5 text-white-50">
          <i class="fa-solid fa-bell-slash fa-3x mb-2 text-secondary"></i>
          <h6 class="text-white">${t('no_bill_alerts')}</h6>
        </div>
      `;
      return;
    }

    alertsContainer.innerHTML = billTables
      .map(
        (tbl) => `
      <div class="col-12 col-md-6 col-lg-4 mb-2">
        <div class="glass-card p-3 border-danger border-2 shadow-lg animate__animated animate__pulse">
          <div class="d-flex justify-content-between align-items-start mb-2 gap-2">
            <div>
              <h5 class="fw-bold mb-0 text-white">${tbl.display_name}</h5>
              <small class="text-white-50">${tbl.table_code} &bull; ${tbl.active_session.guest_count} ${t('people')}</small>
            </div>
            <span class="badge bg-danger text-white rounded-pill px-2 py-1 shadow-sm pulse">
              <i class="fa-solid fa-receipt me-1"></i>${t('request_bill')}!
            </span>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-3 p-2 bg-dark bg-opacity-60 rounded-3 border border-secondary border-opacity-25">
            <span class="text-white-50 small">${t('total')}:</span>
            <span class="fs-4 fw-bold text-warning">$${tbl.active_session.bill_total}</span>
          </div>
          <button class="btn btn-warning w-100 fw-bold rounded-pill text-dark shadow d-flex align-items-center justify-content-center py-2" onclick="cashierApp.openPaymentModal('${tbl.active_session.id}', '${tbl.display_name}')">
            <i class="fa-solid fa-cash-register me-1.5"></i> ${t('btn_pay_pos')}
          </button>
        </div>
      </div>
    `
      )
      .join('');
  }

  async loadTodayOrdersHistory() {
    const tbody = document.getElementById('orders-history-tbody');
    if (!tbody) return;

    try {
      const orders = await apiGet('/api/v1/cashier/orders/history/');
      this.todayOrdersHistory = orders || [];
      this.renderOrdersHistoryTable(this.todayOrdersHistory);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-danger">Erro karga istóriku pedidu.</td></tr>';
    }
  }

  filterOrdersHistory() {
    const q = (document.getElementById('order-history-search')?.value || '').toLowerCase().trim();
    if (!q) {
      this.renderOrdersHistoryTable(this.todayOrdersHistory);
      return;
    }
    const filtered = this.todayOrdersHistory.filter(
      (o) => o.order_code.toLowerCase().includes(q) || o.table_name.toLowerCase().includes(q) || o.items_summary.toLowerCase().includes(q)
    );
    this.renderOrdersHistoryTable(filtered);
  }

  renderOrdersHistoryTable(orders) {
    const tbody = document.getElementById('orders-history-tbody');
    if (!tbody) return;

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-white-50">Laiha pedidu tuir peskiza ne\'e.</td></tr>';
      return;
    }

    tbody.innerHTML = orders
      .map(
        (o) => `
      <tr>
        <td class="text-white-50">${o.created_at}</td>
        <td><strong class="text-white">${o.order_code}</strong></td>
        <td><span class="badge bg-dark border border-secondary">${o.table_name}</span></td>
        <td class="text-white-50">${o.items_summary}</td>
        <td class="fw-bold text-warning">$${o.grand_total}</td>
        <td><span class="badge bg-secondary">${o.status}</span></td>
        <td class="text-end">
          <span class="text-info small"><i class="fa-solid fa-check"></i></span>
        </td>
      </tr>
    `
      )
      .join('');
  }

  async loadShiftSummary() {
    try {
      const data = await apiGet('/api/v1/cashier/shift/summary/');
      const cashEl = document.getElementById('shift-cash-total');
      const otherEl = document.getElementById('shift-other-total');
      const grandEl = document.getElementById('shift-grand-total');
      const paidSessionsEl = document.getElementById('shift-paid-sessions-count');
      const completedOrdersEl = document.getElementById('shift-completed-orders-count');
      const timeEl = document.getElementById('shift-report-timestamp');

      if (cashEl) cashEl.textContent = `$${data.cash_total}`;
      if (otherEl) otherEl.textContent = `$${data.other_total}`;
      if (grandEl) grandEl.textContent = `$${data.grand_total}`;
      if (paidSessionsEl) paidSessionsEl.textContent = `${data.paid_sessions_count} Meza`;
      if (completedOrdersEl) completedOrdersEl.textContent = `${data.completed_orders_count} Pedidu`;
      if (timeEl) timeEl.textContent = data.timestamp;

      this.currentShiftData = data;
    } catch (e) {
      console.error('Error loading shift summary:', e);
    }
  }

  printShiftReport() {
    const data = this.currentShiftData || {};
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Z-Report Shift Close - Celvass Resto &amp; Bar</title>
        <style>
          @page { size: 80mm auto; margin: 0mm; }
          html, body {
            margin: 0; padding: 6px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px; line-height: 1.25;
            background: #fff; color: #000;
            width: 76mm; max-width: 100%;
          }
          .text-center { text-align: center; }
          .text-start { text-align: left; }
          .text-end { text-align: right; }
          .fw-bold { font-weight: bold; }
          .d-flex { display: flex; justify-content: space-between; }
          .border-top { border-top: 1px dashed #000; }
          .border-bottom { border-bottom: 1px dashed #000; }
          .my-1 { margin: 4px 0; }
          .my-2 { margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <h4 style="margin: 0; font-weight: bold;">CELVASS RESTO &amp; BAR</h4>
          <small>Praia dos Coqueiros, Dili</small><br>
          <strong style="display: block; margin-top: 4px;">*** RELATÓRIU FECHU KAIXA (Z-REPORT) ***</strong>
        </div>
        <div class="border-top border-bottom my-2 text-start">
          <div><strong>Data:</strong> ${data.timestamp || new Date().toLocaleString()}</div>
          <div><strong>Status:</strong> FECHU OFISIÁL</div>
        </div>
        <div class="my-2">
          <div class="d-flex"><span>OSAN-MARAN (CASH):</span><strong class="text-end">$${data.cash_total || '0.00'}</strong></div>
          <div class="d-flex"><span>KARTAUN / OUTROS:</span><strong class="text-end">$${data.other_total || '0.00'}</strong></div>
          <div class="border-top my-1"></div>
          <div class="d-flex fw-bold"><span>TOTÁL RENDIMENTU:</span><strong class="text-end">$${data.grand_total || '0.00'}</strong></div>
        </div>
        <div class="border-top my-2 text-start">
          <div class="d-flex"><span>Meza ne'ebé Selu:</span><span>${data.paid_sessions_count || 0}</span></div>
          <div class="d-flex"><span>Pedidu ne'ebé Remata:</span><span>${data.completed_orders_count || 0}</span></div>
          <div class="d-flex"><span>Totál Transasaun:</span><span>${data.payments_count || 0}</span></div>
        </div>
        <div class="text-center my-2" style="font-size: 10px; color: #555;">
          <p>Verifikadu &amp; Arkivadu ho Susesu.<br>Sistema PWA Celvass Resto &amp; Bar</p>
        </div>
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

  async confirmOrder(orderId) {
    try {
      await apiPost(`/api/v1/cashier/orders/${orderId}/confirm/`);
      this.loadPendingOrders();
      this.loadTables();
      showToast('Pedidu konfirma no haruka ba KDS Dapur!', 'success');
      SoundEffects.playSuccess();
    } catch (e) {
      showToast(e.message, 'error');
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
      showToast('Favór fó razaun rekuza!', 'warning');
      return;
    }

    try {
      await apiPost(`/api/v1/cashier/orders/${this.selectedOrderForReject}/reject/`, { reason });
      bootstrap.Modal.getInstance(document.getElementById('rejectOrderModal')).hide();
      this.loadPendingOrders();
      showToast('Pedidu rekuza ona no la prosesa iha dapur.', 'info');
      SoundEffects.playError();
    } catch (e) {
      showToast(e.message, 'error');
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
      showToast('Sesi meza loke ho susesu!', 'success');
      SoundEffects.playSuccess();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  openPaymentModal(sessionId, tableName) {
    this.currentPaymentSessionId = sessionId;

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

    const itemsContainer = document.getElementById('pos-order-items-container');
    if (itemsContainer) {
      if (!session.items || session.items.length === 0) {
        itemsContainer.innerHTML = '<div class="text-center py-3 text-white-50 small">Laiha item pedidu atu selu.</div>';
      } else {
        itemsContainer.innerHTML = `
          <table class="table table-sm table-dark table-borderless mb-0 small">
            <thead class="border-bottom border-secondary text-white-50">
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
                <tr class="border-bottom border-secondary border-opacity-25">
                  <td>
                    <strong class="text-white">${item.name}</strong>
                    ${item.note ? `<div class="badge bg-warning text-dark"><i class="fa-solid fa-pen small"></i> ${item.note}</div>` : ''}
                    <div class="text-white-50" style="font-size: 0.75rem;">${item.order_code}</div>
                  </td>
                  <td class="text-center fw-bold text-white">${item.quantity}</td>
                  <td class="text-end text-white-50">$${item.unit_price}</td>
                  <td class="text-end fw-bold text-warning">$${item.subtotal}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `;
      }
    }

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
        changeEl.textContent = `Osan Seidauk To'o $${Math.abs(change).toFixed(2)}`;
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
    const payBtn = document.getElementById('btn-submit-payment');
    if (payBtn) {
      if (payBtn.disabled) return;
      payBtn.disabled = true;
      payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Prosesu Hela Pagamentu...';
    }

    const tendered = parseFloat(document.getElementById('pos-tendered-amount').value) || 0;
    const method = document.getElementById('pos-payment-method').value;

    try {
      const payment = await apiPost(`/api/v1/cashier/table-sessions/${this.currentPaymentSessionId}/payments/`, {
        tendered_amount: tendered,
        method: method,
        idempotency_key: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('pay_' + Date.now()),
      });

      bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
      this.loadTables();

      showToast(`Pagamentu susesu $${payment.amount}! Troku $${payment.change_amount}`, 'success');
      SoundEffects.playSuccess();

      this.showReceiptModal(payment);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
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
      showToast(e.message || 'Resibu la hetan.', 'error');
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
            margin: 0mm !important;
          }
          html, body {
            margin: 0;
            padding: 6px;
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
    if (!confirm(`Taka sesi meza ba ${tableName}? (Garante katak pagamentu hotu remata ona)`)) return;
    try {
      await apiPost(`/api/v1/cashier/table-sessions/${sessionId}/close/`);
      this.loadTables();
      showToast(`Sesi taka ona ba ${tableName}.`, 'info');
      SoundEffects.playBell();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  initWebSocket() {
    this.ws = new WebSocketClient('/ws/cashier/', (msg) => {
      console.log('Cashier WS update:', msg);
      if (msg.event === 'TABLE_ACTIVATION_REQUESTED') {
        SoundEffects.playBell();
        showToast(`🔔 Meza ${msg.data.table_name || msg.data.table_code} husu atu loke sesi!`, 'warning');
        this.loadActivationRequests();
        this.loadTables();
      } else if (msg.event === 'NEW_ORDER_WAITING' || msg.event === 'ORDER_CREATED') {
        SoundEffects.playBell();
        showToast(`🔔 Pedidu foun ${msg.data.order_code} - ${msg.data.table_name || msg.data.table_code}!`, 'warning');
        this.loadPendingOrders();
      } else if (msg.event === 'BILL_REQUESTED') {
        SoundEffects.playBell();
        showToast(`💳 Husu konta hosi ${msg.data.table_name || msg.data.table_code}!`, 'info');
        this.loadTables();
      } else if (msg.event === 'SESSION_OPENED' || msg.event === 'SESSION_CLOSED' || msg.event === 'PAYMENT_COMPLETED') {
        this.loadActivationRequests();
        this.loadTables();
      }
    });
  }
}

