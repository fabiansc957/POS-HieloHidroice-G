import { Order } from '../models/Order.js';

/**
 * Servicio Financiero: Motor FIFO de Cuentas por Cobrar y Corte de Caja Diario
 * Hielo HidroIce - Aguascalientes, México
 */
export class FinanceService {
    /**
     * @param {import('./StoreService.js').StoreService} storeService
     */
    constructor(storeService) {
        this.storeService = storeService;
    }

    /**
     * Obtiene todas las órdenes con estatus "Pendiente", opcionalmente filtradas por cliente,
     * ordenadas cronológicamente de la más antigua a la más reciente (FIFO).
     * @param {string} [clienteFiltro] - Nombre del cliente o vacío para todos
     * @returns {Array<Order>}
     */
    getPendingOrdersFIFO(clienteFiltro = '') {
        const filtro = String(clienteFiltro || '').trim().toLowerCase();
        return this.storeService
            .getOrders()
            .filter(order => {
                const isPending = order.estatus === 'Pendiente' && order.saldoPendiente > 0;
                if (!isPending) return false;
                if (!filtro || filtro === 'todos') return true;
                return order.clienteNombre.toLowerCase() === filtro;
            })
            .sort((a, b) => {
                const diff = new Date(a.fecha) - new Date(b.fecha);
                if (diff !== 0) return diff;
                return a.folio.localeCompare(b.folio);
            });
    }

    /**
     * Obtiene resumen de clientes que tienen deuda activa en Cuentas por Cobrar
     * @returns {Array<{clienteNombre: string, notasPendientes: number, deudaTotal: number}>}
     */
    getDebtorsSummary() {
        const pendingOrders = this.getPendingOrdersFIFO();
        const map = new Map();

        pendingOrders.forEach(order => {
            const key = order.clienteNombre;
            if (!map.has(key)) {
                map.set(key, {
                    clienteNombre: key,
                    notasPendientes: 0,
                    deudaTotal: 0
                });
            }
            const entry = map.get(key);
            entry.notasPendientes += 1;
            entry.deudaTotal = Math.round((entry.deudaTotal + order.saldoPendiente) * 100) / 100;
        });

        return Array.from(map.values()).sort((a, b) => b.deudaTotal - a.deudaTotal);
    }

    /**
     * Motor de Abono Global Inteligente (FIFO - First In, First Out)
     * Procesa las notas pendientes de un cliente saldando automáticamente las más antiguas primero
     * y aplicando el remanente en la nota subsecuente.
     *
     * @param {string} clienteNombre - Cliente al que se aplica el abono
     * @param {number} montoIngreso - Monto total entregado por el cliente (ej. $500.00)
     * @param {'Efectivo'|'Transferencia'} metodoPago - Método de pago del abono
     * @returns {{
     *   clienteNombre: string,
     *   montoIngresado: number,
     *   montoAplicadoTotal: number,
     *   cambioSobrante: number,
     *   notasAfectadas: Array<{folio: string, saldoAnterior: number, abonoAplicado: number, nuevoSaldo: number, nuevoEstatus: string}>
     * }}
     */
    procesarAbonoGlobalFIFO(clienteNombre, montoIngreso, metodoPago = 'Efectivo') {
        const monto = Number(montoIngreso);
        if (!clienteNombre || clienteNombre === 'todos') {
            throw new Error('Debe seleccionar un cliente específico para aplicar un Abono Global FIFO.');
        }
        if (isNaN(monto) || monto <= 0) {
            throw new Error('El monto del abono debe ser mayor a $0.00.');
        }

        const allOrders = this.storeService.getOrders();
        // Filtrar las órdenes pendientes de este cliente en orden estrictamente cronológico (más antiguas primero)
        const clientPendingOrders = allOrders
            .filter(o => o.clienteNombre.toLowerCase() === clienteNombre.toLowerCase() && o.estatus === 'Pendiente' && o.saldoPendiente > 0)
            .sort((a, b) => {
                const timeDiff = new Date(a.fecha) - new Date(b.fecha);
                return timeDiff !== 0 ? timeDiff : a.folio.localeCompare(b.folio);
            });

        if (clientPendingOrders.length === 0) {
            throw new Error(`El cliente "${clienteNombre}" no tiene notas pendientes por cobrar.`);
        }

        let disponible = monto;
        const notasAfectadas = [];

        for (const order of clientPendingOrders) {
            if (disponible <= 0) break;

            const saldoAnterior = order.saldoPendiente;
            const resultado = order.aplicarAbono(
                disponible,
                metodoPago,
                `Abono Global FIFO (${metodoPago})`
            );

            disponible = resultado.remanente;

            notasAfectadas.push({
                folio: order.folio,
                saldoAnterior,
                abonoAplicado: resultado.montoAplicado,
                nuevoSaldo: order.saldoPendiente,
                nuevoEstatus: order.estatus
            });
        }

        // Persistir todas las órdenes actualizadas en LocalStorage
        this.storeService.saveOrders(allOrders);

        const montoAplicadoTotal = Math.round((monto - disponible) * 100) / 100;

        return {
            clienteNombre,
            montoIngresado: monto,
            montoAplicadoTotal,
            cambioSobrante: disponible,
            notasAfectadas
        };
    }

