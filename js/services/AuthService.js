/**
 * Servicio de Autenticación y Control de Acceso Basado en Roles (RBAC)
 * Hielo HidroIce - Aguascalientes, Ags.
 */
export class AuthService {
    static STORAGE_KEY = 'hidroice_session_v1';

    /**
     * Usuarios autorizados según reglas de negocio
     */
    static USERS = {
        admin: {
            username: 'admin',
            password: 'admin',
            role: 'Admin',
            displayName: 'Administrador General',
            permissions: ['pos', 'orders_today', 'cxc', 'cash_cut', 'print']
        },
        cajero: {
            username: 'cajero',
            password: 'cajero',
            role: 'Cajero',
            displayName: 'Cajero de Turno',
            permissions: ['pos', 'orders_today', 'print']
        }
    };

    constructor() {
        this.currentUser = this._loadSession();
    }

    /**
     * Valida credenciales e inicia sesión
     * @param {string} username
     * @param {string} password
     * @returns {{success: boolean, user?: Object, message?: string}}
     */
    login(username, password) {
        const cleanUser = String(username || '').trim().toLowerCase();
        const cleanPass = String(password || '').trim();

        const account = AuthService.USERS[cleanUser];
        if (!account || account.password !== cleanPass) {
            return {
                success: false,
                message: 'Credenciales incorrectas. Verifique su usuario y contraseña.'
            };
        }

        const sessionUser = {
            username: account.username,
            role: account.role,
            displayName: account.displayName,
            permissions: [...account.permissions],
            loginAt: new Date().toISOString()
        };

        this.currentUser = sessionUser;
        sessionStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(sessionUser));

        return {
            success: true,
            user: sessionUser
        };
    }

    /**
     * Cierra la sesión activa
     */
    logout() {
        this.currentUser = null;
        sessionStorage.removeItem(AuthService.STORAGE_KEY);
    }

    /**
     * Obtiene el usuario autenticado actual
     * @returns {Object|null}
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Verifica si existe una sesión activa
     * @returns {boolean}
     */
    isAuthenticated() {
        return Boolean(this.currentUser);
    }

    /**
     * Verifica si el usuario actual tiene rol Admin
     * @returns {boolean}
     */
    isAdmin() {
        return this.currentUser?.role === 'Admin';
    }

    /**
     * Verifica si el usuario actual tiene un permiso específico
     * @param {string} permission
     * @returns {boolean}
     */
    hasPermission(permission) {
        if (!this.currentUser) return false;
        return this.currentUser.permissions.includes(permission);
    }

    /**
     * Carga la sesión desde sessionStorage si existe
     * @private
     */
    _loadSession() {
        try {
            const raw = sessionStorage.getItem(AuthService.STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }
}
