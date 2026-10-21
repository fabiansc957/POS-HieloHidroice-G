import { Order } from '../models/Order.js';

/**
 * Controlador del Punto de Venta y Operación de Hoy (POSController)
 * Gestiona el Catálogo de productos, el Ticket Rápido (carrito), la Tabla de Pedidos de Hoy
 * y el Modal de Devolución/Sobrante de ruta.
 */
export class POSController {
    /**
     * @param {Object} params
     * @param {import('../services/StoreService.js').StoreService} params.storeService
     * @param {import('./UIController.js').UIController} params.uiController
     * @param {Function} [params.onOrderUpdated] - Callback para notificar a otros módulos (ej. CxC)
     */
    constructor({ storeService, uiController, onOrderUpdated }) {
        this.storeService = storeService;
        this.uiController = uiController;
        this.onOrderUpdated = onOrderUpdated;

        /** @type {Map<string, {product: import('../models/Product.js').Product, cantidad: number}>} */
        this.cart = new Map();
        this.currentReturnOrderFolio = null;

        // Referencias del DOM
        this.catalogGrid = document.getElementById('pos-catalog-grid');
        this.cartItemsContainer = document.getElementById('pos-cart-items');
        this.cartTotalEl = document.getElementById('pos-cart-total');
        this.cartUnitsEl = document.getElementById('pos-cart-units');
        this.clientInput = document.getElementById('pos-client-input');
        this.clientsDatalist = document.getElementById('pos-clients-datalist');
        this.driverSelect = document.getElementById('pos-driver-select');
        this.paymentSelect = document.getElementById('pos-payment-select');
        this.statusSelect = document.getElementById('pos-status-select');
        this.ticketForm = document.getElementById('pos-ticket-form');
        this.btnClearCart = document.getElementById('btn-clear-cart');

        // Tabla de Pedidos de Hoy
        this.todayOrdersTbody = document.getElementById('pos-today-orders-tbody');
        this.todayStatsCount = document.getElementById('pos-today-count');
        this.todayStatsTotal = document.getElementById('pos-today-total');

        // Modal de Devolución / Sobrante de Ruta
        this.returnModal = document.getElementById('modal-return');
        this.returnForm = document.getElementById('form-return');
        this.returnItemsContainer = document.getElementById('return-items-container');
        this.returnOrderFolioLabel = document.getElementById('return-order-folio');
        this.returnOrderClientLabel = document.getElementById('return-order-client');
        this.returnPreviewTotal = document.getElementById('return-preview-total');
        this.btnCancelReturn = document.getElementById('btn-cancel-return');

        this._bindEvents();
    }

    /**
     * Inicializa y renderiza todos los componentes de la vista POS
     */
    init() {
        this.renderCatalog();
        this.renderClientsDatalist();
        this.renderCart();
        this.renderTodayOrders();
    }

    /**
     * Configura listeners del formulario de venta, carrito, tabla de hoy y modal de devolución
     * @private
     */
    _bindEvents() {
        if (this.ticketForm) {
            this.ticketForm.addEventListener('submit', event => {
                event.preventDefault();
                this._handleCreateOrder();
            });
        }

        if (this.btnClearCart) {
            this.btnClearCart.addEventListener('click', () => {
                this.cart.clear();
                this.renderCart();
            });
        }

        if (this.btnCancelReturn) {
            this.btnCancelReturn.addEventListener('click', () => {
                this.returnModal?.close();
            });
        }

        if (this.returnForm) {
            this.returnForm.addEventListener('submit', event => {
                event.preventDefault();
                this._handleSaveReturn();
            });
        }
    }