    /**
     * Genera el Corte de Caja Diario y Corte de Inventario Neto
     * Separa estrictamente Efectivo Físico vs Transferencias Bancarias, e incluye
     * el desglose de unidades salidas, devueltas y netas vendidas por producto.
     *
     * @returns {{
     *   fechaCorte: string,
     *   financiero: {
     *     efectivoFisico: number,
     *     transferenciasBancarias: number,
     *     totalIngresadoCaja: number,
     *     creditoPorCobrarHoy: number,
     *     ventaTotalBrutaHoy: number,
     *     totalOperacionesHoy: number,
     *     operacionesPagadas: number,
     *     operacionesPendientes: number
     *   },
     *   inventario: {
     *     productos: Array<{id: string, nombre: string, precio: number, unidadesSalida: number, unidadesDevueltas: number, unidadesNetas: number, importeNeto: number}>,
     *     totales: {salida: number, devueltas: number, netas: number}
     *   }
     * }}
     */
    generarCorteDiario() {
        const todayStr = new Date().toLocaleDateString('es-MX');
        const todayOrders = this.storeService.getTodayOrders();
        const catalog = this.storeService.getProducts();

        let efectivoFisico = 0;
        let transferenciasBancarias = 0;
        let creditoPorCobrarHoy = 0;
        let ventaTotalBrutaHoy = 0;
        let operacionesPagadas = 0;
        let operacionesPendientes = 0;

        // 1. Arqueo Financiero: contabilizar flujos de dinero reales recibidos hoy
        // Tanto de ventas directas como de abonos realizados hoy
        const allOrders = this.storeService.getOrders();
        allOrders.forEach(order => {
            if (Array.isArray(order.historialPagos) && order.historialPagos.length > 0) {
                order.historialPagos.forEach(pago => {
                    const pagoDateStr = new Date(pago.fecha).toLocaleDateString('es-MX');
                    if (pagoDateStr === todayStr) {
                        if (pago.metodoPago === 'Efectivo') {
                            efectivoFisico += Number(pago.monto);
                        } else if (pago.metodoPago === 'Transferencia') {
                            transferenciasBancarias += Number(pago.monto);
                        }
                    }
                });
            }
        });

        // Métricas de las órdenes emitidas hoy
        todayOrders.forEach(order => {
            ventaTotalBrutaHoy += order.total;
            creditoPorCobrarHoy += order.saldoPendiente;
            if (order.estatus === 'Pagado') {
                operacionesPagadas += 1;
            } else {
                operacionesPendientes += 1;
            }
        });

        // 2. Corte de Inventario Neto (Unidades vendidas menos devoluciones de hoy)
        const inventoryMap = new Map();
        catalog.forEach(prod => {
            inventoryMap.set(prod.id, {
                id: prod.id,
                nombre: prod.nombre,
                precio: prod.precio,
                unidadesSalida: 0,
                unidadesDevueltas: 0,
                unidadesNetas: 0,
                importeNeto: 0
            });
        });

        todayOrders.forEach(order => {
            order.items.forEach(item => {
                if (!inventoryMap.has(item.productId)) {
                    inventoryMap.set(item.productId, {
                        id: item.productId,
                        nombre: item.nombre,
                        precio: item.precio,
                        unidadesSalida: 0,
                        unidadesDevueltas: 0,
                        unidadesNetas: 0,
                        importeNeto: 0
                    });
                }
                const row = inventoryMap.get(item.productId);
                const salida = Number(item.cantidadSalida);
                const devuelta = Number(item.cantidadDevuelta);
                const neta = Order.getCantidadNetaItem(item);

                row.unidadesSalida += salida;
                row.unidadesDevueltas += devuelta;
                row.unidadesNetas += neta;
                row.importeNeto = Math.round((row.importeNeto + neta * item.precio) * 100) / 100;
            });
        });

        const productosInventario = Array.from(inventoryMap.values());
        const totalesInventario = productosInventario.reduce(
            (acc, row) => {
                acc.salida += row.unidadesSalida;
                acc.devueltas += row.unidadesDevueltas;
                acc.netas += row.unidadesNetas;
                return acc;
            },
            { salida: 0, devueltas: 0, netas: 0 }
        );

        efectivoFisico = Math.round(efectivoFisico * 100) / 100;
        transferenciasBancarias = Math.round(transferenciasBancarias * 100) / 100;
        const totalIngresadoCaja = Math.round((efectivoFisico + transferenciasBancarias) * 100) / 100;

        return {
            fechaCorte: new Date().toLocaleString('es-MX', {
                dateStyle: 'full',
                timeStyle: 'short'
            }),
            financiero: {
                efectivoFisico,
                transferenciasBancarias,
                totalIngresadoCaja,
                creditoPorCobrarHoy: Math.round(creditoPorCobrarHoy * 100) / 100,
                ventaTotalBrutaHoy: Math.round(ventaTotalBrutaHoy * 100) / 100,
                totalOperacionesHoy: todayOrders.length,
                operacionesPagadas,
                operacionesPendientes
            },
            inventario: {
                productos: productosInventario,
                totales: totalesInventario
            }
        };
    }
}
