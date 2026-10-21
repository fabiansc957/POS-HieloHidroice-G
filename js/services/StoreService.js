import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Client } from '../models/Client.js';

/**
 * Servicio centralizado de persistencia (LocalStorage) para Catálogo, Clientes y Pedidos
 * Hielo HidroIce - Aguascalientes, México
 */
export class StoreService {
    static KEYS = {
        PRODUCTS: 'hidroice_products_v1',
        ORDERS: 'hidroice_orders_v1',
        CLIENTS: 'hidroice_clients_v1',
        FOLIO_SEQ: 'hidroice_folio_seq_v1'
    };

    constructor() {
        this._initializeDefaultData();
    }

    /**
     * Inicializa el catálogo oficial de Hielo HidroIce y datos semilla si no existen
     * @private
     */
    _initializeDefaultData() {
        // 1. Catálogo oficial de productos (Hielo Cilíndrico, Barra y Agua)
        if (!localStorage.getItem(StoreService.KEYS.PRODUCTS)) {
            const initialProducts = [
                new Product('HI-CIL-05', 'Bolsa 5 Kgs Cilíndrico', 25.00, 'hielo_cilindrico', 'Bolsa 5kg'),
                new Product('HI-CIL-15', 'Bolsa 15 Kgs Cilíndrico', 60.00, 'hielo_cilindrico', 'Bolsa 15kg'),
                new Product('HI-CIL-03', 'Bolsa 3 Kgs Cilíndrico', 18.00, 'hielo_cilindrico', 'Bolsa 3kg'),
                new Product('HI-BAR-25', '1/4 de Barra', 45.00, 'barra', 'Pieza 1/4'),
                new Product('HI-GAR-20', 'Garrafón 20L', 20.00, 'agua', 'Garrafón 20L')
            ];
            localStorage.setItem(StoreService.KEYS.PRODUCTS, JSON.stringify(initialProducts));
        }

        // 2. Cartera inicial de clientes locales en Aguascalientes
        if (!localStorage.getItem(StoreService.KEYS.CLIENTS)) {
            const initialClients = [
                new Client('CLI-01', 'Abarrotes La Aguascalentense', 'Barrio de San Marcos', '449-112-3344', 0),
                new Client('CLI-02', 'Modelorama Av. Universidad', 'Fracc. Bosques del Prado', '449-203-9981', 0),
                new Client('CLI-03', 'Supercito El Dorado', 'Col. Las Américas', '449-310-4567', 0),
                new Client('CLI-04', 'Mariscos Puerto Vallarta Ags', 'Av. Convención Norte', '449-455-7812', 0),
                new Client('CLI-05', 'Abarrotes Don Chuy', 'Fracc. Ojocaliente I', '449-876-5432', 0),
                new Client('CLI-06', 'Público en General', 'Mostrador Planta', '', 0)
            ];
            localStorage.setItem(StoreService.KEYS.CLIENTS, JSON.stringify(initialClients));
        }

        // 3. Pedidos iniciales de demostración (operación del día y notas pendientes para probar FIFO)
        if (!localStorage.getItem(StoreService.KEYS.ORDERS)) {
            const now = new Date();
            const haceDosHoras = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
            const haceUnaHora = new Date(now.getTime() - 1 * 3600 * 1000).toISOString();
            const haceVeinteMin = new Date(now.getTime() - 20 * 60 * 1000).toISOString();

            const seedOrders = [
                new Order({
                    folio: 'HI-1001',
                    fecha: haceDosHoras,
                    clienteNombre: 'Abarrotes La Aguascalentense',
                    repartidor: 'Juan Pérez',
                    metodoPago: 'Efectivo',
                    estatus: 'Pendiente',
                    items: [
                        { productId: 'HI-CIL-05', nombre: 'Bolsa 5 Kgs Cilíndrico', precio: 25.00, cantidadSalida: 12, cantidadDevuelta: 2 },
                        { productId: 'HI-CIL-15', nombre: 'Bolsa 15 Kgs Cilíndrico', precio: 60.00, cantidadSalida: 3, cantidadDevuelta: 0 }
                    ]
                }),
                new Order({
                    folio: 'HI-1002',
                    fecha: haceUnaHora,
                    clienteNombre: 'Abarrotes La Aguascalentense',
                    repartidor: 'Ruta Norte',
                    metodoPago: 'Efectivo',
                    estatus: 'Pendiente',
                    items: [
                        { productId: 'HI-BAR-25', nombre: '1/4 de Barra', precio: 45.00, cantidadSalida: 6, cantidadDevuelta: 0 },
                        { productId: 'HI-GAR-20', nombre: 'Garrafón 20L', precio: 20.00, cantidadSalida: 5, cantidadDevuelta: 0 }
                    ]
                }),
                new Order({
                    folio: 'HI-1003',
                    fecha: haceVeinteMin,
                    clienteNombre: 'Modelorama Av. Universidad',
                    repartidor: 'Juan Pérez',
                    metodoPago: 'Transferencia',
                    estatus: 'Pagado',
                    items: [
                        { productId: 'HI-CIL-05', nombre: 'Bolsa 5 Kgs Cilíndrico', precio: 25.00, cantidadSalida: 20, cantidadDevuelta: 0 },
                        { productId: 'HI-CIL-03', nombre: 'Bolsa 3 Kgs Cilíndrico', precio: 18.00, cantidadSalida: 10, cantidadDevuelta: 0 }
                    ]
                }),
                new Order({
                    folio: 'HI-1004',
                    fecha: now.toISOString(),
                    clienteNombre: 'Supercito El Dorado',
                    repartidor: 'Mostrador',
                    metodoPago: 'Efectivo',
                    estatus: 'Pagado',
                    items: [
                        { productId: 'HI-CIL-15', nombre: 'Bolsa 15 Kgs Cilíndrico', precio: 60.00, cantidadSalida: 4, cantidadDevuelta: 0 },
                        { productId: 'HI-GAR-20', nombre: 'Garrafón 20L', precio: 20.00, cantidadSalida: 3, cantidadDevuelta: 0 }
                    ]
                })
            ];

            localStorage.setItem(StoreService.KEYS.ORDERS, JSON.stringify(seedOrders));
            localStorage.setItem(StoreService.KEYS.FOLIO_SEQ, '1004');
            this._syncClientsBalances(seedOrders);
        }
    }

