/**
 * Kitchen Display System (KDS) Controller
 */

class KitchenKDSApp {
  constructor() {
    this.orders = [];
    this.activeMobileTab = 'CONFIRMED';
    this.init();
  }

  init() {
    this.loadQueue();
    this.initWebSocket();

    window.addEventListener('languageChanged', () => this.renderKDS());
    window.addEventListener('resize', () => this.applyMobileVisibility());

    // Ticker timer update every second
    setInterval(() => this.updateElapsedTimers(), 1000);

    // Polling fallback every 6 seconds
    setInterval(() => this.loadQueue(), 6000);
  }

  async loadQueue() {
    try {
      this.orders = await apiGet('/api/v1/kitchen/orders/');
      this.renderKDS();
    } catch (e) {
      console.error('Error loading kitchen queue:', e);
    }
  }

  renderKDS() {
    const colConfirmed = document.getElementById('kds-confirmed-col');
    const colPreparing = document.getElementById('kds-preparing-col');
    const colReady = document.getElementById('kds-ready-col');

    if (!colConfirmed || !colPreparing || !colReady) return;

    const confirmedOrders = this.orders.filter((o) => o.status === 'CONFIRMED');
    const preparingOrders = this.orders.filter((o) => o.status === 'PREPARING');
    const readyOrders = this.orders.filter((o) => o.status === 'READY');

    document.getElementById('count-confirmed').textContent = confirmedOrders.length;
    document.getElementById('count-preparing').textContent = preparingOrders.length;
    document.getElementById('count-ready').textContent = readyOrders.length;

    const countConfirmedM = document.getElementById('count-confirmed-m');
    const countPreparingM = document.getElementById('count-preparing-m');
    const countReadyM = document.getElementById('count-ready-m');
    if (countConfirmedM) countConfirmedM.textContent = confirmedOrders.length;
    if (countPreparingM) countPreparingM.textContent = preparingOrders.length;
    if (countReadyM) countReadyM.textContent = readyOrders.length;

    colConfirmed.innerHTML = confirmedOrders.map((o) => this.renderCard(o, 'CONFIRMED')).join('');
    colPreparing.innerHTML = preparingOrders.map((o) => this.renderCard(o, 'PREPARING')).join('');
    colReady.innerHTML = readyOrders.map((o) => this.renderCard(o, 'READY')).join('');

    this.applyMobileVisibility();
  }

  switchMobileTab(status) {
    this.activeMobileTab = status;
    this.applyMobileVisibility();
  }

  applyMobileVisibility() {
    const colConf = document.getElementById('kds-col-wrapper-confirmed');
    const colPrep = document.getElementById('kds-col-wrapper-preparing');
    const colRdy = document.getElementById('kds-col-wrapper-ready');

    const btnConf = document.getElementById('btn-tab-confirmed');
    const btnPrep = document.getElementById('btn-tab-preparing');
    const btnRdy = document.getElementById('btn-tab-ready');

    if (window.innerWidth < 768) {
      if (colConf) colConf.style.display = this.activeMobileTab === 'CONFIRMED' ? 'block' : 'none';
      if (colPrep) colPrep.style.display = this.activeMobileTab === 'PREPARING' ? 'block' : 'none';
      if (colRdy) colRdy.style.display = this.activeMobileTab === 'READY' ? 'block' : 'none';

      if (btnConf) {
        btnConf.className = this.activeMobileTab === 'CONFIRMED'
          ? 'btn btn-sm btn-warning flex-fill active fw-bold rounded-pill text-dark shadow'
          : 'btn btn-sm btn-outline-warning flex-fill fw-bold rounded-pill';
      }
      if (btnPrep) {
        btnPrep.className = this.activeMobileTab === 'PREPARING'
          ? 'btn btn-sm btn-info flex-fill active fw-bold rounded-pill text-dark shadow'
          : 'btn btn-sm btn-outline-info flex-fill fw-bold rounded-pill';
      }
      if (btnRdy) {
        btnRdy.className = this.activeMobileTab === 'READY'
          ? 'btn btn-sm btn-success flex-fill active fw-bold rounded-pill text-white shadow'
          : 'btn btn-sm btn-outline-success flex-fill fw-bold rounded-pill';
      }
    } else {
      if (colConf) colConf.style.display = 'block';
      if (colPrep) colPrep.style.display = 'block';
      if (colRdy) colRdy.style.display = 'block';
    }
  }

