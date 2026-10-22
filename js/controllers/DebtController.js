/**
 * Controlador de Cuentas por Cobrar y Motor FIFO (DebtController)
 * Exclusivo para rol Admin: Permite filtrar notas con estatus "Pendiente" por cliente
 * y aplicar Abonos Globales Inteligentes bajo el método FIFO (First In, First Out).
 */
export class DebtController {
    /**
     * @param {Object} params
     * @param {import('../services/FinanceService.js').FinanceService} params.financeService
     * @param {import('../services/StoreService.js').StoreService} params.storeService
     * @param {import('./UIController.js').UIController} params.uiController
     * @param {Function} [params.onDebtUpdated] - Callback tras aplicar abonos FIFO
     */
    constructor({ financeService, storeService, uiController, onDebtUpdated }) {
        this.financeService = financeService;
        this.storeService = storeService;
        this.uiController = uiController;
        this.onDebtUpdated = onDebtUpdated;

        this.selectedClient = 'todos';

        // Referencias del DOM
        this.clientFilterSelect = document.getElementById('cxc-client-filter');
        this.pendingOrdersTbody = document.getElementById('cxc-pending-tbody');
        this.totalDebtBanner = document.getElementById('cxc-total-debt');
        this.totalNotesBanner = document.getElementById('cxc-total-notes');

        // Formulario de Abono Global Inteligente (FIFO)
        this.fifoForm = document.getElementById('cxc-fifo-form');
        this.fifoAmountInput = document.getElementById('cxc-fifo-amount');
        this.fifoMethodSelect = document.getElementById('cxc-fifo-method');
        this.fifoTargetClientLabel = document.getElementById('cxc-fifo-target-client');
        this.fifoSubmitBtn = document.getElementById('cxc-fifo-submit-btn');
        this.fifoLogContainer = document.getElementById('cxc-fifo-result-log');

        this._bindEvents();
    }

    /**
     * Inicializa y renderiza la vista de Cuentas por Cobrar
     */
    init() {
        this.renderClientFilter();
        this.renderPendingTable();
    }

    /**
     * Configura eventos del selector de cliente y del motor de Abono Global FIFO
     * @private
     */
    _bindEvents() {
        if (this.clientFilterSelect) {
            this.clientFilterSelect.addEventListener('change', event => {
                this.selectedClient = event.target.value;
                this.renderPendingTable();
            });
        }

        if (this.fifoForm) {
            this.fifoForm.addEventListener('submit', event => {
                event.preventDefault();
                this._handleApplyFIFOPayment();
            });
        }

        // Botones de monto rápido ($100, $200, $500, Liquidar Todo)
        document.querySelectorAll('[data-fifo-quick-amount]').forEach(btn => {
            btn.addEventListener('click', () => {
                const rawVal = btn.getAttribute('data-fifo-quick-amount');
                if (!this.fifoAmountInput) return;

                if (rawVal === 'all') {
                    const pendingOrders = this.financeService.getPendingOrdersFIFO(this.selectedClient);
                    const total = pendingOrders.reduce((acc, o) => acc + o.saldoPendiente, 0);
                    this.fifoAmountInput.value = total > 0 ? total.toFixed(2) : '';
                } else {
                    this.fifoAmountInput.value = rawVal;
                }
            });
        });
    }

    /**
     * Actualiza el selector de filtro de clientes con deudas activas
     */
    renderClientFilter() {
        if (!this.clientFilterSelect) return;

        const debtors = this.financeService.getDebtorsSummary();
        const previousSelection = this.selectedClient;

        const optionsHtml = [
            `<option value="todos">Todos los clientes con saldo pendiente (${debtors.length})</option>`
        ];

        debtors.forEach(d => {
            const isSelected = d.clienteNombre.toLowerCase() === previousSelection.toLowerCase();
            optionsHtml.push(
                `<option value="${d.clienteNombre}" ${isSelected ? 'selected' : ''}>
                    ${d.clienteNombre} — ${d.notasPendientes} nota(s) (${this.uiController.formatCurrency(d.deudaTotal)})
                </option>`
            );
        });

        this.clientFilterSelect.innerHTML = optionsHtml.join('');

        // Si el cliente seleccionado ya liquidó toda su deuda, volver a 'todos' o al primer deudor
        const stillHasDebt = debtors.some(
            d => d.clienteNombre.toLowerCase() === previousSelection.toLowerCase()
        );
        if (previousSelection !== 'todos' && !stillHasDebt) {
            this.selectedClient = debtors.length > 0 ? debtors[0].clienteNombre : 'todos';
            this.clientFilterSelect.value = this.selectedClient;
        } else if (previousSelection === 'todos' && debtors.length > 0) {
            // Seleccionar por defecto el primer cliente con deuda para facilitar la prueba inmediata del motor FIFO
            this.selectedClient = debtors[0].clienteNombre;
            this.clientFilterSelect.value = this.selectedClient;
        }
    }

