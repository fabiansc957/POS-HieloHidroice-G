import { AuthService } from './services/AuthService.js';
import { StoreService } from './services/StoreService.js';
import { FinanceService } from './services/FinanceService.js';

import { UIController } from './controllers/UIController.js';
import { AuthController } from './controllers/AuthController.js';
import { POSController } from './controllers/POSController.js';
import { DebtController } from './controllers/DebtController.js';

/**
 * Punto de entrada de la aplicación Hielo HidroIce POS & Logística
 * Inicializa la arquitectura de Servicios y Controladores (ES6 Modules).
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Instanciar capa de Servicios (Singletons de negocio y persistencia)
    const authService = new AuthService();
    const storeService = new StoreService();
    const financeService = new FinanceService(storeService);

    // 2. Instanciar Controlador transversal de UI
    const uiController = new UIController({
        authService,
        financeService,
        storeService
    });

    // 3. Instanciar Controladores de vistas principales (POS y Cuentas por Cobrar)
    let debtController = null;

    const posController = new POSController({
        storeService,
        uiController,
        onOrderUpdated: () => {
            if (debtController && authService.isAdmin()) {
                debtController.renderClientFilter();
                debtController.renderPendingTable();
            }
        }
    });

    debtController = new DebtController({
        financeService,
        storeService,
        uiController,
        onDebtUpdated: () => {
            posController.renderTodayOrders();
            posController.renderClientsDatalist();
        }
    });

    // Sincronizar vistas al cambiar de pestaña
    uiController.onTabChange(tabName => {
        if (tabName === 'pos') {
            posController.renderTodayOrders();
            posController.renderClientsDatalist();
        } else if (tabName === 'cxc' && authService.isAdmin()) {
            debtController.init();
        }
    });

    // 4. Instanciar Controlador de Autenticación y RBAC
    const authController = new AuthController({
        authService,
        uiController,
        onLoginSuccess: user => {
            posController.init();
            uiController.updatePendingBadge();
            if (user.role === 'Admin') {
                debtController.init();
            }
        }
    });

    // Actualizar reloj de planta en la barra superior
    const updateClock = () => {
        const clockEl = document.getElementById('nav-live-clock');
        if (clockEl) {
            clockEl.textContent = new Date().toLocaleString('es-MX', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };
    updateClock();
    setInterval(updateClock, 30000);

    // Iniciar aplicación (bloqueada por el <dialog> de login si no hay sesión activa)
    authController.init();
});