    /**
     * Renderiza las tarjetas del catálogo de productos de Hielo HidroIce
     */
    renderCatalog() {
        if (!this.catalogGrid) return;
        const products = this.storeService.getProducts();

        const iconMap = {
            hielo_cilindrico: `
                <div class="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-xl shadow-inner">
                    🧊
                </div>`,
            barra: `
                <div class="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shadow-inner">
                    ❄️
                </div>`,
            agua: `
                <div class="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xl shadow-inner">
                    💧
                </div>`
        };

        const badgeMap = {
            hielo_cilindrico: 'Hielo Cilíndrico',
            barra: 'Barra Industrial',
            agua: 'Agua Purificada'
        };

        this.catalogGrid.innerHTML = products
            .map(product => `
                <article
                    data-product-id="${product.id}"
                    class="group cursor-pointer rounded-2xl bg-white border border-cyan-100 hover:border-cyan-400 shadow-sm hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between select-none active:scale-[0.98]">
                    <div class="flex items-start justify-between gap-2">
                        ${iconMap[product.tipo] || iconMap.hielo_cilindrico}
                        <span class="badge badge-sm bg-cyan-50 text-cyan-800 border-cyan-200 font-semibold">
                            ${badgeMap[product.tipo] || 'Catálogo'}
                        </span>
                    </div>

                    <div class="mt-3">
                        <h3 class="font-bold text-slate-800 group-hover:text-cyan-700 transition-colors text-base leading-snug">
                            ${product.nombre}
                        </h3>
                        <p class="text-xs text-slate-400 mt-0.5">Código: ${product.id}</p>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span class="text-xl font-extrabold text-cyan-700">
                            ${product.getPrecioFormateado()}
                        </span>
                        <span class="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-white border-none rounded-lg px-2.5">
                            + Agregar
                        </span>
                    </div>
                </article>
            `)
            .join('');

        // Asignar eventos de clic a cada tarjeta del catálogo
        this.catalogGrid.querySelectorAll('[data-product-id]').forEach(card => {
            card.addEventListener('click', () => {
                const productId = card.getAttribute('data-product-id');
                this.addToCart(productId, 1);
            });
        });
    }

    /**
     * Pobla el <datalist> con los clientes y abarrotes registrados en Aguascalientes
     */
    renderClientsDatalist() {
        if (!this.clientsDatalist) return;
        const clients = this.storeService.getClients();
        this.clientsDatalist.innerHTML = clients
            .map(c => `<option value="${c.nombre}">${c.zona}</option>`)
            .join('');
    }

    /**
     * Agrega o incrementa un producto en el Ticket Rápido
     * @param {string} productId
     * @param {number} delta
     */
    addToCart(productId, delta = 1) {
        const product = this.storeService.getProductById(productId);
        if (!product) return;

        const existing = this.cart.get(productId);
        const nuevaCantidad = (existing ? existing.cantidad : 0) + delta;

        if (nuevaCantidad <= 0) {
            this.cart.delete(productId);
        } else {
            this.cart.set(productId, { product, cantidad: nuevaCantidad });
        }

        this.renderCart();
    }

    /**
     * Actualiza la cantidad exacta de un ítem en el carrito
     * @param {string} productId
     * @param {number} newQty
     */
    setCartQuantity(productId, newQty) {
        const qty = parseInt(newQty, 10);
        if (isNaN(qty) || qty <= 0) {
            this.cart.delete(productId);
        } else {
            const entry = this.cart.get(productId);
            if (entry) {
                entry.cantidad = qty;
            }
        }
        this.renderCart();
    }

    /**
     * Renderiza las líneas del Ticket Rápido (Derecha) y calcula su total
     */
    renderCart() {
        if (!this.cartItemsContainer) return;

        if (this.cart.size === 0) {
            this.cartItemsContainer.innerHTML = `
                <div class="py-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                    <p class="font-medium text-slate-500">Ticket vacío</p>
                    <p class="text-xs mt-1">Haz clic en los productos del catálogo para agregarlos a la nota.</p>
                </div>
            `;
            if (this.cartTotalEl) this.cartTotalEl.textContent = '$0.00';
            if (this.cartUnitsEl) this.cartUnitsEl.textContent = '0 pzas';
            return;
        }

        let totalImporte = 0;
        let totalUnidades = 0;
        const rowsHtml = [];

        this.cart.forEach(({ product, cantidad }) => {
            const subtotal = product.precio * cantidad;
            totalImporte += subtotal;
            totalUnidades += cantidad;

            rowsHtml.push(`
                <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div class="min-w-0 flex-1">
                        <p class="font-bold text-slate-800 text-sm truncate">${product.nombre}</p>
                        <p class="text-xs text-slate-500">${product.getPrecioFormateado()} c/u</p>
                    </div>

                    <div class="flex items-center gap-1">
                        <button type="button" data-cart-dec="${product.id}"
                            class="btn btn-xs btn-square btn-outline border-slate-300 text-slate-700 hover:bg-slate-200">-</button>
                        <input type="number" min="1" value="${cantidad}" data-cart-input="${product.id}"
                            class="input input-xs input-bordered w-14 text-center font-bold text-slate-800 px-1" />
                        <button type="button" data-cart-inc="${product.id}"
                            class="btn btn-xs btn-square bg-cyan-600 hover:bg-cyan-500 text-white border-none">+</button>
                    </div>

                    <div class="text-right min-w-[72px]">
                        <p class="font-extrabold text-cyan-800 text-sm">${this.uiController.formatCurrency(subtotal)}</p>
                    </div>
                </div>
            `);
        });

        this.cartItemsContainer.innerHTML = rowsHtml.join('');
        if (this.cartTotalEl) this.cartTotalEl.textContent = this.uiController.formatCurrency(totalImporte);
        if (this.cartUnitsEl) this.cartUnitsEl.textContent = `${totalUnidades} pzas`;

        // Eventos de botones +/- e input directo
        this.cartItemsContainer.querySelectorAll('[data-cart-dec]').forEach(btn => {
            btn.addEventListener('click', () => this.addToCart(btn.getAttribute('data-cart-dec'), -1));
        });
        this.cartItemsContainer.querySelectorAll('[data-cart-inc]').forEach(btn => {
            btn.addEventListener('click', () => this.addToCart(btn.getAttribute('data-cart-inc'), 1));
        });
        this.cartItemsContainer.querySelectorAll('[data-cart-input]').forEach(input => {
            input.addEventListener('change', e => {
                this.setCartQuantity(input.getAttribute('data-cart-input'), e.target.value);
            });
        });
    }