  renderCard(order, column) {
    const isUrgent = this.getElapsedMinutes(order.confirmed_at || order.created_at) > 15;

    let actionBtn = '';
    if (column === 'CONFIRMED') {
      actionBtn = `
        <button class="btn btn-warning w-100 fw-bold py-2 mt-2 rounded-pill text-dark shadow" onclick="kdsApp.startPreparing('${order.id}')">
          <i class="fa-solid fa-fire me-1"></i> ${t('btn_start_cooking')}
        </button>
      `;
    } else if (column === 'PREPARING') {
      actionBtn = `
        <button class="btn btn-success w-100 fw-bold py-2 mt-2 rounded-pill shadow" onclick="kdsApp.markReady('${order.id}')">
          <i class="fa-solid fa-bell me-1"></i> ${t('btn_mark_ready')}
        </button>
      `;
    } else if (column === 'READY') {
      actionBtn = `
        <button class="btn btn-outline-light w-100 fw-bold py-2 mt-2 rounded-pill shadow" onclick="kdsApp.markServed('${order.id}')">
          <i class="fa-solid fa-check-double me-1"></i> ${t('btn_mark_served')}
        </button>
      `;
    }

    return `
      <div class="kds-card p-3 ${isUrgent ? 'urgent' : column === 'PREPARING' ? 'cooking' : column === 'READY' ? 'ready' : ''}" id="card-${order.id}">
        <div class="d-flex justify-content-between align-items-center mb-2 border-bottom border-secondary pb-2">
          <div>
            <h5 class="fw-bold mb-0 text-warning">${order.table_name || order.table_code}</h5>
            <small class="text-secondary">${order.order_code}</small>
          </div>
          <span class="badge bg-dark border border-secondary timer-badge" data-time="${order.confirmed_at || order.created_at}">
            <i class="fa-regular fa-clock me-1"></i> --:--
          </span>
        </div>

        <ul class="list-unstyled mb-2">
          ${order.items
            .map(
              (item) => `
            <li class="py-1 border-bottom border-dark d-flex justify-content-between align-items-start">
              <div>
                <span class="badge bg-primary fs-6 me-1">${item.quantity}x</span>
                <span class="fs-6 fw-semibold">${item.menu_name_snapshot}</span>
                ${item.note ? `<div class="badge bg-danger text-white mt-1 d-block text-start"><i class="fa-solid fa-triangle-exclamation"></i> ${item.note}</div>` : ''}
              </div>
            </li>
          `
            )
            .join('')}
        </ul>

        ${order.customer_note ? `<div class="p-2 bg-black rounded text-danger small mb-2 border border-danger"><strong>Notasaun Meza:</strong> ${order.customer_note}</div>` : ''}

        ${actionBtn}
      </div>
    `;
  }

  getElapsedMinutes(startTimeStr) {
    if (!startTimeStr) return 0;
    const diff = (Date.now() - new Date(startTimeStr).getTime()) / 60000;
    return diff;
  }

  updateElapsedTimers() {
    document.querySelectorAll('.timer-badge').forEach((badge) => {
      const startTimeStr = badge.dataset.time;
      if (!startTimeStr) return;
      const elapsedSeconds = Math.floor((Date.now() - new Date(startTimeStr).getTime()) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      badge.innerHTML = `<i class="fa-regular fa-clock me-1"></i> ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      if (minutes >= 20) {
        badge.className = 'badge bg-danger text-white timer-badge';
      } else if (minutes >= 10) {
        badge.className = 'badge bg-warning text-dark timer-badge';
      } else {
        badge.className = 'badge bg-dark border border-secondary timer-badge';
      }
    });
  }

  async startPreparing(orderId) {
    try {
      await apiPost(`/api/v1/kitchen/orders/${orderId}/start/`);
      this.loadQueue();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async markReady(orderId) {
    try {
      await apiPost(`/api/v1/kitchen/orders/${orderId}/ready/`);
      SoundEffects.playBell();
      this.loadQueue();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async markServed(orderId) {
    try {
      await apiPost(`/api/v1/kitchen/orders/${orderId}/served/`);
      this.loadQueue();
    } catch (e) {
      showToast(t(e.message), 'error');
    }
  }

  initWebSocket() {
    this.wsClient = new WebSocketClient('/ws/kitchen/', (msg) => {
      console.log('Kitchen WS update:', msg);
      if (msg.event === 'ORDER_CONFIRMED') {
        SoundEffects.playBell();
        showToast(`🔔 ${t('new_kitchen_ticket')} ${msg.data.table_name || msg.data.table_code} (${msg.data.order_code})`, 'warning');
        this.loadQueue();
      } else if (['ORDER_PREPARING', 'ORDER_READY', 'ORDER_SERVED', 'ORDER_CANCELLED'].includes(msg.event)) {
        this.loadQueue();
      }
    });
  }
}
