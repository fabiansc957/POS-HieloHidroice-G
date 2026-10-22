/**
 * Controlador de Interfaz de Usuario (UIController)
 * Gestiona pestañas de navegación, RBAC en el DOM, notificaciones Toast (daisyUI),
 * modal de Corte de Caja Diario e impresión de tickets térmicos.
 */
export class UIController {
    /**
     * @param {Object} params
     * @param {import('../services/AuthService.js').AuthService} params.authService
     * @param {import('../services/FinanceService.js').FinanceService} params.financeService
     * @param {import('../services/StoreService.js').StoreService} params.storeService
     */
    constructor({ authService, financeService, storeService }) {
        this.authService = authService;
        this.financeService = financeService;
        this.storeService = storeService;

        // Guardamos referencias y plantillas de elementos restringidos para poder destruirlos del DOM
        // cuando entra un Cajero y reconstruirlos si cambia a Admin sin recargar.
        this.adminNavbarSlot = document.getElementById('admin-navbar-slot');
        this.adminTabsSlot = document.getElementById('admin-tabs-slot');
        this.viewPos = document.getElementById('view-pos');
        this.viewCxc = document.getElementById('view-cxc');
        this.tabPosBtn = document.getElementById('tab-btn-pos');

        this.activeTab = 'pos';
        this.onTabChangedCallbacks = [];

        this._initThemeAndLayoutPreferences();
        this._bindBaseEvents();
    }

    /**
     * Inicializa y restaura la propuesta de estilo UI y posición del Ticket Rápido
     * @private
     */
    _initThemeAndLayoutPreferences() {
        const savedStyle = localStorage.getItem('hidroice_ui_style_v1') || 'glaciar';
        const savedTicketSide = localStorage.getItem('hidroice_ticket_side_v1') || 'right';

        this.setUIStyle(savedStyle, false);
        if (savedTicketSide === 'left') {
            document.body.classList.add('layout-ticket-left');
        }
    }

    /**
     * Cambia entre las 3 propuestas de diseño UI ('clasico' | 'glaciar' | 'industrial-dark')
     * @param {string} styleName
     * @param {boolean} [notify=true]
     */
    setUIStyle(styleName, notify = true) {
        const validStyles = ['clasico', 'glaciar', 'industrial-dark'];
        const chosen = validStyles.includes(styleName) ? styleName : 'glaciar';

        document.body.setAttribute('data-ui-style', chosen);
        localStorage.setItem('hidroice_ui_style_v1', chosen);

        document.querySelectorAll('[data-ui-theme-btn]').forEach(btn => {
            const btnStyle = btn.getAttribute('data-ui-theme-btn');
            if (btnStyle === chosen) {
                btn.className = 'btn btn-xs bg-cyan-600 text-white border-none rounded-lg font-bold shadow-xs';
            } else {
                btn.className = 'btn btn-xs btn-ghost text-slate-600 rounded-lg font-semibold';
            }
        });

        if (notify) {
            const labels = {
                clasico: 'Propuesta 1: Clásico Institucional',
                glaciar: 'Propuesta 2: Glaciar Ejecutivo (Bento & Cristal)',
                'industrial-dark': 'Propuesta 3: Terminal Industrial Nocturna (High-Contrast)'
            };
            this.showToast(`Estilo activo: ${labels[chosen]}`, 'info');
        }
    }

    /**
     * Alterna la posición del Ticket Rápido entre Izquierda y Derecha para ergonomía del cajero
     */
    toggleTicketPosition() {
        const isLeft = document.body.classList.toggle('layout-ticket-left');
        localStorage.setItem('hidroice_ticket_side_v1', isLeft ? 'left' : 'right');
        this.showToast(
            isLeft ? 'Ticket Rápido acoplado a la izquierda' : 'Ticket Rápido acoplado a la derecha',
            'info'
        );
    }

    /**
     * Registra un callback que se ejecuta cada vez que cambia la pestaña activa
     * @param {Function} callback
     */
    onTabChange(callback) {
        this.onTabChangedCallbacks.push(callback);
    }