    /**
     * Renderiza las notas pendientes ordenadas cronológicamente (Más antiguas primero - FIFO)
     */
    renderPendingTable() {
        if (!this.pendingOrdersTbody) return;

        const pendingOrders = this.financeService.getPendingOrdersFIFO(this.selectedClient);
        const deudaTotal = pendingOrders.reduce((acc, o) => acc + o.saldoPendiente, 0);

        if (this.totalDebtBanner) {
            this.totalDebtBanner.textContent = this.uiController.formatCurrency(deudaTotal);
        }
        if (this.totalNotesBanner) {
            this.totalNotesBanner.textContent = `${pendingOrders.length} nota(s) pendiente(s)`;
        }

        // Actualizar estado del panel de Abono Global FIFO
        const canApplyFIFO = this.selectedClient !== 'todos' && pendingOrders.length > 0;
        if (this.fifoTargetClientLabel) {
            this.fifoTargetClientLabel.textContent = canApplyFIFO
                ? `${this.selectedClient} (Deuda: ${this.uiController.formatCurrency(deudaTotal)})`
                : 'Seleccione un cliente específico en el filtro superior';
        }
        if (this.fifoSubmitBtn) {
            this.fifoSubmitBtn.disabled = !canApplyFIFO;
        }

        if (pendingOrders.length === 0) {
            this.pendingOrdersTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-10 text-slate-400">
                        🎉 No existen notas con estatus "Pendiente" para el criterio seleccionado.
                    </td>
                </tr>
            `;
            return;
        }

        this.pendingOrdersTbody.innerHTML = pendingOrders
            .map((order, idx) => {
                const fechaStr = new Date(order.fecha).toLocaleString('es-MX', {
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const fifoPriorityBadge = idx === 0
                    ? `<span class="badge badge-info badge-xs font-bold text-cyan-950 mr-1">1ª en cola FIFO</span>`
                    : `<span class="badge badge-ghost badge-xs mr-1">#${idx + 1} FIFO</span>`;

                return `
                    <tr class="responsive-row hover:bg-cyan-50/40 border-b border-slate-100">
                        <td data-label="Folio / Prioridad" class="font-mono font-bold text-cyan-800">
                            <div>${order.folio}</div>
                            <div class="mt-0.5">${fifoPriorityBadge}</div>
                        </td>
                        <td data-label="Fecha Emisión" class="text-xs text-slate-600 whitespace-nowrap">${fechaStr}</td>
                        <td data-label="Cliente / Ruta">
                            <div class="font-bold text-slate-800">${order.clienteNombre}</div>
                            <div class="text-xs text-slate-400">Ruta: ${order.repartidor}</div>
                        </td>
                        <td data-label="Total Nota" class="text-right font-semibold text-slate-700 tabular-nums">
                            ${this.uiController.formatCurrency(order.total)}
                        </td>
                        <td data-label="Abonado" class="text-right font-semibold text-emerald-600 tabular-nums">
                            ${this.uiController.formatCurrency(order.montoAbonado)}
                        </td>
                        <td data-label="Saldo Pendiente" class="text-right font-extrabold text-amber-600 text-base tabular-nums">
                            ${this.uiController.formatCurrency(order.saldoPendiente)}
                        </td>
                        <td data-label="Acción" class="text-right">
                            <button type="button"
                                data-cxc-select-client="${order.clienteNombre}"
                                class="btn btn-xs sm:btn-sm md:btn-xs bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 font-semibold">
                                Enfocar Cliente
                            </button>
                        </td>
                    </tr>
                `;
            })
            .join('');

