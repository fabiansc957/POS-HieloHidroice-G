/**
 * Controlador de Autenticación (AuthController)
 * Gestiona el modal de Login ineludible (<dialog>) y el cierre de sesión.
 */
export class AuthController {
    /**
     * @param {Object} params
     * @param {import('../services/AuthService.js').AuthService} params.authService
     * @param {import('./UIController.js').UIController} params.uiController
     * @param {Function} params.onLoginSuccess - Callback ejecutado al iniciar sesión exitosamente
     */
    constructor({ authService, uiController, onLoginSuccess }) {
        this.authService = authService;
        this.uiController = uiController;
        this.onLoginSuccess = onLoginSuccess;

        this.loginDialog = document.getElementById('modal-login');
        this.loginForm = document.getElementById('form-login');
        this.inputUser = document.getElementById('login-username');
        this.inputPass = document.getElementById('login-password');
        this.errorBanner = document.getElementById('login-error-msg');
        this.btnLogout = document.getElementById('btn-logout');
        this.appShell = document.getElementById('app-main-shell');

        this._bindEvents();
    }

    /**
     * Inicializa el estado de autenticación al arrancar la aplicación.
     * La aplicación inicia bloqueada por el <dialog> de login ineludible.
     */
    init() {
        const user = this.authService.getCurrentUser();
        if (user) {
            this._unlockApp(user);
        } else {
            this.enforceLoginLock();
        }
    }

    /**
     * Configura listeners del modal ineludible, formulario y botones de acceso rápido demo
     * @private
     */
    _bindEvents() {
        // Evitar que el usuario cierre el <dialog> de login con la tecla ESC
        if (this.loginDialog) {
            this.loginDialog.addEventListener('cancel', event => {
                event.preventDefault();
            });
        }

        if (this.loginForm) {
            this.loginForm.addEventListener('submit', event => {
                event.preventDefault();
                this._handleLoginSubmit();
            });
        }

        if (this.btnLogout) {
            this.btnLogout.addEventListener('click', () => {
                this.authService.logout();
                this.uiController.showToast('Sesión finalizada correctamente.', 'info');
                this.enforceLoginLock();
            });
        }

        // Botones de autocompletado rápido para pruebas ágiles de roles
        document.querySelectorAll('[data-quick-login]').forEach(btn => {
            btn.addEventListener('click', () => {
                const roleCred = btn.getAttribute('data-quick-login');
                if (this.inputUser && this.inputPass) {
                    this.inputUser.value = roleCred;
                    this.inputPass.value = roleCred;
                    this._hideError();
                }
            });
        });
    }

    /**
     * Bloquea la aplicación con el <dialog> nativo de login
     */
    enforceLoginLock() {
        if (this.appShell) {
            this.appShell.classList.add('blur-sm', 'pointer-events-none', 'select-none');
        }
        if (this.loginForm) {
            this.loginForm.reset();
        }
        this._hideError();
        if (this.loginDialog && !this.loginDialog.open) {
            this.loginDialog.showModal();
        }
        setTimeout(() => this.inputUser?.focus(), 60);
    }

    /**
     * Procesa el envío de credenciales
     * @private
     */
    _handleLoginSubmit() {
        const username = this.inputUser?.value || '';
        const password = this.inputPass?.value || '';

        const result = this.authService.login(username, password);
        if (!result.success) {
            this._showError(result.message);
            return;
        }

        this._hideError();
        this._unlockApp(result.user);
        this.uiController.showToast(
            `Bienvenido, ${result.user.displayName} (${result.user.role})`,
            'success'
        );
    }

    /**
     * Desbloquea la interfaz y aplica las reglas de RBAC
     * @private
     * @param {Object} user
     */
    _unlockApp(user) {
        if (this.loginDialog && this.loginDialog.open) {
            this.loginDialog.close();
        }
        if (this.appShell) {
            this.appShell.classList.remove('blur-sm', 'pointer-events-none', 'select-none');
        }
        this.uiController.applyRBAC(user);
        if (typeof this.onLoginSuccess === 'function') {
            this.onLoginSuccess(user);
        }
    }

    /**
     * Muestra mensaje de error dentro del modal de login
     * @private
     * @param {string} msg
     */
    _showError(msg) {
        if (!this.errorBanner) return;
        this.errorBanner.textContent = msg;
        this.errorBanner.classList.remove('hidden');
    }

    /**
     * Oculta el banner de error del login
     * @private
     */
    _hideError() {
        if (!this.errorBanner) return;
        this.errorBanner.textContent = '';
        this.errorBanner.classList.add('hidden');
    }
}