    /**
     * Inicializa eventos globales de navegación, selector de propuestas UI y corte de caja
     * @private
     */
    _bindBaseEvents() {
        if (this.tabPosBtn) {
            this.tabPosBtn.addEventListener('click', () => this.switchTab('pos'));
        }

        // Eventos para el selector de Propuestas de UI
        document.querySelectorAll('[data-ui-theme-btn]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setUIStyle(btn.getAttribute('data-ui-theme-btn'), true);
            });
        });

        // Evento para invertir posición del Ticket Rápido (Izq/Der)
        const btnToggleSide = document.getElementById('btn-toggle-ticket-side');
        if (btnToggleSide) {
            btnToggleSide.addEventListener('click', () => this.toggleTicketPosition());
        }

        const btnCloseCashCut = document.getElementById('btn-close-cash-cut');
        if (btnCloseCashCut) {
            btnCloseCashCut.addEventListener('click', () => {
                const modal = document.getElementById('modal-cash-cut');
                if (modal) modal.close();
            });
        }

        const btnPrintCashCut = document.getElementById('btn-print-cash-cut');
        if (btnPrintCashCut) {
            btnPrintCashCut.addEventListener('click', () => {
                this.imprimirCorteDeCaja();
            });
        }
    }

    /**
     * Aplica las políticas RBAC directamente en el DOM.
     * Si el rol es "Cajero", destruye del DOM la pestaña "Cuentas por Cobrar",
     * la vista de Cuentas por Cobrar y el botón de "Corte de Caja Diario".
     * @param {Object} user
     */
    applyRBAC(user) {
        const badgeUser = document.getElementById('nav-user-badge');
        const nameUser = document.getElementById('nav-user-name');

        if (nameUser) nameUser.textContent = user.displayName;
        if (badgeUser) {
            badgeUser.textContent = user.role.toUpperCase();
            badgeUser.className = user.role === 'Admin'
                ? 'badge badge-info badge-sm font-bold tracking-wider text-cyan-950'
                : 'badge badge-ghost badge-sm font-semibold';
        }

        if (user.role === 'Admin') {
            this._mountAdminElements();
        } else {
            // Rol Cajero: Destruir/eliminar del DOM los accesos de Cuentas por Cobrar y Corte de Caja Diario
            this._destroyAdminElements();
            this.switchTab('pos');
        }
    }

    /**
     * Monta en el DOM los controles exclusivos de Administrador
     * @private
     */
    _mountAdminElements() {
        if (this.adminTabsSlot) {
            this.adminTabsSlot.innerHTML = `
                <button id="tab-btn-cxc" type="button" role="tab"
                    class="tab gap-1.5 font-semibold transition-all duration-200 text-slate-600 hover:text-cyan-700 h-9 sm:h-8 text-xs sm:text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Cuentas por Cobrar (FIFO)</span>
                    <span id="cxc-nav-counter" class="badge badge-warning badge-xs font-bold">0</span>
                </button>
            `;
            const tabCxcBtn = document.getElementById('tab-btn-cxc');
            if (tabCxcBtn) {
                tabCxcBtn.addEventListener('click', () => this.switchTab('cxc'));
            }
        }

        if (this.adminNavbarSlot) {
            this.adminNavbarSlot.innerHTML = `
                <button id="btn-open-cash-cut" type="button"
                    class="btn btn-xs sm:btn-sm bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-none font-bold shadow-sm gap-1.5 px-2.5 sm:px-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span class="hidden md:inline">Corte de Caja Diario</span>
                    <span class="md:hidden">Corte Caja</span>
                </button>
            `;
            const btnCashCut = document.getElementById('btn-open-cash-cut');
            if (btnCashCut) {
                btnCashCut.addEventListener('click', () => this.openCashCutModal());
            }
        }
    }

    /**
     * Destruye del DOM los elementos restringidos para el rol Cajero
     * @private
     */
    _destroyAdminElements() {
        const existingTabCxc = document.getElementById('tab-btn-cxc');
        if (existingTabCxc) existingTabCxc.remove();

        const existingBtnCashCut = document.getElementById('btn-open-cash-cut');
        if (existingBtnCashCut) existingBtnCashCut.remove();

        if (this.adminTabsSlot) this.adminTabsSlot.innerHTML = '';
        if (this.adminNavbarSlot) this.adminNavbarSlot.innerHTML = '';

        // Asegurar que la sección de Cuentas por Cobrar quede oculta e inaccesible
        if (this.viewCxc) {
            this.viewCxc.classList.add('hidden');
        }
    }

    /**
     * Cambia entre la vista de POS y Cuentas por Cobrar (validando permisos RBAC)
     * @param {'pos'|'cxc'} tabName
     */
    switchTab(tabName) {
        if (tabName === 'cxc' && !this.authService.isAdmin()) {
            this.showToast('Acceso restringido: Solo Administradores pueden consultar Cuentas por Cobrar.', 'error');
            return;
        }

        this.activeTab = tabName;
        const tabCxcBtn = document.getElementById('tab-btn-cxc');
        const mobileJumpbar = document.getElementById('mobile-pos-jumpbar');
        const mobileBottomBar = document.getElementById('mobile-bottom-bar');

        if (tabName === 'pos') {
            this.viewPos?.classList.remove('hidden');
            this.viewCxc?.classList.add('hidden');
            mobileJumpbar?.classList.remove('hidden');
            mobileBottomBar?.classList.remove('hidden');

            if (this.tabPosBtn) {
                this.tabPosBtn.classList.add('tab-active', 'bg-cyan-600', 'text-white');
                this.tabPosBtn.classList.remove('text-slate-600');
            }
            if (tabCxcBtn) {
                tabCxcBtn.classList.remove('tab-active', 'bg-cyan-600', 'text-white');
                tabCxcBtn.classList.add('text-slate-600');
            }
        } else if (tabName === 'cxc') {
            this.viewPos?.classList.add('hidden');
            this.viewCxc?.classList.remove('hidden');
            mobileJumpbar?.classList.add('hidden');
            mobileBottomBar?.classList.add('hidden');

            if (tabCxcBtn) {
                tabCxcBtn.classList.add('tab-active', 'bg-cyan-600', 'text-white');
                tabCxcBtn.classList.remove('text-slate-600');
            }
            if (this.tabPosBtn) {
                this.tabPosBtn.classList.remove('tab-active', 'bg-cyan-600', 'text-white');
                this.tabPosBtn.classList.add('text-slate-600');
            }
        }

        this.onTabChangedCallbacks.forEach(cb => cb(tabName));
    }

    /**
     * Actualiza el contador de notas pendientes en la pestaña de Cuentas por Cobrar
     * y refresca el Bento Ribbon de KPIs en vivo.
     */
    updatePendingBadge() {
        this.updateKpiRibbon();
        const badge = document.getElementById('cxc-nav-counter');
        if (!badge) return;
        const count = this.financeService.getPendingOrdersFIFO().length;
        badge.textContent = String(count);
    }

    /**
     * Actualiza las 4 tarjetas superiores del Bento Ribbon de KPIs en tiempo real
     */
    updateKpiRibbon() {
        const corte = this.financeService.generarCorteDiario();

        const elVentaNeta = document.getElementById('kpi-venta-neta');
        const elOpCount = document.getElementById('kpi-operaciones-count');
        const elCobradoHoy = document.getElementById('kpi-cobrado-hoy');
        const elCobradoSplit = document.getElementById('kpi-cobrado-split');
        const elPendienteHoy = document.getElementById('kpi-pendiente-hoy');
        const elPendienteNotes = document.getElementById('kpi-pendiente-notes');
        const elUnidadesHoy = document.getElementById('kpi-unidades-hoy');
        const elDevolucionesHoy = document.getElementById('kpi-devoluciones-hoy');

        if (elVentaNeta) elVentaNeta.textContent = this.formatCurrency(corte.financiero.ventaTotalBrutaHoy);
        if (elOpCount) elOpCount.textContent = `${corte.financiero.totalOperacionesHoy} nota(s) registradas hoy`;
        if (elCobradoHoy) elCobradoHoy.textContent = this.formatCurrency(corte.financiero.totalIngresadoCaja);
        if (elCobradoSplit) {
            elCobradoSplit.textContent = `Efec: ${this.formatCurrency(corte.financiero.efectivoFisico)} | Transf: ${this.formatCurrency(corte.financiero.transferenciasBancarias)}`;
        }
        if (elPendienteHoy) elPendienteHoy.textContent = this.formatCurrency(corte.financiero.creditoPorCobrarHoy);
        if (elPendienteNotes) elPendienteNotes.textContent = `${corte.financiero.operacionesPendientes} nota(s) por liquidar`;
        if (elUnidadesHoy) elUnidadesHoy.textContent = `${corte.inventario.totales.netas} pzas`;
        if (elDevolucionesHoy) {
            elDevolucionesHoy.textContent = `${corte.inventario.totales.devueltas} devuelta(s) de ${corte.inventario.totales.salida} salidas`;
        }
    }

    /**
     * Abre el modal de Corte de Caja Diario (Solo Admin)
     */
    openCashCutModal() {
        if (!this.authService.isAdmin()) {
            this.showToast('Permiso denegado. Función exclusiva para Administradores.', 'error');
            return;
        }

        const corte = this.financeService.generarCorteDiario();
        const modal = document.getElementById('modal-cash-cut');
        if (!modal) return;

        // Poblar datos financieros
        document.getElementById('corte-fecha').textContent = corte.fechaCorte;
        document.getElementById('corte-efectivo').textContent = this.formatCurrency(corte.financiero.efectivoFisico);
        document.getElementById('corte-transferencia').textContent = this.formatCurrency(corte.financiero.transferenciasBancarias);
        document.getElementById('corte-total-caja').textContent = this.formatCurrency(corte.financiero.totalIngresadoCaja);
        document.getElementById('corte-credito-hoy').textContent = this.formatCurrency(corte.financiero.creditoPorCobrarHoy);
        document.getElementById('corte-operaciones-resumen').textContent =
            `${corte.financiero.totalOperacionesHoy} notas hoy (${corte.financiero.operacionesPagadas} pagadas / ${corte.financiero.operacionesPendientes} pendientes)`;

        // Poblar tabla de Corte de Inventario Neto
        const tbody = document.getElementById('corte-inventario-tbody');
        if (tbody) {
            tbody.innerHTML = corte.inventario.productos
                .map(prod => `
                    <tr class="hover:bg-slate-50 border-b border-slate-100">
                        <td class="font-medium text-slate-800">${prod.nombre}</td>
                        <td class="text-right text-slate-600">${this.formatCurrency(prod.precio)}</td>
                        <td class="text-center font-semibold text-slate-700">${prod.unidadesSalida}</td>
                        <td class="text-center font-semibold ${prod.unidadesDevueltas > 0 ? 'text-amber-600' : 'text-slate-400'}">
                            ${prod.unidadesDevueltas > 0 ? `-${prod.unidadesDevueltas}` : '0'}
                        </td>
                        <td class="text-center">
                            <span class="badge badge-info badge-sm font-bold text-cyan-950">${prod.unidadesNetas}</span>
                        </td>
                        <td class="text-right font-bold text-cyan-900">${this.formatCurrency(prod.importeNeto)}</td>
                    </tr>
                `)
                .join('');
        }

        document.getElementById('corte-inv-total-salida').textContent = corte.inventario.totales.salida;
        document.getElementById('corte-inv-total-dev').textContent = corte.inventario.totales.devueltas;
        document.getElementById('corte-inv-total-neto').textContent = corte.inventario.totales.netas;
        document.getElementById('corte-inv-importe-total').textContent = this.formatCurrency(corte.financiero.ventaTotalBrutaHoy);

        modal.showModal();
    }

    /**
     * Genera la vista de impresión térmica (58mm/80mm) para una Orden de Venta y dispara window.print()
     * @param {import('../models/Order.js').Order} order
     */
    imprimirTicketOrden(order) {
        const printContainer = document.getElementById('thermal-print-area');
        if (!printContainer || !order) return;

        const fechaStr = new Date(order.fecha).toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const filasProductos = order.items
            .map(item => {
                const neta = Math.max(0, Number(item.cantidadSalida) - Number(item.cantidadDevuelta));
                const subtotal = neta * Number(item.precio);
                const leyendaDev = item.cantidadDevuelta > 0
                    ? `<div class="thermal-subtext">(Salida: ${item.cantidadSalida} | Dev: -${item.cantidadDevuelta})</div>`
                    : '';
                return `
                    <tr>
                        <td class="thermal-col-qty">${neta}</td>
                        <td class="thermal-col-desc">
                            <div>${item.nombre}</div>
                            <div class="thermal-subtext">@ ${this.formatCurrency(item.precio)} c/u</div>
                            ${leyendaDev}
                        </td>
                        <td class="thermal-col-price">${this.formatCurrency(subtotal)}</td>
                    </tr>
                `;
            })
            .join('');

        printContainer.innerHTML = `
            <div class="thermal-ticket">
                <div class="thermal-header">
                    <div class="thermal-logo-box">❄️ HIELO HIDROICE</div>
                    <div class="thermal-subtitle">Purificadora y Fábrica de Hielo Cilíndrico</div>
                    <div class="thermal-address">Aguascalientes, Ags., México</div>
                    <div class="thermal-address">Tel: (449) 915-8000 | RFC: HHI210415AGS</div>
                </div>

                <div class="thermal-divider"></div>

                <div class="thermal-meta">
                    <div><strong>FOLIO:</strong> ${order.folio}</div>
                    <div><strong>FECHA:</strong> ${fechaStr}</div>
                    <div><strong>CLIENTE:</strong> ${order.clienteNombre}</div>
                    <div><strong>RUTA/REP:</strong> ${order.repartidor}</div>
                    <div><strong>PAGO:</strong> ${order.metodoPago.toUpperCase()}</div>
                    <div><strong>ESTATUS:</strong> ${order.estatus.toUpperCase()}</div>
                </div>

                <div class="thermal-divider"></div>

                <table class="thermal-table">
                    <thead>
                        <tr>
                            <th class="thermal-col-qty">CANT</th>
                            <th class="thermal-col-desc">PRODUCTO</th>
                            <th class="thermal-col-price">IMPORTE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasProductos}
                    </tbody>
                </table>

                <div class="thermal-divider"></div>

                <div class="thermal-totals">
                    <div class="thermal-total-row thermal-grand-total">
                        <span>TOTAL NETO:</span>
                        <span>${this.formatCurrency(order.total)}</span>
                    </div>
                    <div class="thermal-total-row">
                        <span>ABONADO:</span>
                        <span>${this.formatCurrency(order.montoAbonado)}</span>
                    </div>
                    <div class="thermal-total-row">
                        <span>SALDO PENDIENTE:</span>
                        <span>${this.formatCurrency(order.saldoPendiente)}</span>
                    </div>
                </div>

                <div class="thermal-divider"></div>

                <div class="thermal-footer">
                    <p>¡Gracias por su preferencia!</p>
                    <p>Calidad y pureza cristalina en cada bolsa</p>
                    <p>*** COPIA CLIENTE / RUTA ***</p>
                </div>
            </div>
        `;

        window.print();
    }

    /**
     * Imprime el reporte de Corte de Caja Diario en formato térmico
     */
    imprimirCorteDeCaja() {
        const corte = this.financeService.generarCorteDiario();
        const printContainer = document.getElementById('thermal-print-area');
        if (!printContainer) return;

        const filasInv = corte.inventario.productos
            .map(p => `
                <tr>
                    <td class="thermal-col-desc">${p.nombre}</td>
                    <td class="thermal-col-qty">${p.unidadesSalida}/${p.unidadesDevueltas}</td>
                    <td class="thermal-col-price">${p.unidadesNetas} (${this.formatCurrency(p.importeNeto)})</td>
                </tr>
            `)
            .join('');

        printContainer.innerHTML = `
            <div class="thermal-ticket">
                <div class="thermal-header">
                    <div class="thermal-logo-box">❄️ HIELO HIDROICE</div>
                    <div class="thermal-subtitle">CORTE DE CAJA E INVENTARIO DIARIO</div>
                    <div class="thermal-address">Aguascalientes, Ags.</div>
                    <div class="thermal-address">${corte.fechaCorte}</div>
                </div>

                <div class="thermal-divider"></div>

                <div class="thermal-meta">
                    <div><strong>ARQUEO FINANCIERO</strong></div>
                    <div>💵 Efectivo Físico: ${this.formatCurrency(corte.financiero.efectivoFisico)}</div>
                    <div>📱 Transferencias: ${this.formatCurrency(corte.financiero.transferenciasBancarias)}</div>
                    <div><strong>TOTAL EN CAJA: ${this.formatCurrency(corte.financiero.totalIngresadoCaja)}</strong></div>
                    <div>Crédito Hoy (CxC): ${this.formatCurrency(corte.financiero.creditoPorCobrarHoy)}</div>
                </div>

                <div class="thermal-divider"></div>

                <table class="thermal-table">
                    <thead>
                        <tr>
                            <th class="thermal-col-desc">PROD</th>
                            <th class="thermal-col-qty">S/D</th>
                            <th class="thermal-col-price">NETO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasInv}
                    </tbody>
                </table>

                <div class="thermal-divider"></div>
                <div class="thermal-footer">
                    <p>Unidades Netas Vendidas: ${corte.inventario.totales.netas}</p>
                    <p>Firma Cajero / Administrador</p>
                </div>
            </div>
        `;

        window.print();
    }

    /**
     * Muestra una notificación Toast de daisyUI (sin usar alert() nativo)
     * @param {string} message
     * @param {'success'|'info'|'warning'|'error'} [type='info']
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const alertClassMap = {
            success: 'alert-success text-slate-950',
            info: 'alert-info text-slate-950',
            warning: 'alert-warning text-slate-950',
            error: 'alert-error text-white'
        };

        const toastEl = document.createElement('div');
        toastEl.className = `alert ${alertClassMap[type] || alertClassMap.info} shadow-lg border border-white/20 py-3 px-4 flex items-center gap-2 transition-all duration-300 text-sm font-medium`;
        toastEl.innerHTML = `
            <span>${message}</span>
        `;

        container.appendChild(toastEl);

        setTimeout(() => {
            toastEl.classList.add('opacity-0', 'translate-x-4');
            setTimeout(() => toastEl.remove(), 300);
        }, 3600);
    }

    /**
     * Formateador auxiliar de moneda MXN
     * @param {number} amount
     * @returns {string}
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(Number(amount) || 0);
    }
}
