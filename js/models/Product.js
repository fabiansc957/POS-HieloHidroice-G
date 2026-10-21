/**
 * Modelo de Producto para Hielo HidroIce
 * Representa los productos del catálogo (Hielo cilíndrico, barras y agua purificada).
 */
export class Product {
    /**
     * @param {string} id - Identificador único del producto (ej. 'PROD-01')
     * @param {string} nombre - Nombre comercial del producto
     * @param {number} precio - Precio unitario en MXN
     * @param {string} tipo - Categoría ('hielo_cilindrico' | 'barra' | 'agua')
     * @param {string} unidad - Unidad de medida o empaque
     */
    constructor(id, nombre, precio, tipo, unidad = 'Pza') {
        this.id = id;
        this.nombre = nombre;
        this.precio = Number(precio);
        this.tipo = tipo;
        this.unidad = unidad;
    }

    /**
     * Formatea el precio en moneda nacional (MXN)
     * @returns {string}
     */
    getPrecioFormateado() {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(this.precio);
    }

    /**
     * Reconstruye una instancia de Product desde un objeto plano JSON
     * @param {Object} data
     * @returns {Product}
     */
    static fromJSON(data) {
        return new Product(
            data.id,
            data.nombre,
            data.precio,
            data.tipo,
            data.unidad
        );
    }
}
