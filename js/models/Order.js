/**
 * Modelo de Pedido / Nota de Venta (Order) para Hielo HidroIce
 * Contiene la lógica matemática de totales, devoluciones/sobrantes de ruta, abonos y estatus.
 */
export class Order {
    /**
     * @param {Object} params
     * @param {string} params.folio - Folio único del ticket (ej. 'HI-1001')
     * @param {string} params.fecha - Fecha ISO de creación
     * @param {string} params.clienteNombre - Nombre del cliente o abarrotes
     * @param {string} params.repartidor - Nombre de ruta o repartidor ('Mostrador', 'Juan Pérez', 'Ruta Norte', etc.)
     * @param {string} params.metodoPago - 'Efectivo' | 'Transferencia'
     * @param {string} params.estatus - 'Pagado' | 'Pendiente'
     * @param {Array<{productId: string, nombre: string, precio: number, cantidadSalida: number, cantidadDevuelta: number}>} params.items
     * @param {number} [params.montoAbonado] - Monto total abonado hasta el momento
     * @param {Array<{fecha: string, monto: number, metodoPago: string, nota: string}>} [params.historialPagos]
     */
    constructor({
        folio,
        fecha = new Date().toISOString(),
        clienteNombre,
        repartidor = 'Mostrador',
        metodoPago = 'Efectivo',
        estatus = 'Pagado',
        items = [],
        montoAbonado = null,
        historialPagos = []
    }) {
        this.folio = folio;
        this.fecha = fecha;
        this.clienteNombre = clienteNombre || 'Público en General';
        this.repartidor = repartidor;
        this.metodoPago = metodoPago;
        this.estatus = estatus;

        // Normalizar líneas de pedido con soporte para devoluciones de ruta
        this.items = items.map(item => ({
            productId: item.productId,
            nombre: item.nombre,
            precio: Number(item.precio),
            cantidadSalida: Number(item.cantidadSalida ?? item.cantidad ?? 0),
            cantidadDevuelta: Number(item.cantidadDevuelta ?? 0)
        }));

        this.historialPagos = Array.isArray(historialPagos) ? historialPagos : [];
        this.total = this.calcularTotal();

        // Si nace como Pagado y no se especificó montoAbonado, queda liquidado al 100%
        if (this.estatus === 'Pagado') {
            this.montoAbonado = this.total;
            this.saldoPendiente = 0;
            if (this.historialPagos.length === 0 && this.total > 0) {
                this.historialPagos.push({
                    fecha: this.fecha,
                    monto: this.total,
                    metodoPago: this.metodoPago,
                    nota: 'Liquidación inicial en venta'
                });
            }
        } else {
            this.montoAbonado = montoAbonado !== null ? Number(montoAbonado) : 0;
            this.recalcularSaldos();
        }
    }

    /**
     * Calcula la cantidad neta entregada de un ítem (Salida - Devolución)
     * @param {Object} item
     * @returns {number}
     */
     static getCantidadNetaItem(item) {
        return Math.max(0, Number(item.cantidadSalida) - Number(item.cantidadDevuelta));
    }

    /**
     * Calcula el subtotal de una línea de producto considerando devoluciones
     * @param {Object} item
     * @returns {number}
     */
    static getSubtotalItem(item) {
        return Order.getCantidadNetaItem(item) * Number(item.precio);
    }

    /**
     * Calcula el importe total neto de la orden
     * @returns {number}
     */
    calcularTotal() {
        const suma = this.items.reduce((acc, item) => {
            return acc + Order.getSubtotalItem(item);
        }, 0);
        this.total = Math.round(suma * 100) / 100;
        return this.total;
    }

    /**
     * Recalcula total, saldoPendiente y ajusta el estatus automáticamente
     */
    recalcularSaldos() {
        this.calcularTotal();

        if (this.estatus === 'Pagado' && this.montoAbonado >= this.total) {
            this.montoAbonado = this.total;
            this.saldoPendiente = 0;
            return;
        }

        // Asegurar que el monto abonado no supere el nuevo total (ej. tras una devolución)
        if (this.montoAbonado >= this.total) {
            this.montoAbonado = this.total;
            this.saldoPendiente = 0;
            this.estatus = 'Pagado';
        } else {
            this.saldoPendiente = Math.max(0, Math.round((this.total - this.montoAbonado) * 100) / 100);
            this.estatus = this.saldoPendiente === 0 ? 'Pagado' : 'Pendiente';
        }
    }