    // ==========================================
    // PRODUCTOS
    // ==========================================

    /**
     * Obtiene la lista completa de productos como instancias de Product
     * @returns {Array<Product>}
     */
    getProducts() {
        const raw = localStorage.getItem(StoreService.KEYS.PRODUCTS);
        const list = raw ? JSON.parse(raw) : [];
        return list.map(item => Product.fromJSON(item));
    }

    /**
     * Busca un producto por su ID
     * @param {string} productId
     * @returns {Product|null}
     */
    getProductById(productId) {
        return this.getProducts().find(p => p.id === productId) || null;
    }

    // ==========================================
    // CLIENTES
    // ==========================================

    /**
     * Obtiene todos los clientes con sus saldos sincronizados
     * @returns {Array<Client>}
     */
    getClients() {
        const raw = localStorage.getItem(StoreService.KEYS.CLIENTS);
        const list = raw ? JSON.parse(raw) : [];
        const orders = this.getOrders();
        return list.map(data => {
            const client = Client.fromJSON(data);
            client.recalcularSaldo(orders);
            return client;
        });
    }

    /**
     * Registra un cliente automáticamente si no existe en el catálogo
     * @param {string} nombreCliente
     * @returns {Client}
     */
    ensureClientExists(nombreCliente) {
        const cleanName = String(nombreCliente || 'Público en General').trim();
        const raw = localStorage.getItem(StoreService.KEYS.CLIENTS);
        const list = raw ? JSON.parse(raw) : [];

        const existing = list.find(c => c.nombre.toLowerCase() === cleanName.toLowerCase());
        if (existing) {
            return Client.fromJSON(existing);
        }

        const newClient = new Client(
            `CLI-${Date.now().toString().slice(-4)}`,
            cleanName,
            'Aguascalientes',
            '',
            0
        );
        list.push(newClient);
        localStorage.setItem(StoreService.KEYS.CLIENTS, JSON.stringify(list));
        return newClient;
    }