        // Permitir enfocar un cliente haciendo clic en su fila
        this.pendingOrdersTbody.querySelectorAll('[data-cxc-select-client]').forEach(btn => {
            btn.addEventListener('click', () => {
                const clientName = btn.getAttribute('data-cxc-select-client');
                this.selectedClient = clientName;
                if (this.clientFilterSelect) {
                    this.clientFilterSelect.value = clientName;
                }
                this.renderPendingTable();
                if (window.innerWidth < 1024 && this.fifoForm) {
                    this.fifoForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });
    }

    /**
     * Ejecuta el Abono Global Inteligente (FIFO) a través de FinanceService
     * @private
     */
    _handleApplyFIFOPayment() {
        if (!this.selectedClient || this.selectedClient === 'todos') {
            this.uiController.showToast('Selecciona un cliente específico para aplicar el Abono Global FIFO.', 'warning');
            return;
        }

        const monto = Number(this.fifoAmountInput?.value || 0);
        const metodoPago = this.fifoMethodSelect?.value || 'Efectivo';

        try {
            const resultado = this.financeService.procesarAbonoGlobalFIFO(
                this.selectedClient,
                monto,
                metodoPago
            );

            if (this.fifoAmountInput) this.fifoAmountInput.value = '';
            this._renderFIFOResultSummary(resultado);

            this.renderClientFilter();
            this.renderPendingTable();
            this.uiController.updatePendingBadge();

            if (typeof this.onDebtUpdated === 'function') {
                this.onDebtUpdated();
            }

            this.uiController.showToast(
                `Abono FIFO de ${this.uiController.formatCurrency(resultado.montoAplicadoTotal)} aplicado con éxito a ${resultado.notasAfectadas.length} nota(s).`,
                'success'
            );
        } catch (err) {
            this.uiController.showToast(err.message, 'error');
        }
    }

    /**
     * Muestra en pantalla el desglose matemático de cómo el motor FIFO distribuyó el abono
     * @private
     * @param {Object} resultado
     */
    _renderFIFOResultSummary(resultado) {
        if (!this.fifoLogContainer) return;

        const itemsHtml = resultado.notasAfectadas
            .map(n => `
                <li class="flex items-center justify-between text-xs py-1.5 border-b border-cyan-100 last:border-none">
                    <div>
                        <span class="font-mono font-bold text-cyan-900">${n.folio}</span>
                        <span class="text-slate-500 ml-1">(Saldo ant: ${this.uiController.formatCurrency(n.saldoAnterior)})</span>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-emerald-700">Abono: -${this.uiController.formatCurrency(n.abonoAplicado)}</span>
                        <span class="ml-2 badge badge-xs ${n.nuevoEstatus === 'Pagado' ? 'badge-success text-emerald-950' : 'badge-warning text-amber-950'} font-bold">
                            ${n.nuevoEstatus} (Resta: ${this.uiController.formatCurrency(n.nuevoSaldo)})
                        </span>
                    </div>
                </li>
            `)
            .join('');

        const cambioHtml = resultado.cambioSobrante > 0
            ? `<div class="mt-2 p-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold">
                💵 Remanente / Cambio a devolver al cliente: ${this.uiController.formatCurrency(resultado.cambioSobrante)}
               </div>`
            : '';

        this.fifoLogContainer.innerHTML = `
            <div class="p-3.5 rounded-xl bg-cyan-50/90 border border-cyan-200 mt-4">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-xs font-extrabold uppercase tracking-wider text-cyan-900">
                        ⚡ Desglose de Aplicación FIFO (${resultado.clienteNombre})
                    </h4>
                    <span class="text-xs font-bold text-cyan-800">
                        Ingresado: ${this.uiController.formatCurrency(resultado.montoIngresado)}
                    </span>
                </div>
                <ul class="divide-y divide-cyan-100">${itemsHtml}</ul>
                ${cambioHtml}
            </div>
        `;
    }
}