    /**
     * Registra devolución/sobrante de producto no entregado por el repartidor
     * (y opcionalmente ajustes de precio unitario en ruta) recalculando el total y saldo al instante.
     * @param {Object<string, number>} devolucionesMap - Mapa { productId: nuevaCantidadDevuelta }
     * @param {Object<string, number>} [preciosMap={}] - Mapa opcional { productId: nuevoPrecioUnitario }
     */
    aplicarDevoluciones(devolucionesMap, preciosMap = {}) {
        this.items.forEach(item => {
            if (Object.prototype.hasOwnProperty.call(devolucionesMap, item.productId)) {
                const dev = Number(devolucionesMap[item.productId]);
                if (isNaN(dev) || dev < 0) {
                    throw new Error(`Cantidad devuelta inválida para ${item.nombre}`);
                }
                if (dev > item.cantidadSalida) {
                    throw new Error(`La devolución de ${item.nombre} (${dev}) no puede superar la salida (${item.cantidadSalida}).`);
                }
                item.cantidadDevuelta = dev;
            }

            if (Object.prototype.hasOwnProperty.call(preciosMap, item.productId)) {
                const nuevoPrecio = Number(preciosMap[item.productId]);
                if (isNaN(nuevoPrecio) || nuevoPrecio <= 0) {
                    throw new Error(`El precio unitario de ${item.nombre} debe ser mayor a $0.00`);
                }
                item.precio = Math.round(nuevoPrecio * 100) / 100;
            }
        });

        // Si la orden estaba Pagada antes de la devolución, se ajusta el monto pagado al nuevo total neto
        // y el saldo se mantiene en $0.00
        if (this.estatus === 'Pagado') {
            this.calcularTotal();
            this.montoAbonado = this.total;
            this.saldoPendiente = 0;
            // Ajustar registro de pago para reflejar el neto real en caja
            if (this.historialPagos.length === 1) {
                this.historialPagos[0].monto = this.total;
                this.historialPagos[0].nota = 'Liquidación ajustada tras devolución de ruta';
            }
        } else {
            this.recalcularSaldos();
        }
    }

    /**
     * Cambia explícitamente el estatus del pedido.
     * Si pasa a "Pagado", el saldo pasa obligatoriamente a $0.00.
     * @param {'Pagado'|'Pendiente'} nuevoEstatus
     * @param {string} [metodoPago] - Método con el que se liquida si pasa a Pagado
     */
    cambiarEstatus(nuevoEstatus, metodoPago = null) {
        if (metodoPago) {
            this.metodoPago = metodoPago;
        }

        if (nuevoEstatus === 'Pagado') {
            const faltante = Math.max(0, this.total - this.montoAbonado);
            if (faltante > 0) {
                this.historialPagos.push({
                    fecha: new Date().toISOString(),
                    monto: faltante,
                    metodoPago: this.metodoPago,
                    nota: 'Liquidación directa de nota'
                });
            }
            this.estatus = 'Pagado';
            this.montoAbonado = this.total;
            this.saldoPendiente = 0;
        } else {
            this.estatus = 'Pendiente';
            this.recalcularSaldos();
        }
    }

    /**
     * Aplica un abono parcial o total a esta orden (usado por el motor FIFO)
     * @param {number} montoDisponible - Monto disponible para abonar
     * @param {string} metodoPago - 'Efectivo' | 'Transferencia'
     * @param {string} nota - Concepto del abono
     * @returns {{montoAplicado: number, remanente: number, liquidada: boolean}}
     */
    aplicarAbono(montoDisponible, metodoPago = 'Efectivo', nota = 'Abono FIFO Cuentas por Cobrar') {
        const disponible = Number(montoDisponible);
        if (disponible <= 0 || this.estatus === 'Pagado' || this.saldoPendiente <= 0) {
            return { montoAplicado: 0, remanente: disponible, liquidada: this.estatus === 'Pagado' };
        }

        const montoAplicado = Math.min(disponible, this.saldoPendiente);
        const remanente = Math.round((disponible - montoAplicado) * 100) / 100;

        this.montoAbonado = Math.round((this.montoAbonado + montoAplicado) * 100) / 100;
        this.metodoPago = metodoPago;
        this.historialPagos.push({
            fecha: new Date().toISOString(),
            monto: montoAplicado,
            metodoPago,
            nota
        });

        this.recalcularSaldos();

        return {
            montoAplicado,
            remanente,
            liquidada: this.estatus === 'Pagado'
        };
    }

    /**
     * Devuelve el resumen de unidades de la orden
     * @returns {{totalSalida: number, totalDevuelto: number, totalNeto: number}}
     */
    getResumenUnidades() {
        return this.items.reduce(
            (acc, item) => {
                const salida = Number(item.cantidadSalida);
                const dev = Number(item.cantidadDevuelta);
                acc.totalSalida += salida;
                acc.totalDevuelto += dev;
                acc.totalNeto += Math.max(0, salida - dev);
                return acc;
            },
            { totalSalida: 0, totalDevuelto: 0, totalNeto: 0 }
        );
    }

    /**
     * Reconstruye una instancia de Order desde un objeto JSON de LocalStorage
     * @param {Object} data
     * @returns {Order}
     */
    static fromJSON(data) {
        const order = new Order({
            folio: data.folio,
            fecha: data.fecha,
            clienteNombre: data.clienteNombre,
            repartidor: data.repartidor,
            metodoPago: data.metodoPago,
            estatus: data.estatus,
            items: data.items,
            montoAbonado: data.montoAbonado,
            historialPagos: data.historialPagos
        });
        // Garantizar consistencia exacta del saldo
        if (order.estatus === 'Pagado') {
            order.saldoPendiente = 0;
            order.montoAbonado = order.total;
        }
        return order;
    }
}