    // ==========================================
    // PEDIDOS / NOTAS DE VENTA
    // ==========================================

    /**
     * Genera el siguiente folio consecutivo (ej. HI-1005)
     * @returns {string}
     */
    nextFolio() {
        const current = Number(localStorage.getItem(StoreService.KEYS.FOLIO_SEQ) || 1000);
        const next = current + 1;
        localStorage.setItem(StoreService.KEYS.FOLIO_SEQ, String(next));
        return `HI-${next}`;
    }

    /**
     * Obtiene todas las órdenes almacenadas como instancias de Order
     * @returns {Array<Order>}
     */
    getOrders() {
        const raw = localStorage.getItem(StoreService.KEYS.ORDERS);
        const list = raw ? JSON.parse(raw) : [];
        return list.map(data => Order.fromJSON(data));
    }

    /**
     * Obtiene las órdenes correspondientes al día de hoy (ordenadas de más reciente a más antigua)
     * @returns {Array<Order>}
     */
    getTodayOrders() {
        const todayStr = new Date().toLocaleDateString('es-MX');
        return this.getOrders()
            .filter(order => new Date(order.fecha).toLocaleDateString('es-MX') === todayStr)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    /**
     * Busca una orden por su folio
     * @param {string} folio
     * @returns {Order|null}
     */
    getOrderByFolio(folio) {
        return this.getOrders().find(o => o.folio === folio) || null;
    }

    /**
     * Crea y persiste una nueva orden de venta
     * @param {Object} orderData
     * @returns {Order}
     */
    createOrder(orderData) {
        const folio = orderData.folio || this.nextFolio();
        this.ensureClientExists(orderData.clienteNombre);

        const newOrder = new Order({
            ...orderData,
            folio,
            fecha: new Date().toISOString()
        });

        const orders = this.getOrders();
        orders.push(newOrder);
        this.saveOrders(orders);
        return newOrder;
    }

    /**
     * Actualiza una orden existente (ej. tras aplicar devoluciones o cambiar estatus)
     * @param {Order} updatedOrder
     * @returns {Order}
     */
    updateOrder(updatedOrder) {
        const orders = this.getOrders();
        const index = orders.findIndex(o => o.folio === updatedOrder.folio);
        if (index === -1) {
            throw new Error(`No se encontró la orden con folio ${updatedOrder.folio}`);
        }
        orders[index] = updatedOrder;
        this.saveOrders(orders);
        return updatedOrder;
    }

    /**
     * Guarda el arreglo completo de órdenes y sincroniza saldos de clientes
     * @param {Array<Order>} orders
     */
    saveOrders(orders) {
        localStorage.setItem(StoreService.KEYS.ORDERS, JSON.stringify(orders));
        this._syncClientsBalances(orders);
    }

    /**
     * Sincroniza los saldos pendientes de todos los clientes registrados
     * @private
     * @param {Array<Order>} orders
     */
    _syncClientsBalances(orders) {
        const rawClients = localStorage.getItem(StoreService.KEYS.CLIENTS);
        if (!rawClients) return;
        const clients = JSON.parse(rawClients).map(c => Client.fromJSON(c));
        clients.forEach(client => client.recalcularSaldo(orders));
        localStorage.setItem(StoreService.KEYS.CLIENTS, JSON.stringify(clients));
    }
}