    /**
     * Procesa el formulario de Ticket Rápido para crear una nueva orden de venta
     * @private
     */
    _handleCreateOrder() {
        if (this.cart.size === 0) {
            this.uiController.showToast('Agrega al menos un producto al ticket antes de registrar la operación.', 'warning');
            return;
        }

        const clienteNombre = (this.clientInput?.value || '').trim() || 'Público en General';
        const repartidor = this.driverSelect?.value || 'Mostrador';
        const metodoPago = this.paymentSelect?.value || 'Efectivo';
        const estatus = this.statusSelect?.value || 'Pagado';

        const items = [];
        this.cart.forEach(({ product, cantidad }) => {
            items.push({
                productId: product.id,
                nombre: product.nombre,
                precio: product.precio,
                cantidadSalida: cantidad,
                cantidadDevuelta: 0
            });
        });

        const newOrder = this.storeService.createOrder({
            clienteNombre,
            repartidor,
            metodoPago,
            estatus,
            items
        });

        // Limpiar carrito y refrescar vistas
        this.cart.clear();
        if (this.clientInput) this.clientInput.value = '';
        this.renderCart();
        this.renderClientsDatalist();
        this.renderTodayOrders();
        this.uiController.updatePendingBadge();

        if (typeof this.onOrderUpdated === 'function') {
            this.onOrderUpdated();
        }

        this.uiController.showToast(
            `Nota ${newOrder.folio} generada (${newOrder.estatus}) por ${this.uiController.formatCurrency(newOrder.total)}`,
            'success'
        );
    }

