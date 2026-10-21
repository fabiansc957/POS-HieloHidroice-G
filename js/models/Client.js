/**
 * Modelo de Cliente para Hielo HidroIce
 * Gestiona datos del cliente (Abarrotes, restaurantes, rutas) y cálculo de saldos.
 */
export class Client {
    /**
     * @param {string} id - Identificador único
     * @param {string} nombre - Nombre del negocio o cliente
     * @param {string} zona - Zona o colonia en Aguascalientes
     * @param {string} telefono - Teléfono de contacto
     * @param {number} saldoPendiente - Saldo deudor acumulado
     */
    constructor(id, nombre, zona = 'Aguascalientes Centro', telefono = '', saldoPendiente = 0) {
        this.id = id;
        this.nombre = nombre;
        this.zona = zona;
        this.telefono = telefono;
        this.saldoPendiente = Number(saldoPendiente) || 0;
    }

    /**
     * Actualiza el saldo pendiente del cliente a partir de sus órdenes activas
     * @param {Array<import('./Order.js').Order>} orders
     * @returns {number}
     */
    recalcularSaldo(orders = []) {
        this.saldoPendiente = orders
            .filter(o => o.clienteNombre.toLowerCase() === this.nombre.toLowerCase() && o.estatus === 'Pendiente')
            .reduce((acc, o) => acc + o.saldoPendiente, 0);
        return this.saldoPendiente;
    }

    /**
     * Reconstruye una instancia de Client desde un objeto plano JSON
     * @param {Object} data
     * @returns {Client}
     */
    static fromJSON(data) {
        return new Client(
            data.id,
            data.nombre,
            data.zona,
            data.telefono,
            data.saldoPendiente
        );
    }
}