    /**
     * Renderiza la Tabla de Pedidos de Hoy (Abajo Izquierda)
     */
    renderTodayOrders() {
        if (!this.todayOrdersTbody) return;
        const orders = this.storeService.getTodayOrders();

        let sumaTotalDia = 0;
        orders.forEach(o => {
            sumaTotalDia += o.total;
        });

        if (this.todayStatsCount) this.todayStatsCount.textContent = `${orders.length} operaciones`;
        if (this.todayStatsTotal) this.todayStatsTotal.textContent = this.uiController.formatCurrency(sumaTotalDia);

        if (orders.length === 0) {
            this.todayOrdersTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-8 text-slate-400">
                        No hay operaciones registradas el día de hoy.
                    </td>
                </tr>
            `;
            return;
        }

        this.todayOrdersTbody.innerHTML = orders
            .map(order => {
                const resumenUnidades = order.getResumenUnidades();
                const hora = new Date(order.fecha).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const detalleItems = order.items
                    .map(i => {
                        const neta = Order.getCantidadNetaItem(i);
                        const devBadge = i.cantidadDevuelta > 0
                            ? `<span class="text-amber-600 font-semibold">(-${i.cantidadDevuelta} dev)</span>`
                            : '';
                        return `<span class="inline-block mr-2 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md mb-1">
                            <strong>${neta}x</strong> ${i.nombre} ${devBadge}
                        </span>`;
                    })
                    .join('');

                const isPaid = order.estatus === 'Pagado';
                const statusBadge = isPaid
                    ? `<span class="badge badge-success badge-sm font-bold text-emerald-950 gap-1">Pagado</span>`
                    : `<span class="badge badge-warning badge-sm font-bold text-amber-950 gap-1">Pendiente</span>`;

                return `
                    <tr class="hover:bg-cyan-50/40 transition-colors border-b border-slate-100">
                        <td class="font-mono font-bold text-cyan-800 whitespace-nowrap">
                            <div>${order.folio}</div>
                            <div class="text-[11px] font-normal text-slate-400">${hora}</div>
                        </td>
                        <td>
                            <div class="font-bold text-slate-800">${order.clienteNombre}</div>
                            <div class="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span class="badge badge-ghost badge-xs">${order.repartidor}</span>
                                <span>•</span>
                                <span>${order.metodoPago === 'Efectivo' ? '💵 Efectivo' : '📱 Transferencia'}</span>
                            </div>
                        </td>
                        <td class="max-w-xs">
                            <div class="flex flex-wrap">${detalleItems}</div>
                            <div class="text-[11px] text-slate-400 mt-0.5">
                                Salida: ${resumenUnidades.totalSalida} | Dev: ${resumenUnidades.totalDevuelto} | Neto: <strong>${resumenUnidades.totalNeto} pzas</strong>
                            </div>
                        </td>
                        <td class="text-right font-extrabold text-slate-800 whitespace-nowrap">
                            ${this.uiController.formatCurrency(order.total)}
                        </td>
                        <td class="text-right font-bold whitespace-nowrap ${order.saldoPendiente > 0 ? 'text-amber-600' : 'text-emerald-600'}">
                            ${this.uiController.formatCurrency(order.saldoPendiente)}
                        </td>
                        <td class="text-center whitespace-nowrap">
                            ${statusBadge}
                        </td>
                        <td class="text-right whitespace-nowrap">
                            <div class="flex items-center justify-end gap-1.5">
                                <button type="button"
                                    data-action-return="${order.folio}"
                                    title="Registrar Devolución / Sobrante de Ruta"
                                    class="btn btn-xs bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-semibold">
                                    🔄 Devolución/Sobrante
                                </button>

                                ${!isPaid ? `
                                    <button type="button"
                                        data-action-mark-paid="${order.folio}"
                                        title="Liquidar nota al 100% (Saldo pasa a $0.00)"
                                        class="btn btn-xs bg-emerald-600 hover:bg-emerald-500 text-white border-none font-semibold">
                                        ✓ Marcar Pagado
                                    </button>
                                ` : ''}

                                <button type="button"
                                    data-action-print="${order.folio}"
                                    title="Imprimir Ticket Térmico"
                                    class="btn btn-xs btn-ghost border border-slate-200 hover:bg-slate-100 text-slate-700">
                                    🖨️
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join('');

        // Eventos de Devolución / Sobrante
        this.todayOrdersTbody.querySelectorAll('[data-action-return]').forEach(btn => {
            btn.addEventListener('click', () => {
                const folio = btn.getAttribute('data-action-return');
                this.openReturnModal(folio);
            });
        });

        // Eventos para pasar estatus a "Pagado" (Saldo -> $0.00)
        this.todayOrdersTbody.querySelectorAll('[data-action-mark-paid]').forEach(btn => {
            btn.addEventListener('click', () => {
                const folio = btn.getAttribute('data-action-mark-paid');
                this.markOrderAsPaid(folio);
            });
        });

        // Eventos para Impresión Térmica
        this.todayOrdersTbody.querySelectorAll('[data-action-print]').forEach(btn => {
            btn.addEventListener('click', () => {
                const folio = btn.getAttribute('data-action-print');
                const order = this.storeService.getOrderByFolio(folio);
                if (order) {
                    this.uiController.imprimirTicketOrden(order);
                }
            });
        });
    }

    /**
     * Cambia el estatus de una orden a "Pagado" asegurando que el saldo quede en $0.00
     * @param {string} folio
     */
    markOrderAsPaid(folio) {
        const order = this.storeService.getOrderByFolio(folio);
        if (!order) return;

        order.cambiarEstatus('Pagado');
        this.storeService.updateOrder(order);

        this.renderTodayOrders();
        this.uiController.updatePendingBadge();
        if (typeof this.onOrderUpdated === 'function') {
            this.onOrderUpdated();
        }

        this.uiController.showToast(
            `Orden ${order.folio} marcada como Pagada. Nuevo saldo: ${this.uiController.formatCurrency(order.saldoPendiente)}`,
            'success'
        );
    }

    /**
     * Abre el modal <dialog> para ajustar Devoluciones/Sobrantes de producto no entregado por el repartidor
     * @param {string} folio
     */
    openReturnModal(folio) {
        const order = this.storeService.getOrderByFolio(folio);
        if (!order || !this.returnModal || !this.returnItemsContainer) return;

        this.currentReturnOrderFolio = folio;
        if (this.returnOrderFolioLabel) this.returnOrderFolioLabel.textContent = order.folio;
        if (this.returnOrderClientLabel) {
            this.returnOrderClientLabel.textContent = `${order.clienteNombre} (${order.repartidor})`;
        }

        this.returnItemsContainer.innerHTML = order.items
            .map(item => {
                const neta = Order.getCantidadNetaItem(item);
                const subtotal = Order.getSubtotalItem(item);
                return `
                    <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p class="font-bold text-slate-800">${item.nombre}</p>
                            <p class="text-xs text-slate-500">
                                Precio: ${this.uiController.formatCurrency(item.precio)} |
                                <strong>Salida de planta: ${item.cantidadSalida} pzas</strong>
                            </p>
                        </div>

                        <div class="flex items-center gap-3">
                            <label class="form-control">
                                <span class="label-text text-xs font-semibold text-amber-800 mb-1">Devuelto / Sobrante</span>
                                <input type="number"
                                    min="0"
                                    max="${item.cantidadSalida}"
                                    value="${item.cantidadDevuelta}"
                                    data-return-product="${item.productId}"
                                    data-salida="${item.cantidadSalida}"
                                    data-precio="${item.precio}"
                                    class="input input-sm input-bordered w-24 text-center font-bold text-amber-900 border-amber-300 focus:border-amber-500" />
                            </label>

                            <div class="text-right min-w-[95px]">
                                <span class="block text-[11px] text-slate-400">Neto Entregado</span>
                                <span class="font-bold text-slate-700 text-sm" data-return-net-qty="${item.productId}">${neta} pzas</span>
                                <span class="block font-extrabold text-cyan-700 text-sm" data-return-net-sub="${item.productId}">
                                    ${this.uiController.formatCurrency(subtotal)}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');

        this._updateReturnLivePreview();

        // Actualizar previsualización en vivo al cambiar las cantidades devueltas
        this.returnItemsContainer.querySelectorAll('[data-return-product]').forEach(input => {
            input.addEventListener('input', () => this._updateReturnLivePreview());
        });

        this.returnModal.showModal();
    }

    /**
     * Calcula en tiempo real el nuevo total del pedido dentro del modal de devolución
     * @private
     */
    _updateReturnLivePreview() {
        if (!this.returnItemsContainer) return;
        let nuevoTotal = 0;

        this.returnItemsContainer.querySelectorAll('[data-return-product]').forEach(input => {
            const productId = input.getAttribute('data-return-product');
            const salida = Number(input.getAttribute('data-salida'));
            const precio = Number(input.getAttribute('data-precio'));
            const devuelta = Math.min(salida, Math.max(0, Number(input.value) || 0));

            const neta = Math.max(0, salida - devuelta);
            const subtotal = neta * precio;
            nuevoTotal += subtotal;

            const netQtyEl = this.returnItemsContainer.querySelector(`[data-return-net-qty="${productId}"]`);
            const netSubEl = this.returnItemsContainer.querySelector(`[data-return-net-sub="${productId}"]`);

            if (netQtyEl) netQtyEl.textContent = `${neta} pzas`;
            if (netSubEl) netSubEl.textContent = this.uiController.formatCurrency(subtotal);
        });

        if (this.returnPreviewTotal) {
            this.returnPreviewTotal.textContent = this.uiController.formatCurrency(nuevoTotal);
        }
    }

    /**
     * Guarda la devolución/sobrante invocando los métodos de Order.js y persiste el recálculo
     * @private
     */
    _handleSaveReturn() {
        if (!this.currentReturnOrderFolio) return;
        const order = this.storeService.getOrderByFolio(this.currentReturnOrderFolio);
        if (!order) return;

        const devolucionesMap = {};
        const inputs = this.returnItemsContainer.querySelectorAll('[data-return-product]');

        for (const input of inputs) {
            const productId = input.getAttribute('data-return-product');
            const salida = Number(input.getAttribute('data-salida'));
            const val = Number(input.value);

            if (isNaN(val) || val < 0 || val > salida) {
                this.uiController.showToast(
                    `La devolución debe estar entre 0 y ${salida} unidades.`,
                    'error'
                );
                return;
            }
            devolucionesMap[productId] = val;
        }

        try {
            // Invocar método de negocio puro en Order.js
            order.aplicarDevoluciones(devolucionesMap);
            this.storeService.updateOrder(order);

            this.returnModal?.close();
            this.renderTodayOrders();
            this.uiController.updatePendingBadge();

            if (typeof this.onOrderUpdated === 'function') {
                this.onOrderUpdated();
            }

            this.uiController.showToast(
                `Devolución aplicada en ${order.folio}. Nuevo total recalculado: ${this.uiController.formatCurrency(order.total)}`,
                'success'
            );
        } catch (err) {
            this.uiController.showToast(err.message, 'error');
        }
    }
}
