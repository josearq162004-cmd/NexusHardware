/**
 * Nexus Hardware Caracas - Lógica Principal de la Aplicación Móvil
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar la Base de Datos Local
  await window.dbManager.init();

  // Estado global de la aplicación con Control de Acceso por Roles (RBAC)
  const state = {
    currentTab: 'catalog',
    currentUser: JSON.parse(localStorage.getItem('nexus_auth_user')) || {
      id: 'guest',
      username: 'cliente',
      fullName: 'Cliente Invitado',
      role: 'cliente' // Por defecto siempre es cliente
    },
    isAdminMode: false,
    targetTabAfterLogin: null,
    selectedCategory: 'all',
    searchQuery: '',
    cart: [], // Array de { product, qty }
    settings: await window.dbManager.get('settings', 'general_config') || { bcv_rate: 45.50 },
    branches: await window.dbManager.getAll('branches'),
    deviceFullscreen: false
  };

  // Referencias DOM principales
  const appContainer = document.getElementById('app-view-container');
  const bcvPill = document.getElementById('bcv-rate-pill');
  const cartCounterBadge = document.getElementById('cart-counter-badge');
  const navCartBadge = document.getElementById('nav-cart-badge');
  const navTabs = document.querySelectorAll('.nav-tab');
  const btnRoleSwitch = document.getElementById('btn-role-switch');
  const roleTextToggle = document.getElementById('role-text-toggle');
  const roleIconIndicator = document.getElementById('role-icon-indicator');
  const btnToggleFrame = document.getElementById('btn-toggle-frame');
  const frameTextToggle = document.getElementById('frame-text-toggle');
  const deviceWrapper = document.getElementById('device-wrapper');
  const btnDbQuickview = document.getElementById('btn-db-quickview');
  const navTabAdmin = document.getElementById('nav-tab-admin');

  // Referencias del Centro de Autenticación, Registro y Perfil
  const modalAuth = document.getElementById('modal-auth') || document.getElementById('modal-admin-auth');
  const btnCloseAuth = document.getElementById('modal-auth-close') || document.getElementById('modal-admin-auth-close');
  const btnHeaderUser = document.getElementById('btn-header-user');
  const headerUserIcon = document.getElementById('header-user-icon');

  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnRegister = document.getElementById('tab-btn-register');
  const tabBtnProfile = document.getElementById('tab-btn-profile');

  const panelAuthLogin = document.getElementById('panel-auth-login');
  const panelAuthRegister = document.getElementById('panel-auth-register');
  const panelAuthProfile = document.getElementById('panel-auth-profile');

  const modalAuthAlertBanner = document.getElementById('modal-auth-alert-banner');
  const modalAuthAlertText = document.getElementById('modal-auth-alert-text');
  const modalAuthAlertIcon = document.getElementById('modal-auth-alert-icon');
  const modalAuthHeaderIcon = document.getElementById('modal-auth-header-icon');

  // Formulario Login
  const formAuthLogin = document.getElementById('form-auth-login') || document.getElementById('form-admin-login');
  const loginInputUser = document.getElementById('login-input-user') || document.getElementById('admin-input-user');
  const loginInputPass = document.getElementById('login-input-pass') || document.getElementById('admin-input-pass');
  const btnToggleLoginPass = document.getElementById('btn-toggle-login-pass') || document.getElementById('btn-toggle-pass-visibility');
  const btnQuickAdmin = document.getElementById('btn-quick-admin');
  const btnQuickClient = document.getElementById('btn-quick-client');
  const btnSwitchToRegister = document.getElementById('btn-switch-to-register');

  // Formulario Registro por Roles
  const formAuthRegister = document.getElementById('form-auth-register');
  const regRoleBtnCliente = document.getElementById('reg-role-btn-cliente');
  const regRoleBtnAdmin = document.getElementById('reg-role-btn-admin');
  const regSelectedRole = document.getElementById('reg-selected-role');
  const regRoleBadgeInfo = document.getElementById('reg-role-badge-info');
  const regRoleDesc = document.getElementById('reg-role-desc');
  const regFullname = document.getElementById('reg-fullname');
  const regUsername = document.getElementById('reg-username');
  const regEmail = document.getElementById('reg-email');
  const regPhone = document.getElementById('reg-phone');
  const regPassword = document.getElementById('reg-password');
  const regPasswordConfirm = document.getElementById('reg-password-confirm');
  const regAdminTokenContainer = document.getElementById('reg-admin-token-container');
  const regMasterkey = document.getElementById('reg-masterkey');
  const btnToggleRegPass = document.getElementById('btn-toggle-reg-pass');
  const btnSubmitRegister = document.getElementById('btn-submit-register');
  const regSubmitBtnText = document.getElementById('reg-submit-btn-text');
  const btnSwitchToLogin = document.getElementById('btn-switch-to-login');

  // Panel Perfil
  const profileAvatar = document.getElementById('profile-avatar');
  const profileName = document.getElementById('profile-name');
  const profileUsername = document.getElementById('profile-username');
  const profileRoleBadge = document.getElementById('profile-role-badge');
  const profileEmail = document.getElementById('profile-email');
  const profilePhone = document.getElementById('profile-phone');
  const profileJoined = document.getElementById('profile-joined');
  const profileRoleActions = document.getElementById('profile-role-actions');
  const btnProfileSwitchAccount = document.getElementById('btn-profile-switch-account');
  const btnProfileLogout = document.getElementById('btn-profile-logout');

  // Inicializar reloj de la barra de estado simulada
  function startClock() {
    const clockEl = document.getElementById('live-clock');
    const update = () => {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    update();
    setInterval(update, 10000);
  }
  startClock();

  // Actualizar Tasa BCV en la UI
  function updateBcvUI() {
    const rate = state.settings.bcv_rate || 45.50;
    bcvPill.textContent = `BCV: ${rate.toFixed(2)} Bs/$`;
    const modalDisplay = document.getElementById('modal-bcv-display');
    if (modalDisplay) modalDisplay.textContent = `${rate.toFixed(2)} Bs.`;
    recalcModalBs();
  }

  function formatUsd(amount) {
    return `$${parseFloat(amount).toFixed(2)}`;
  }

  function formatBs(amountUsd) {
    const rate = state.settings.bcv_rate || 45.50;
    const bs = parseFloat(amountUsd) * rate;
    return `${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
  }

  // Notificaciones Toast Flotantes — posicionadas con z-[99999] para estar POR ENCIMA de cualquier modal o backdrop
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white border-emerald-500',
      error: 'bg-rose-600 text-white border-rose-500',
      info: 'bg-cyan-600 text-white border-cyan-500',
      warning: 'bg-amber-600 text-white border-amber-500'
    };
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-xmark',
      info: 'fa-circle-info',
      warning: 'fa-triangle-exclamation'
    };

    toast.className = `flex items-center gap-2 px-4 py-2.5 rounded-2xl border shadow-2xl text-xs font-semibold animate-scaleUp pointer-events-auto ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Desaparece automáticamente después de 2.8 segundos con transición de opacidad
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  /**
   * showInlineError — Muestra un banner de error DENTRO del modal de autenticación,
   * para que el usuario vea el mensaje directamente sobre el formulario sin que quede oculto.
   * @param {string} bannerId - ID del banner ('reg-error-banner' o 'login-error-banner')
   * @param {string} textId - ID del span de texto ('reg-error-text' o 'login-error-text')
   * @param {string} message - Mensaje de error a mostrar
   */
  function showInlineError(bannerId, textId, message) {
    const banner = document.getElementById(bannerId);
    const textEl = document.getElementById(textId);
    if (banner && textEl) {
      textEl.textContent = message;
      banner.classList.remove('hidden');
      // Hacer scroll al inicio del modal para que el banner sea visible inmediatamente
      const modalScrollContainer = document.querySelector('#modal-auth > div');
      if (modalScrollContainer) {
        modalScrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  /**
   * hideInlineError — Oculta el banner de error inline del modal de autenticación.
   * Se usa al cambiar de pestaña (login ↔ registro) o al lograr un login/registro exitoso.
   */
  function hideInlineError(bannerId) {
    const banner = document.getElementById(bannerId);
    if (banner) banner.classList.add('hidden');
  }

  // Actualizar contadores del Carrito
  function updateCartBadge() {
    const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
    cartCounterBadge.textContent = totalItems;
    cartCounterBadge.style.display = totalItems > 0 ? 'flex' : 'none';

    if (totalItems > 0) {
      navCartBadge.textContent = totalItems;
      navCartBadge.classList.remove('hidden');
    } else {
      navCartBadge.classList.add('hidden');
    }
  }

  // Suscribirse a cambios en la base de datos
  window.dbManager.subscribe(async (storeName) => {
    if (storeName === 'settings' || storeName === 'all') {
      state.settings = await window.dbManager.get('settings', 'general_config') || state.settings;
      updateBcvUI();
    }
    // Si estamos en la pestaña activa afectada, refrescar
    if (state.currentTab === 'catalog' || state.currentTab === 'admin' || state.currentTab === 'database') {
      renderActiveTab();
    }
  });

  // ==========================================
  // GESTIÓN DE ROLES Y CONTROL DE ACCESO (RBAC)
  // ==========================================
  function updateRoleUI() {
    const isAdmin = state.currentUser && state.currentUser.role === 'admin';
    const isLoggedClient = state.currentUser && state.currentUser.role === 'cliente' && state.currentUser.id !== 'guest';
    state.isAdminMode = isAdmin;

    if (isAdmin) {
      if (btnDbQuickview) {
        btnDbQuickview.classList.remove('hidden');
        btnDbQuickview.classList.add('flex');
      }
      if (navTabAdmin) {
        navTabAdmin.classList.remove('hidden');
        navTabAdmin.classList.add('flex');
      }
      if (roleTextToggle) roleTextToggle.textContent = `Admin: ${state.currentUser.username || 'Activo'}`;
      if (roleIconIndicator) roleIconIndicator.className = 'fa-solid fa-user-shield text-emerald-400';
      if (btnRoleSwitch) {
        btnRoleSwitch.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10';
        btnRoleSwitch.title = 'Sesión de Administrador activa. Clic para ver perfil o gestionar cuenta.';
      }
      if (headerUserIcon) headerUserIcon.className = 'fa-solid fa-user-shield text-emerald-400';
      if (btnHeaderUser) {
        btnHeaderUser.className = 'w-8 h-8 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs transition-colors shadow-sm shadow-emerald-500/20';
        btnHeaderUser.title = `Admin: ${state.currentUser.fullName || state.currentUser.username}`;
      }
    } else if (isLoggedClient) {
      if (btnDbQuickview) {
        btnDbQuickview.classList.add('hidden');
        btnDbQuickview.classList.remove('flex');
      }
      if (navTabAdmin) {
        navTabAdmin.classList.add('hidden');
        navTabAdmin.classList.remove('flex');
      }
      if (roleTextToggle) roleTextToggle.textContent = `Cliente: ${state.currentUser.username || 'Activo'}`;
      if (roleIconIndicator) roleIconIndicator.className = 'fa-solid fa-circle-user text-cyan-300';
      if (btnRoleSwitch) {
        btnRoleSwitch.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/10';
        btnRoleSwitch.title = `Sesión de Cliente activa: ${state.currentUser.fullName}. Clic para ver tu perfil.`;
      }
      if (headerUserIcon) headerUserIcon.className = 'fa-solid fa-circle-user text-cyan-300';
      if (btnHeaderUser) {
        btnHeaderUser.className = 'w-8 h-8 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/70 border border-cyan-500/40 text-cyan-300 flex items-center justify-center text-xs transition-colors shadow-sm shadow-cyan-500/20';
        btnHeaderUser.title = `Cliente: ${state.currentUser.fullName || state.currentUser.username}`;
      }
    } else {
      if (btnDbQuickview) {
        btnDbQuickview.classList.add('hidden');
        btnDbQuickview.classList.remove('flex');
      }
      if (navTabAdmin) {
        navTabAdmin.classList.add('hidden');
        navTabAdmin.classList.remove('flex');
      }
      if (roleTextToggle) roleTextToggle.textContent = 'Acceso / Roles';
      if (roleIconIndicator) roleIconIndicator.className = 'fa-solid fa-user text-amber-300';
      if (btnRoleSwitch) {
        btnRoleSwitch.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center gap-1.5';
        btnRoleSwitch.title = 'Modo Invitado. Clic para iniciar sesión o registrarte como Cliente o Administrador.';
      }
      if (headerUserIcon) headerUserIcon.className = 'fa-solid fa-user text-slate-300';
      if (btnHeaderUser) {
        btnHeaderUser.className = 'w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center text-xs transition-colors';
        btnHeaderUser.title = 'Iniciar Sesión / Registrarse';
      }
    }

    /**
     * PARA QUÉ SE HIZO:
     * Indicar claramente en el menú de navegación inferior si la vista corresponde
     * a las compras personales del cliente ("Mis Pedidos") o a la auditoría global
     * de todos los clientes para el administrador ("Pedidos (Todos)").
     *
     * CÓMO SE HIZO:
     * Actualiza reactivamente el texto del elemento 'nav-orders-label' según el rol activo.
     */
    const navOrdersLabel = document.getElementById('nav-orders-label');
    if (navOrdersLabel) {
      navOrdersLabel.textContent = isAdmin ? 'Pedidos (Todos)' : 'Mis Pedidos';
    }
  }

  // Alternar pestañas del modal (Login / Registro / Mi Perfil)
  function switchAuthTab(tabName) {
    const tabs = [
      { id: 'login', btn: tabBtnLogin, panel: panelAuthLogin },
      { id: 'register', btn: tabBtnRegister, panel: panelAuthRegister },
      { id: 'profile', btn: tabBtnProfile, panel: panelAuthProfile }
    ];

    // Al cambiar de pestaña, ocultar cualquier banner de error inline previo para no confundir al usuario
    hideInlineError('login-error-banner');
    hideInlineError('reg-error-banner');

    tabs.forEach(t => {
      if (!t.btn || !t.panel) return;
      if (t.id === tabName) {
        t.panel.classList.remove('hidden');
        t.btn.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md';
      } else {
        t.panel.classList.add('hidden');
        t.btn.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-slate-400 hover:text-white';
      }
    });

    if (tabName === 'profile') {
      renderProfileDetails();
    }
  }

  // Configuración dinámica del Rol en el Formulario de Registro
  function setRegisterRole(role) {
    if (!regSelectedRole) return;
    regSelectedRole.value = role;

    if (role === 'admin') {
      if (regRoleBtnAdmin) {
        regRoleBtnAdmin.className = 'reg-role-card p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1 border-emerald-500 bg-emerald-950/40 text-white shadow-md shadow-emerald-500/10';
        const sub = regRoleBtnAdmin.querySelector('span:last-child');
        if (sub) sub.className = 'text-[9px] text-emerald-300 font-medium leading-tight';
      }
      if (regRoleBtnCliente) {
        regRoleBtnCliente.className = 'reg-role-card p-2.5 rounded-2xl border transition-all flex flex-col items-center text-center gap-1 border-slate-800 bg-slate-950/50 text-slate-400 hover:border-cyan-500/50 hover:text-slate-200';
        const sub = regRoleBtnCliente.querySelector('span:last-child');
        if (sub) sub.className = 'text-[9px] text-slate-400 font-medium leading-tight';
      }
      if (regAdminTokenContainer) {
        regAdminTokenContainer.classList.remove('hidden');
      }
      if (regMasterkey) {
        regMasterkey.required = true;
      }
      if (regRoleBadgeInfo) {
        regRoleBadgeInfo.className = 'p-2.5 rounded-xl border bg-emerald-950/30 border-emerald-800/40 text-[11px] text-emerald-200 flex items-center gap-2';
        const icon = regRoleBadgeInfo.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-shield-halved text-emerald-400 text-xs shrink-0';
      }
      if (regRoleDesc) {
        regRoleDesc.textContent = 'Rol Administrador: Acceso a la Base de Datos relacional, ajuste de stock, precios, pedidos y tasa oficial BCV.';
      }
      if (btnSubmitRegister) {
        btnSubmitRegister.className = 'w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 font-bold text-white text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 mt-2';
      }
      if (regSubmitBtnText) {
        regSubmitBtnText.textContent = 'Crear Cuenta de Administrador';
      }
    } else {
      // Cliente
      if (regRoleBtnCliente) {
        regRoleBtnCliente.className = 'reg-role-card p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1 border-cyan-500 bg-cyan-950/40 text-white shadow-md shadow-cyan-500/10';
        const sub = regRoleBtnCliente.querySelector('span:last-child');
        if (sub) sub.className = 'text-[9px] text-cyan-300 font-medium leading-tight';
      }
      if (regRoleBtnAdmin) {
        regRoleBtnAdmin.className = 'reg-role-card p-2.5 rounded-2xl border transition-all flex flex-col items-center text-center gap-1 border-slate-800 bg-slate-950/50 text-slate-400 hover:border-emerald-500/50 hover:text-slate-200';
        const sub = regRoleBtnAdmin.querySelector('span:last-child');
        if (sub) sub.className = 'text-[9px] text-slate-400 font-medium leading-tight';
      }
      if (regAdminTokenContainer) {
        regAdminTokenContainer.classList.add('hidden');
      }
      if (regMasterkey) {
        regMasterkey.required = false;
        regMasterkey.value = '';
      }
      if (regRoleBadgeInfo) {
        regRoleBadgeInfo.className = 'p-2.5 rounded-xl border bg-cyan-950/30 border-cyan-800/40 text-[11px] text-cyan-200 flex items-center gap-2';
        const icon = regRoleBadgeInfo.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-circle-check text-cyan-400 text-xs shrink-0';
      }
      if (regRoleDesc) {
        regRoleDesc.textContent = 'Rol Cliente: Acceso a compras en USD y Bs (tasa BCV), asistente de compatibilidad y reseñas verificadas.';
      }
      if (btnSubmitRegister) {
        btnSubmitRegister.className = 'w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 font-bold text-white text-xs shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-1.5 mt-2';
      }
      if (regSubmitBtnText) {
        regSubmitBtnText.textContent = 'Crear Cuenta de Cliente';
      }
    }
  }

  // Renderizar detalles de la cuenta activa en la pestaña de Perfil
  function renderProfileDetails() {
    const user = state.currentUser;
    if (!user || user.id === 'guest') return;

    if (profileName) profileName.textContent = user.fullName || user.username;
    if (profileUsername) profileUsername.textContent = `@${user.username}`;
    if (profileEmail) profileEmail.textContent = user.email || 'No registrado';
    if (profilePhone) profilePhone.textContent = user.phone || 'No registrado';
    if (profileJoined) {
      profileJoined.textContent = user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-VE', { month: 'short', year: 'numeric', day: 'numeric' }) : 'Octubre 2026';
    }

    if (profileAvatar) {
      const initials = (user.fullName || user.username || 'US')
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      profileAvatar.textContent = initials || 'US';
    }

    if (profileRoleBadge) {
      if (user.role === 'admin') {
        profileRoleBadge.className = 'px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10';
        profileRoleBadge.innerHTML = '<i class="fa-solid fa-user-shield text-emerald-400"></i> Rol: Administrador';
      } else {
        profileRoleBadge.className = 'px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-cyan-500/20 text-cyan-300 border-cyan-500/30 shadow-sm shadow-cyan-500/10';
        profileRoleBadge.innerHTML = '<i class="fa-solid fa-circle-user text-cyan-400"></i> Rol: Cliente Verificado';
      }
    }

    if (profileRoleActions) {
      if (user.role === 'admin') {
        profileRoleActions.innerHTML = `
          <button type="button" id="btn-prof-goto-admin" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors">
            <i class="fa-solid fa-chart-pie"></i> Panel Admin
          </button>
          <button type="button" id="btn-prof-goto-db" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors">
            <i class="fa-solid fa-database"></i> BD Local
          </button>
        `;
        document.getElementById('btn-prof-goto-admin')?.addEventListener('click', () => {
          closeAuthModal();
          switchTab('admin');
        });
        document.getElementById('btn-prof-goto-db')?.addEventListener('click', () => {
          closeAuthModal();
          switchTab('database');
        });
      } else {
        profileRoleActions.innerHTML = `
          <button type="button" id="btn-prof-goto-catalog" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors">
            <i class="fa-solid fa-store"></i> Ver Catálogo
          </button>
          <button type="button" id="btn-prof-goto-orders" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors">
            <i class="fa-solid fa-clock-rotate-left"></i> Mis Pedidos
          </button>
        `;
        document.getElementById('btn-prof-goto-catalog')?.addEventListener('click', () => {
          closeAuthModal();
          switchTab('catalog');
        });
        document.getElementById('btn-prof-goto-orders')?.addEventListener('click', () => {
          closeAuthModal();
          switchTab('orders');
        });
      }
    }
  }

  // Apertura centralizada del Modal de Autenticación y Registro
  function openAuthModal(defaultTab = 'login', targetTab = null, forceRole = null) {
    state.targetTabAfterLogin = targetTab;
    const isLogged = state.currentUser && state.currentUser.id !== 'guest';

    if (modalAuthAlertBanner) {
      if (forceRole === 'admin') {
        modalAuthAlertBanner.classList.remove('hidden');
        modalAuthAlertBanner.className = 'p-3 rounded-2xl border text-[11px] mb-4 flex items-start gap-2.5 bg-amber-500/10 border-amber-500/30 text-amber-300 animate-fadeIn';
        if (modalAuthAlertIcon) modalAuthAlertIcon.className = 'fa-solid fa-shield-halved text-amber-400 text-sm mt-0.5 shrink-0';
        if (modalAuthAlertText) {
          modalAuthAlertText.innerHTML = '<b>Área Restringida:</b> Esta sección requiere permisos de <b>Administrador</b>. Inicia sesión con tus credenciales de admin o regístrate con tu clave de autorización.';
        }
      } else {
        modalAuthAlertBanner.classList.add('hidden');
      }
    }

    if (tabBtnProfile) {
      if (isLogged) {
        tabBtnProfile.classList.remove('hidden');
      } else {
        tabBtnProfile.classList.add('hidden');
      }
    }

    if (defaultTab === 'auto') {
      switchAuthTab(isLogged ? 'profile' : 'login');
    } else {
      switchAuthTab(defaultTab);
    }

    if (defaultTab === 'register') {
      setRegisterRole(forceRole === 'admin' ? 'admin' : 'cliente');
    }

    if (modalAuth) {
      modalAuth.classList.remove('hidden');
      if (loginInputPass && defaultTab === 'login') {
        loginInputPass.value = '';
        setTimeout(() => loginInputUser?.focus(), 100);
      }
    }
  }

  function closeAuthModal() {
    if (modalAuth) {
      modalAuth.classList.add('hidden');
      if (loginInputPass) loginInputPass.value = '';
      if (regPassword) regPassword.value = '';
      if (regPasswordConfirm) regPasswordConfirm.value = '';
    }
  }

  // Función alias para compatibilidad retroactiva
  function openAdminAuthModal(targetTab = null) {
    openAuthModal('login', targetTab, 'admin');
  }

  // Cierre de Sesión seguro
  function handleLogout() {
    state.currentUser = {
      id: 'guest',
      username: 'cliente',
      fullName: 'Cliente Invitado',
      role: 'cliente'
    };
    localStorage.removeItem('nexus_auth_user');
    updateRoleUI();
    closeAuthModal();
    showToast('Has cerrado la sesión. Modo Invitado activo.', 'info');
    if (state.currentTab === 'database' || state.currentTab === 'admin') {
      switchTab('catalog');
    } else {
      renderActiveTab();
    }
  }

  // Event Listeners de pestañas y botones del Modal
  tabBtnLogin?.addEventListener('click', () => switchAuthTab('login'));
  tabBtnRegister?.addEventListener('click', () => switchAuthTab('register'));
  tabBtnProfile?.addEventListener('click', () => switchAuthTab('profile'));

  btnSwitchToRegister?.addEventListener('click', () => switchAuthTab('register'));
  btnSwitchToLogin?.addEventListener('click', () => switchAuthTab('login'));

  regRoleBtnCliente?.addEventListener('click', () => setRegisterRole('cliente'));
  regRoleBtnAdmin?.addEventListener('click', () => setRegisterRole('admin'));

  // Cuentas demo para pruebas rápidas
  btnQuickAdmin?.addEventListener('click', () => {
    if (loginInputUser) loginInputUser.value = 'admin';
    if (loginInputPass) loginInputPass.value = 'admin2026';
    showToast('Credenciales demo de Administrador cargadas (admin / admin2026).', 'info');
  });

  btnQuickClient?.addEventListener('click', () => {
    if (loginInputUser) loginInputUser.value = 'carlos.m';
    if (loginInputPass) loginInputPass.value = 'cliente2026';
    showToast('Credenciales demo de Cliente cargadas (carlos.m / cliente2026).', 'info');
  });

  // Ojo para ver/ocultar contraseña en login
  btnToggleLoginPass?.addEventListener('click', () => {
    if (!loginInputPass) return;
    if (loginInputPass.type === 'password') {
      loginInputPass.type = 'text';
      btnToggleLoginPass.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
      loginInputPass.type = 'password';
      btnToggleLoginPass.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  });

  // Ojo para ver/ocultar contraseña en registro
  btnToggleRegPass?.addEventListener('click', () => {
    if (!regPassword) return;
    if (regPassword.type === 'password') {
      regPassword.type = 'text';
      btnToggleRegPass.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
      regPassword.type = 'password';
      btnToggleRegPass.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  });

  // ENVÍO DE FORMULARIO DE INICIO DE SESIÓN (Cliente o Administrador)
  formAuthLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginInputUser?.value || '';
    const password = loginInputPass?.value || '';

    const result = await window.dbManager.authenticateUser(username, password);
    if (result.success) {
      state.currentUser = result.user;
      localStorage.setItem('nexus_auth_user', JSON.stringify(result.user));
      updateRoleUI();
      // Ocultar banner de error inline al lograr login exitoso
      hideInlineError('login-error-banner');
      closeAuthModal();

      if (result.user.role === 'admin') {
        showToast(`¡Bienvenido Administrador ${result.user.fullName || result.user.username}! Acceso concedido al panel y base de datos.`, 'success');
        const dest = state.targetTabAfterLogin || 'admin';
        state.targetTabAfterLogin = null;
        switchTab(dest);
      } else {
        showToast(`¡Bienvenido ${result.user.fullName || result.user.username}! Sesión iniciada como Cliente.`, 'success');
        if (state.currentTab === 'admin' || state.currentTab === 'database') {
          switchTab('catalog');
        } else {
          renderActiveTab();
        }
      }
    } else {
      // Mostrar error TANTO en el banner inline (dentro del modal) COMO en el toast (encima de todo)
      const errorMsg = result.message || 'Credenciales inválidas. Verifica tu usuario y clave.';
      showInlineError('login-error-banner', 'login-error-text', errorMsg);
      showToast(errorMsg, 'error');
    }
  });

  // ENVÍO DE FORMULARIO DE REGISTRO CON SOPORTE DE ROLES (Cliente o Administrador)
  formAuthRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = regFullname?.value.trim() || '';
    const username = regUsername?.value.trim() || '';
    const email = regEmail?.value.trim() || '';
    const phone = regPhone?.value.trim() || '';
    const password = regPassword?.value || '';
    const passwordConfirm = regPasswordConfirm?.value || '';
    const role = regSelectedRole?.value || 'cliente';
    const adminMasterKey = regMasterkey?.value.trim() || '';

    // Validación: las contraseñas deben coincidir — error inline + toast por encima del modal
    if (password !== passwordConfirm) {
      showInlineError('reg-error-banner', 'reg-error-text', 'Las contraseñas no coinciden. Por favor verifícalas.');
      showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'warning');
      return;
    }

    // Validación: contraseña mínima de 4 caracteres — error inline + toast por encima del modal
    if (password.length < 4) {
      showInlineError('reg-error-banner', 'reg-error-text', 'La contraseña debe tener al menos 4 caracteres.');
      showToast('La contraseña debe tener al menos 4 caracteres.', 'warning');
      return;
    }

    // Validación: clave maestra requerida para registro como Administrador — error inline + toast
    if (role === 'admin' && !adminMasterKey) {
      showInlineError('reg-error-banner', 'reg-error-text', 'Debes ingresar la Clave Maestra de Autorización para registrarte como Administrador (Demo: NEXUS-ADMIN-2026).');
      showToast('Debes ingresar la Clave Maestra de Autorización para registrarte como Administrador (Demo: NEXUS-ADMIN-2026).', 'warning');
      return;
    }

    const result = await window.dbManager.registerUser({
      fullName,
      username,
      email,
      phone,
      password,
      role,
      adminMasterKey
    });

    if (result.success) {
      state.currentUser = result.user;
      localStorage.setItem('nexus_auth_user', JSON.stringify(result.user));
      updateRoleUI();
      // Ocultar banner de error inline al lograr registro exitoso
      hideInlineError('reg-error-banner');
      closeAuthModal();

      // Resetear formulario
      formAuthRegister.reset();
      setRegisterRole('cliente');

      if (result.user.role === 'admin') {
        showToast(`¡Cuenta de Administrador creada exitosamente! Bienvenido, ${result.user.fullName}.`, 'success');
        const dest = state.targetTabAfterLogin || 'admin';
        state.targetTabAfterLogin = null;
        switchTab(dest);
      } else {
        showToast(`¡Cuenta de Cliente registrada con éxito! Bienvenido a Nexus Hardware, ${result.user.fullName}.`, 'success');
        if (state.currentTab === 'admin' || state.currentTab === 'database') {
          switchTab('catalog');
        } else {
          renderActiveTab();
        }
      }
    } else {
      // Error de registro — mostrar banner inline dentro del modal + toast por encima
      const errorMsg = result.message || 'Error al registrar la cuenta.';
      showInlineError('reg-error-banner', 'reg-error-text', errorMsg);
      showToast(errorMsg, 'error');
    }
  });

  // Acciones en perfil
  btnProfileLogout?.addEventListener('click', handleLogout);
  btnProfileSwitchAccount?.addEventListener('click', () => switchAuthTab('login'));

  // Cerrar modal
  btnCloseAuth?.addEventListener('click', closeAuthModal);
  if (modalAuth) {
    modalAuth.addEventListener('click', (e) => {
      if (e.target === modalAuth) closeAuthModal();
    });
  }

  // Vista de Acceso Denegado / Ruta Protegida
  function renderAccessDeniedView(sectionName) {
    appContainer.innerHTML = `
      <div class="p-8 text-center space-y-4 animate-fadeIn my-auto flex flex-col items-center justify-center min-h-[420px]">
        <div class="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-3xl shadow-xl shadow-rose-500/10">
          <i class="fa-solid fa-lock"></i>
        </div>
        <div>
          <span class="text-[10px] uppercase font-bold tracking-widest text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">Área Confidencial</span>
          <h2 class="text-base font-extrabold font-orbitron text-white mt-2">ACCESO RESTRINGIDO</h2>
          <p class="text-xs text-slate-400 max-w-xs mx-auto mt-1.5 leading-relaxed">
            La información de <b>${sectionName}</b> no está disponible para clientes ni invitados. Debes ingresar con una cuenta con rol de <b>Administrador</b> para consultar estas tablas.
          </p>
        </div>
        <div class="pt-2 flex flex-col sm:flex-row gap-2 w-full max-w-xs justify-center">
          <button id="btn-denied-login-admin" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 font-bold text-white text-xs shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-shield-halved"></i> Ingresar como Admin
          </button>
          <button id="btn-denied-reg-admin" class="w-full py-2.5 rounded-xl bg-emerald-700/40 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-user-plus"></i> Registrar Admin
          </button>
          <button id="btn-denied-go-catalog" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors">
            Volver a la Tienda
          </button>
        </div>
      </div>
    `;
    document.getElementById('btn-denied-login-admin')?.addEventListener('click', () => openAuthModal('login', 'database', 'admin'));
    document.getElementById('btn-denied-reg-admin')?.addEventListener('click', () => openAuthModal('register', 'database', 'admin'));
    document.getElementById('btn-denied-go-catalog')?.addEventListener('click', () => switchTab('catalog'));
  }

  // NAVEGACIÓN Y CAMBIO DE PESTAÑAS CON RUTA PROTEGIDA (ROUTE GUARDS)
  function switchTab(tabName) {
    // Proteger las rutas de Base de Datos y Panel de Administración
    if ((tabName === 'database' || tabName === 'admin') && state.currentUser.role !== 'admin') {
      showToast('Acceso Restringido: La Base de Datos es visible únicamente para Administradores.', 'error');
      openAdminAuthModal(tabName);
      return;
    }

    state.currentTab = tabName;
    navTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
        tab.classList.remove('text-slate-400');
        tab.classList.add('text-cyan-400');
      } else {
        tab.classList.remove('active');
        tab.classList.add('text-slate-400');
        tab.classList.remove('text-cyan-400');
      }
    });
    renderActiveTab();
    appContainer.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navTabs.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('btn-header-cart').addEventListener('click', () => switchTab('cart'));

  // Toggle de Marco Móvil (Simulador vs Fullscreen)
  btnToggleFrame.addEventListener('click', () => {
    state.deviceFullscreen = !state.deviceFullscreen;
    if (state.deviceFullscreen) {
      deviceWrapper.classList.add('fullscreen-mode');
      frameTextToggle.textContent = 'Pantalla Completa: ON';
      btnToggleFrame.classList.replace('bg-cyan-600', 'bg-indigo-600');
    } else {
      deviceWrapper.classList.remove('fullscreen-mode');
      frameTextToggle.textContent = 'Marco Teléfono: ON';
      btnToggleFrame.classList.replace('bg-indigo-600', 'bg-cyan-600');
    }
  });

  // Botones de Acceso a Autenticación y Control de Roles (Frame y Header Móvil)
  btnRoleSwitch?.addEventListener('click', () => openAuthModal('auto'));
  btnHeaderUser?.addEventListener('click', () => openAuthModal('auto'));

  // Botón directo a Base de Datos (Solo administradores)
  btnDbQuickview.addEventListener('click', () => switchTab('database'));

  // ==========================================
  // RENDERIZADO DE VISTAS
  // ==========================================
  async function renderActiveTab() {
    switch (state.currentTab) {
      case 'catalog':
        await renderCatalogView();
        break;
      case 'compatibility':
        await renderCompatibilityView();
        break;
      case 'cart':
        await renderCartView();
        break;
      case 'orders':
        await renderOrdersView();
        break;
      case 'reviews':
        await renderReviewsView();
        break;
      case 'admin':
        await renderAdminView();
        break;
      case 'database':
        await renderDatabaseViewer();
        break;
      default:
        await renderCatalogView();
    }
  }

  // ------------------------------------------
  // 1. VISTA: CATÁLOGO DE TIENDA
  // ------------------------------------------
  async function renderCatalogView() {
    const products = await window.dbManager.getProducts(state.selectedCategory, state.searchQuery);
    const categories = [
      { id: 'all', label: 'Todos', icon: 'fa-layer-group' },
      { id: 'Procesadores', label: 'CPUs', icon: 'fa-microchip' },
      { id: 'Tarjetas de Video', label: 'GPUs', icon: 'fa-vr-cardboard' },
      { id: 'Placas Madre', label: 'Motherboards', icon: 'fa-memory' },
      { id: 'Memorias RAM', label: 'RAM', icon: 'fa-bolt' },
      { id: 'Fuentes de Poder', label: 'Fuentes', icon: 'fa-plug' },
      { id: 'Almacenamiento', label: 'SSDs', icon: 'fa-hard-drive' },
      { id: 'Gabinetes', label: 'Cases', icon: 'fa-box' },
      { id: 'Refrigeración', label: 'Coolers', icon: 'fa-fan' },
      { id: 'Periféricos', label: 'Periféricos', icon: 'fa-keyboard' }
    ];

    /**
     * =========================================================================
     * PARA QUÉ SE HIZO:
     * Reemplazar el banner genérico previo ("Hardware de Alto Rendimiento") por
     * una bienvenida cálida y una propuesta de valor que defina qué nos caracteriza
     * como tienda de hardware líder y de confianza en Caracas.
     *
     * CÓMO SE HIZO:
     * - Saludo dinámico y personalizado: Si el cliente ha iniciado sesión se le
     *   saluda por su nombre de pila, de lo contrario se le da una bienvenida general.
     * - Inclusión del nuevo logotipo oficial vectorizado de Nexus Hardware.
     * - Resumen de los 4 pilares que nos caracterizan como tienda especializada:
     *   1. Componentes 100% originales sellados de fábrica (CPUs, GPUs, RAM, SSDs).
     *   2. 12 meses de garantía directa de reemplazo por serial.
     *   3. Asesoría técnica en ensamble para evitar incompatibilidades físicas o de socket.
     *   4. 5 sucursales físicas en Caracas para retiro inmediato y tasa oficial BCV.
     * - Badges interactivos de confianza y acceso directo al Asistente de Compatibilidad.
     * =========================================================================
     */
    const isClientLogged = state.currentUser && state.currentUser.role === 'cliente' && state.currentUser.id !== 'guest';
    const clientFirstName = isClientLogged && state.currentUser.fullName ? state.currentUser.fullName.split(' ')[0] : '';
    
    const welcomeBadge = isClientLogged 
      ? `¡Hola, ${clientFirstName}! Tu setup te espera` 
      : 'Especialistas en Hardware Caracas';

    const welcomeHeading = isClientLogged
      ? `¡HOLA, ${clientFirstName.toUpperCase()}! BIENVENIDO A <span class="brand-text-gradient">NEXUS</span>`
      : `¡BIENVENIDOS A <span class="brand-text-gradient">NEXUS HARDWARE</span>!`;

    const welcomeDescription = `
      Más que una tienda, somos tu aliado técnico en Caracas: componentes 100% originales sellados, asesoría experta en ensamble de PC sin errores de compatibilidad, 12 meses de garantía directa y entrega inmediata en 5 sucursales o delivery express.
    `.trim();

    let html = `
      <div class="p-3.5 space-y-4 animate-fadeIn">
        <!-- Banner Hero: Bienvenida y propuesta de valor distintiva de la tienda de hardware -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/85 p-4 border border-cyan-500/40 shadow-xl shadow-cyan-950/30">
          
          <!-- Elementos lumínicos decorativos de fondo -->
          <div class="absolute -top-10 -right-10 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div class="absolute -bottom-8 -left-8 w-28 h-28 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
          <i class="fa-solid fa-microchip absolute -bottom-3 -right-3 text-7xl text-cyan-400/10 pointer-events-none"></i>

          <div class="relative z-10 space-y-2.5">
            
            <!-- Etiqueta superior con estado y sucursales -->
            <div class="flex items-center justify-between gap-2">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ${welcomeBadge}
              </span>
              <span class="text-[9px] text-slate-400 flex items-center gap-1 font-semibold">
                <i class="fa-solid fa-store text-cyan-400 text-[10px]"></i> 5 Sedes en Caracas
              </span>
            </div>

            <!-- Título de Bienvenida con Logotipo Oficial -->
            <div class="flex items-start gap-2.5">
              <div class="shrink-0 mt-0.5">
                ${getNexusStoreLogoSvg(36, false)}
              </div>
              <div>
                <h2 class="text-sm sm:text-base font-extrabold font-orbitron text-white leading-tight">
                  ${welcomeHeading}
                </h2>
                <p class="text-[11px] text-cyan-300/90 font-medium mt-0.5">
                  El templo del ensamble de PC, gaming y alto rendimiento.
                </p>
              </div>
            </div>

            <!-- Texto descriptivo que nos caracteriza como tienda de hardware -->
            <p class="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              ${welcomeDescription}
            </p>

            <!-- Sellos distintivos de garantía y confianza en hardware -->
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold pt-0.5">
              <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-1.5 text-slate-200 flex flex-col items-center gap-0.5 shadow-sm">
                <i class="fa-solid fa-shield-halved text-emerald-400 text-xs"></i>
                <span class="leading-tight">12 Meses Garantía</span>
              </div>
              <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-1.5 text-slate-200 flex flex-col items-center gap-0.5 shadow-sm">
                <i class="fa-solid fa-certificate text-cyan-400 text-xs"></i>
                <span class="leading-tight">100% Original</span>
              </div>
              <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-1.5 text-slate-200 flex flex-col items-center gap-0.5 shadow-sm">
                <i class="fa-solid fa-coins text-amber-400 text-xs"></i>
                <span class="leading-tight">Tasa Oficial BCV</span>
              </div>
            </div>

            <!-- Accesos rápidos al PC Builder y Reseñas de clientes -->
            <div class="pt-1 flex items-center gap-2">
              <button onclick="document.querySelector('[data-tab=compatibility]')?.click()" class="flex-1 text-xs py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all active:scale-95">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Asistente de PC Builder
              </button>
              <button onclick="document.querySelector('[data-tab=reviews]')?.click()" class="text-xs py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold flex items-center gap-1 transition-colors" title="Opiniones de compradores">
                <i class="fa-solid fa-star text-amber-400"></i>
                <span class="hidden sm:inline">Opiniones</span>
              </button>
            </div>

          </div>
        </div>

        <!-- Buscador -->
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
          <input 
            type="text" 
            id="catalog-search-input" 
            value="${state.searchQuery}" 
            placeholder="Buscar GPU, Ryzen, Intel, DDR5, SSD..." 
            class="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
          />
          ${state.searchQuery ? `
            <button id="btn-clear-search" class="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs">
              <i class="fa-solid fa-circle-xmark"></i>
            </button>
          ` : ''}
        </div>

        <!-- Carrusel de Categorías -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          ${categories.map(cat => `
            <button 
              data-category="${cat.id}" 
              class="cat-chip whitespace-nowrap px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all text-xs ${
                state.selectedCategory === cat.id 
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20' 
                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }"
            >
              <i class="fa-solid ${cat.icon} text-[11px]"></i>
              <span>${cat.label}</span>
            </button>
          `).join('')}
        </div>

        <!-- Contador de resultados -->
        <div class="flex justify-between items-center px-1">
          <span class="text-xs text-slate-400 font-medium">
            Mostrando <span class="text-cyan-400 font-bold">${products.length}</span> componentes
          </span>
          <span class="text-[11px] text-slate-500">
            Stock sincronizado con BD local
          </span>
        </div>

        <!-- Grid de Productos -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${products.length > 0 ? products.map(prod => renderProductCard(prod)).join('') : `
            <div class="col-span-full py-12 text-center text-slate-400 space-y-2">
              <i class="fa-solid fa-box-open text-4xl text-slate-600"></i>
              <p class="text-sm font-semibold">No se encontraron productos</p>
              <p class="text-xs text-slate-500">Intenta con otro término de búsqueda o categoría.</p>
            </div>
          `}
        </div>
      </div>
    `;

    appContainer.innerHTML = html;

    // Listeners de búsqueda y categoría
    const searchInput = document.getElementById('catalog-search-input');
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderActiveTab();
    });

    const clearBtn = document.getElementById('btn-clear-search');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.searchQuery = '';
        renderActiveTab();
      });
    }

    document.querySelectorAll('.cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        state.selectedCategory = chip.dataset.category;
        renderActiveTab();
      });
    });

    // Listeners para botones de agregar al carrito y modal detalles
    document.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prodId = btn.dataset.id;
        addToCart(prodId);
      });
    });

    document.querySelectorAll('.product-clickable').forEach(card => {
      card.addEventListener('click', () => {
        const prodId = card.dataset.id;
        openProductModal(prodId);
      });
    });
  }

  function renderProductCard(prod) {
    const isOutOfStock = prod.stock <= 0;
    const isLowStock = prod.stock > 0 && prod.stock <= 3;
    const stockClass = isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : 'in-stock';
    const stockLabel = isOutOfStock ? 'Agotado' : isLowStock ? `¡Solo ${prod.stock} disponibles!` : `Stock: ${prod.stock} unids`;

    return `
      <div data-id="${prod.id}" class="product-clickable hw-card cursor-pointer bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between p-3 relative group">
        <!-- Badge de Categoría y Stock -->
        <div class="flex items-center justify-between gap-1 mb-2">
          <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-800 text-cyan-300 border border-slate-700">
            ${prod.category}
          </span>
          <div class="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300">
            <span class="stock-dot ${stockClass}"></span>
            <span class="${isLowStock ? 'text-amber-400' : isOutOfStock ? 'text-rose-400' : 'text-emerald-400'}">${stockLabel}</span>
          </div>
        </div>

        <!-- Imagen del Producto -->
        <div class="h-28 w-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center relative mb-2">
          <img src="${prod.image}" alt="${prod.name}" class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&auto=format&fit=crop&q=60'">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
          <span class="absolute bottom-1.5 left-2 text-[10px] text-slate-400 font-medium">${prod.brand}</span>
        </div>

        <!-- Título y Especificaciones Clave -->
        <div class="flex-1 mb-3">
          <h3 class="text-xs font-bold text-white leading-snug line-clamp-2">${prod.name}</h3>
          <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">${prod.description}</p>
        </div>

        <!-- Precios en USD y BCV -->
        <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <div class="text-sm font-extrabold font-orbitron text-cyan-400">${formatUsd(prod.price)}</div>
            <div class="text-[10px] font-semibold text-slate-400">${formatBs(prod.price)}</div>
          </div>
          
          <button 
            data-id="${prod.id}" 
            ${isOutOfStock ? 'disabled' : ''} 
            class="btn-add-cart text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
              isOutOfStock 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/30 active:scale-95'
            }"
          >
            <i class="fa-solid fa-cart-plus"></i>
            <span>${isOutOfStock ? 'Agotado' : 'Añadir'}</span>
          </button>
        </div>
      </div>
    `;
  }

  // Modal de Detalle de Producto
  async function openProductModal(prodId) {
    const product = await window.dbManager.get('products', prodId);
    if (!product) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn';
    
    let specsHtml = '';
    if (product.specs) {
      specsHtml = Object.entries(product.specs).map(([key, value]) => `
        <div class="flex justify-between py-1 border-b border-slate-800 text-xs">
          <span class="text-slate-400 capitalize">${key.replace(/([A-Z])/g, ' $1')}:</span>
          <span class="text-white font-medium text-right">${Array.isArray(value) ? value.join(', ') : value}</span>
        </div>
      `).join('');
    }

    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm max-h-[85vh] overflow-y-auto p-5 shadow-2xl relative animate-scaleUp">
        <button id="close-prod-modal" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="w-full h-40 rounded-2xl overflow-hidden bg-slate-950 mb-4 border border-slate-800">
          <img src="${product.image}" class="w-full h-full object-cover">
        </div>

        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800">
          ${product.category} &bull; ${product.brand}
        </span>

        <h2 class="text-sm font-bold text-white mt-2 leading-tight">${product.name}</h2>
        
        <div class="my-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center">
          <div>
            <div class="text-lg font-bold font-orbitron text-cyan-400">${formatUsd(product.price)}</div>
            <div class="text-xs text-slate-400">Tasa BCV: ${formatBs(product.price)}</div>
          </div>
          <div class="text-right">
            <span class="text-xs font-semibold ${product.stock > 0 ? 'text-emerald-400' : 'text-rose-400'}">
              ${product.stock > 0 ? `Stock: ${product.stock} disponibles` : 'Sin Stock'}
            </span>
            <div class="text-[10px] text-slate-500">Garantía 12 meses</div>
          </div>
        </div>

        <p class="text-xs text-slate-300 mb-4">${product.description}</p>

        <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Ficha Técnica</h4>
        <div class="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 mb-5 space-y-1">
          ${specsHtml}
        </div>

        <button 
          id="btn-modal-add-cart" 
          ${product.stock <= 0 ? 'disabled' : ''} 
          class="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${
            product.stock <= 0 ? 'bg-slate-800 text-slate-500' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
          }"
        >
          <i class="fa-solid fa-cart-shopping"></i>
          <span>${product.stock <= 0 ? 'Agotado' : 'Añadir al Carrito'}</span>
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-prod-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    const addBtn = modal.querySelector('#btn-modal-add-cart');
    if (addBtn && product.stock > 0) {
      addBtn.addEventListener('click', () => {
        addToCart(product.id);
        modal.remove();
      });
    }
  }

  // AGREGAR AL CARRITO
  async function addToCart(productId) {
    const product = await window.dbManager.get('products', productId);
    if (!product) return;

    if (product.stock <= 0) {
      showToast('Este producto se encuentra agotado temporalmente.', 'error');
      return;
    }

    const existingIndex = state.cart.findIndex(i => i.product.id === productId);
    if (existingIndex >= 0) {
      if (state.cart[existingIndex].qty >= product.stock) {
        showToast(`Máximo stock alcanzado (${product.stock} unids en existencia)`, 'warning');
        return;
      }
      state.cart[existingIndex].qty += 1;
    } else {
      state.cart.push({ product, qty: 1 });
    }

    updateCartBadge();
    showToast(`"${product.name}" añadido al carrito`, 'success');
  }

  // ------------------------------------------
  // 2. VISTA: ASISTENTE DE COMPATIBILIDAD DE PC
  // ------------------------------------------
  async function renderCompatibilityView() {
    const allProducts = await window.dbManager.getAll('products');
    const engine = window.compatibilityEngine;
    const currentSpecs = engine.userSpecs;
    const analysis = engine.analyzeInventory(allProducts);

    let html = `
      <div class="p-3.5 space-y-4 animate-fadeIn">
        <!-- Encabezado del Asistente -->
        <div class="bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 p-4 rounded-2xl border border-indigo-500/30 shadow-lg">
          <div class="flex items-center gap-2 mb-1 text-cyan-400">
            <i class="fa-solid fa-microchip text-lg"></i>
            <h2 class="text-sm font-extrabold font-orbitron text-white">ASISTENTE DE COMPATIBILIDAD</h2>
          </div>
          <p class="text-xs text-slate-300">
            Ingresa las especificaciones de tu PC actual y la tienda filtrará automáticamente qué componentes son 100% compatibles.
          </p>
        </div>

        <!-- Formulario Interactivo de Especificaciones del Cliente -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <h3 class="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <i class="fa-solid fa-sliders text-cyan-400"></i> Mi Computadora Actual:
          </h3>

          <div class="grid grid-cols-2 gap-2.5">
            <!-- Socket / Procesador Actual -->
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Socket / CPU:</label>
              <select id="spec-socket" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="AM4" ${currentSpecs.socket === 'AM4' ? 'selected' : ''}>AMD Socket AM4 (Ryzen 1000-5000)</option>
                <option value="AM5" ${currentSpecs.socket === 'AM5' ? 'selected' : ''}>AMD Socket AM5 (Ryzen 7000+)</option>
                <option value="LGA1700" ${currentSpecs.socket === 'LGA1700' ? 'selected' : ''}>Intel LGA1700 (12va, 13ra, 14ta gen)</option>
                <option value="LGA1200" ${currentSpecs.socket === 'LGA1200' ? 'selected' : ''}>Intel LGA1200 (10ma, 11na gen)</option>
                <option value="LGA1151" ${currentSpecs.socket === 'LGA1151' ? 'selected' : ''}>Intel LGA1151 (6ta a 9na gen)</option>
                <option value="any" ${currentSpecs.socket === 'any' ? 'selected' : ''}>Cualquiera / PC Nueva</option>
              </select>
            </div>

            <!-- Tipo de Memoria RAM -->
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Tipo de RAM:</label>
              <select id="spec-ram" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="DDR4" ${currentSpecs.ramType === 'DDR4' ? 'selected' : ''}>DDR4</option>
                <option value="DDR5" ${currentSpecs.ramType === 'DDR5' ? 'selected' : ''}>DDR5</option>
                <option value="any" ${currentSpecs.ramType === 'any' ? 'selected' : ''}>Cualquiera</option>
              </select>
            </div>

            <!-- Fuente de Poder Watts -->
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Fuente de Poder (Watts):</label>
              <select id="spec-psu" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="400" ${currentSpecs.psuWatts == 400 ? 'selected' : ''}>400 Watts</option>
                <option value="500" ${currentSpecs.psuWatts == 500 ? 'selected' : ''}>500 Watts</option>
                <option value="600" ${currentSpecs.psuWatts == 600 ? 'selected' : ''}>600 Watts</option>
                <option value="750" ${currentSpecs.psuWatts == 750 ? 'selected' : ''}>750 Watts</option>
                <option value="850" ${currentSpecs.psuWatts == 850 ? 'selected' : ''}>850+ Watts</option>
              </select>
            </div>

            <!-- Formato de Gabinete -->
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Gabinete / Motherboard:</label>
              <select id="spec-form" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="ATX" ${currentSpecs.formFactor === 'ATX' ? 'selected' : ''}>ATX (Estándar)</option>
                <option value="Micro-ATX" ${currentSpecs.formFactor === 'Micro-ATX' ? 'selected' : ''}>Micro-ATX</option>
                <option value="Mini-ITX" ${currentSpecs.formFactor === 'Mini-ITX' ? 'selected' : ''}>Mini-ITX (Compacto)</option>
              </select>
            </div>
          </div>

          <button id="btn-recalc-compat" class="w-full py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-arrows-rotate"></i> Analizar Compatibilidad en la Tienda
          </button>
        </div>

        <!-- Resumen del Diagnóstico -->
        <div class="grid grid-cols-3 gap-2 text-center text-xs">
          <div class="bg-emerald-950/40 border border-emerald-500/40 p-2.5 rounded-xl">
            <div class="text-base font-bold text-emerald-400">${analysis.compatible.length}</div>
            <div class="text-[10px] text-emerald-200">Compatibles</div>
          </div>
          <div class="bg-amber-950/40 border border-amber-500/40 p-2.5 rounded-xl">
            <div class="text-base font-bold text-amber-400">${analysis.warning.length}</div>
            <div class="text-[10px] text-amber-200">Con Advertencia</div>
          </div>
          <div class="bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-xl">
            <div class="text-base font-bold text-rose-400">${analysis.incompatible.length}</div>
            <div class="text-[10px] text-rose-200">Incompatibles</div>
          </div>
        </div>

        <!-- LISTA DE PRODUCTOS COMPATIBLES -->
        <div class="space-y-3">
          <h3 class="text-xs font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-circle-check text-emerald-400"></i>
            <span>Componentes 100% Compatibles para tu PC:</span>
          </h3>

          ${analysis.compatible.map(item => `
            <div class="bg-slate-900 border border-emerald-500/30 rounded-2xl p-3 flex gap-3 items-center">
              <img src="${item.product.image}" class="w-14 h-14 rounded-xl object-cover bg-slate-950">
              <div class="flex-1">
                <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">100% COMPATIBLE</span>
                <h4 class="text-xs font-bold text-white line-clamp-1">${item.product.name}</h4>
                <p class="text-[10px] text-emerald-400/90 mt-0.5">${item.reason}</p>
                <div class="mt-1 flex items-center justify-between">
                  <span class="text-xs font-bold font-orbitron text-cyan-400">${formatUsd(item.product.price)}</span>
                  <button data-id="${item.product.id}" class="btn-add-cart text-[10px] px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1">
                    <i class="fa-solid fa-plus"></i> Añadir
                  </button>
                </div>
              </div>
            </div>
          `).join('')}

          ${analysis.warning.length > 0 ? `
            <h3 class="text-xs font-bold text-white flex items-center gap-2 pt-2">
              <i class="fa-solid fa-triangle-exclamation text-amber-400"></i>
              <span>Requieren Atención / Actualización:</span>
            </h3>

            ${analysis.warning.map(item => `
              <div class="bg-slate-900 border border-amber-500/30 rounded-2xl p-3 flex gap-3 items-center">
                <img src="${item.product.image}" class="w-14 h-14 rounded-xl object-cover bg-slate-950">
                <div class="flex-1">
                  <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">ATENCIÓN</span>
                  <h4 class="text-xs font-bold text-white line-clamp-1">${item.product.name}</h4>
                  <p class="text-[10px] text-amber-300/90 mt-0.5">${item.reason}</p>
                  <div class="mt-1 flex items-center justify-between">
                    <span class="text-xs font-bold font-orbitron text-cyan-400">${formatUsd(item.product.price)}</span>
                    <button data-id="${item.product.id}" class="btn-add-cart text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1">
                      <i class="fa-solid fa-plus"></i> Añadir
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          ` : ''}

          ${analysis.incompatible.length > 0 ? `
            <details class="bg-slate-900/60 border border-rose-900/40 rounded-2xl p-3 text-xs">
              <summary class="font-bold text-rose-400 cursor-pointer flex items-center justify-between">
                <span>Ver ${analysis.incompatible.length} productos no compatibles (explicación técnica)</span>
                <i class="fa-solid fa-chevron-down text-slate-400"></i>
              </summary>
              <div class="space-y-2 mt-3">
                ${analysis.incompatible.map(item => `
                  <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex justify-between items-center text-[11px]">
                    <div>
                      <div class="font-semibold text-slate-300">${item.product.name}</div>
                      <div class="text-[10px] text-rose-400/90">${item.reason}</div>
                    </div>
                    <span class="text-rose-500 font-bold"><i class="fa-solid fa-xmark"></i></span>
                  </div>
                `).join('')}
              </div>
            </details>
          ` : ''}
        </div>
      </div>
    `;

    appContainer.innerHTML = html;

    // Listeners del Asistente
    const btnRecalc = document.getElementById('btn-recalc-compat');
    const updateSpecs = () => {
      engine.setUserSpecs({
        socket: document.getElementById('spec-socket').value,
        ramType: document.getElementById('spec-ram').value,
        psuWatts: parseInt(document.getElementById('spec-psu').value),
        formFactor: document.getElementById('spec-form').value
      });
      showToast('Compatibilidad recalculada para tus especificaciones', 'info');
      renderCompatibilityView();
    };

    btnRecalc.addEventListener('click', updateSpecs);
    document.getElementById('spec-socket').addEventListener('change', updateSpecs);
    document.getElementById('spec-ram').addEventListener('change', updateSpecs);
    document.getElementById('spec-psu').addEventListener('change', updateSpecs);

    // Listeners para añadir al carrito
    appContainer.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', () => addToCart(btn.dataset.id));
    });
  }

  // ------------------------------------------
  // 3. VISTA: CARRITO Y CHECKOUT EN VENEZUELA
  // ------------------------------------------
  async function renderCartView() {
    const branches = await window.dbManager.getAll('branches');
    const settings = state.settings;
    const deliveryZones = settings.delivery_zones || [];

    if (state.cart.length === 0) {
      appContainer.innerHTML = `
        <div class="p-6 text-center py-20 space-y-3 animate-fadeIn">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 text-2xl">
            <i class="fa-solid fa-cart-shopping"></i>
          </div>
          <h2 class="text-base font-bold text-white">Tu carrito está vacío</h2>
          <p class="text-xs text-slate-400 max-w-xs mx-auto">
            Explora nuestro catálogo de hardware o verifica compatibilidad con tu equipo.
          </p>
          <button onclick="document.querySelector('[data-tab=catalog]').click()" class="mt-4 px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white shadow-lg shadow-cyan-600/30">
            Ir a la Tienda
          </button>
        </div>
      `;
      return;
    }

    const subtotalUsd = state.cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const subtotalBs = subtotalUsd * (settings.bcv_rate || 45.50);

    let html = `
      <div class="p-3.5 space-y-4 animate-fadeIn">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-extrabold font-orbitron text-white flex items-center gap-1.5">
            <i class="fa-solid fa-cart-shopping text-cyan-400"></i> CARRITO & CHECKOUT
          </h2>
          <button id="btn-empty-cart" class="text-[11px] text-rose-400 hover:text-rose-300 font-semibold">
            Vaciar Carrito
          </button>
        </div>

        <!-- Lista de Productos en el Carrito -->
        <div class="space-y-2">
          ${state.cart.map((item, index) => `
            <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex gap-3 items-center">
              <img src="${item.product.image}" class="w-12 h-12 rounded-xl object-cover bg-slate-950">
              <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-white truncate">${item.product.name}</h4>
                <div class="text-[11px] text-cyan-400 font-orbitron font-semibold">
                  ${formatUsd(item.product.price)} <span class="text-[9px] text-slate-400">(${formatBs(item.product.price)})</span>
                </div>
                <div class="text-[10px] text-slate-500">Stock máx: ${item.product.stock} unids</div>
              </div>
              <!-- Controles de Cantidad -->
              <div class="flex items-center gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button data-action="dec" data-index="${index}" class="cart-qty-btn w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center text-xs">
                  <i class="fa-solid fa-minus"></i>
                </button>
                <span class="w-5 text-center text-xs font-bold text-white">${item.qty}</span>
                <button data-action="inc" data-index="${index}" class="cart-qty-btn w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center text-xs">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- PASO 1: MÉTODO DE ENTREGA (Caracas) -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 class="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <i class="fa-solid fa-truck-fast text-cyan-400"></i> Método de Entrega:
          </h3>

          <div class="grid grid-cols-2 gap-2">
            <button id="tab-delivery-pickup" type="button" class="delivery-type-btn active py-2.5 px-3 rounded-xl border border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold text-xs flex flex-col items-center gap-1">
              <i class="fa-solid fa-store text-base"></i>
              <span>Retiro en Tienda</span>
              <span class="text-[9px] text-emerald-400 font-normal">Gratis (5 Sucursales)</span>
            </button>

            <button id="tab-delivery-courier" type="button" class="delivery-type-btn py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs flex flex-col items-center gap-1">
              <i class="fa-solid fa-motorcycle text-base"></i>
              <span>Delivery Caracas</span>
              <span class="text-[9px] text-cyan-400 font-normal">A domicilio</span>
            </button>
          </div>

          <!-- Subsección Retiro en Tienda con Sucursales de Caracas y Selección de Fecha -->
          <div id="section-pickup-details" class="space-y-3 pt-2">
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">
                Selecciona la Sucursal en Caracas (5 Disponibles):
              </label>
              <select id="checkout-branch" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                ${branches.map(b => `
                  <option value="${b.id}" data-name="${b.name}">
                    ${b.name} (${b.municipality}) - ${b.address}
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Selector de Fecha de Retiro -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[11px] font-semibold text-slate-300 block mb-1">Fecha de Retiro:</label>
                <input 
                  type="date" 
                  id="checkout-pickup-date" 
                  min="${new Date().toISOString().split('T')[0]}" 
                  value="${new Date().toISOString().split('T')[0]}"
                  class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-slate-300 block mb-1">Franja Horaria:</label>
                <select id="checkout-pickup-time" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                  <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                  <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM</option>
                  <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                  <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                </select>
              </div>
            </div>

            <div id="branch-info-box" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-0.5">
              <div class="font-bold text-cyan-400" id="branch-info-name">Sucursal Altamira</div>
              <div class="text-slate-400" id="branch-info-addr">Av. Francisco de Miranda, Centro Plaza, Nivel 3, Local 22</div>
              <div class="text-[10px] text-emerald-400" id="branch-info-sched">Horario: Lunes a Sábado: 9:00 AM - 7:00 PM</div>
            </div>
          </div>

          <!-- Subsección Delivery Caracas -->
          <div id="section-delivery-details" class="hidden space-y-3 pt-2">
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Municipio de Caracas:</label>
              <select id="checkout-municipality" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                ${deliveryZones.map(z => `
                  <option value="${z.municipality}" data-cost="${z.cost}">
                    ${z.municipality} (+$${z.cost.toFixed(2)}) - Tiempo aprox: ${z.time}
                  </option>
                `).join('')}
              </select>
            </div>
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Dirección Exacta y Punto de Referencia:</label>
              <textarea id="checkout-delivery-address" rows="2" placeholder="Ej: Urb. Los Palos Grandes, 2da Avenida, Res. Ávila, Piso 4, Apto 4-B. Punto de referencia: Al lado de la panadería." class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"></textarea>
            </div>
          </div>
        </div>

        <!-- PASO 2: DATOS DEL CLIENTE -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <i class="fa-solid fa-user text-cyan-400"></i> Datos de Contacto y Facturación:
            </h3>
            ${(state.currentUser && state.currentUser.id !== 'guest') ? `
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                <i class="fa-solid fa-circle-check"></i> @${state.currentUser.username}
              </span>
            ` : `
              <button type="button" id="btn-cart-login-prompt" class="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-bold">
                Iniciar Sesión / Registro
              </button>
            `}
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Nombre Completo:*</label>
              <input type="text" id="cust-name" value="${(state.currentUser && state.currentUser.id !== 'guest') ? (state.currentUser.fullName || '') : ''}" placeholder="Ej: Pedro Pérez" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Cédula / RIF:</label>
              <input type="text" id="cust-ci" placeholder="V-12345678" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Teléfono Móvil:*</label>
              <input type="text" id="cust-phone" value="${(state.currentUser && state.currentUser.id !== 'guest') ? (state.currentUser.phone || '') : ''}" placeholder="0412-1234567" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Correo Electrónico:</label>
              <input type="email" id="cust-email" value="${(state.currentUser && state.currentUser.id !== 'guest') ? (state.currentUser.email || '') : ''}" placeholder="pedro@ejemplo.com" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
          </div>
        </div>

        <!-- PASO 3: FORMAS DE PAGO EN VENEZUELA -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <i class="fa-solid fa-wallet text-cyan-400"></i> Forma de Pago:
            </h3>
            <span class="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Tasa BCV: ${settings.bcv_rate.toFixed(2)} Bs/$
            </span>
          </div>

          <!-- Selector de Método de Pago -->
          <div class="grid grid-cols-3 gap-1.5 text-xs">
            <button type="button" data-pay="pago_movil" class="pay-btn active p-2 rounded-xl border border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold flex flex-col items-center gap-1">
              <i class="fa-solid fa-mobile-screen-button text-base"></i>
              <span class="text-[10px]">Pago Móvil</span>
            </button>
            <button type="button" data-pay="efectivo" class="pay-btn p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold flex flex-col items-center gap-1">
              <i class="fa-solid fa-money-bill-wave text-base"></i>
              <span class="text-[10px]">Efectivo ($)</span>
            </button>
            <button type="button" data-pay="zelle" class="pay-btn p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold flex flex-col items-center gap-1">
              <i class="fa-solid fa-bolt text-base"></i>
              <span class="text-[10px]">Zelle</span>
            </button>
            <button type="button" data-pay="binance" class="pay-btn p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold flex flex-col items-center gap-1">
              <i class="fa-brands fa-bitcoin text-base"></i>
              <span class="text-[10px]">Binance Pay</span>
            </button>
            <button type="button" data-pay="paypal" class="pay-btn p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold flex flex-col items-center gap-1">
              <i class="fa-brands fa-paypal text-base"></i>
              <span class="text-[10px]">PayPal</span>
            </button>
            <button type="button" data-pay="pos_tienda" class="pay-btn p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold flex flex-col items-center gap-1">
              <i class="fa-solid fa-credit-card text-base"></i>
              <span class="text-[10px]">Punto en Tienda</span>
            </button>
          </div>

          <!-- Contenedor dinámico de datos de la forma de pago elegida -->
          <div id="payment-details-box" class="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <!-- Dinámico por JS -->
          </div>
        </div>

        <!-- RESUMEN FINAL DE CUENTA -->
        <div class="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between text-xs text-slate-400">
            <span>Subtotal hardware:</span>
            <span class="font-orbitron font-semibold text-slate-200" id="summary-subtotal">${formatUsd(subtotalUsd)}</span>
          </div>
          <div class="flex justify-between text-xs text-slate-400">
            <span>Costo de Envío:</span>
            <span class="font-orbitron font-semibold text-emerald-400" id="summary-delivery">$0.00 (Retiro en Tienda)</span>
          </div>
          <div class="pt-2 border-t border-slate-800 flex justify-between items-baseline">
            <span class="text-sm font-bold text-white">Total a Pagar:</span>
            <div class="text-right">
              <div class="text-lg font-black font-orbitron text-cyan-400" id="summary-total-usd">${formatUsd(subtotalUsd)}</div>
              <div class="text-xs font-bold text-slate-300" id="summary-total-bs">${formatBs(subtotalUsd)}</div>
            </div>
          </div>
        </div>

        <!-- BOTÓN DE CONFIRMACIÓN DE PEDIDO -->
        <button id="btn-process-checkout" class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 active:scale-95">
          <i class="fa-solid fa-lock"></i>
          <span>Confirmar y Procesar Pedido</span>
        </button>
      </div>
    `;

    appContainer.innerHTML = html;

    // LÓGICA DE CONTROL DEL CHECKOUT
    let checkoutState = {
      deliveryType: 'pickup',
      branchId: branches[0]?.id || 'suc-altamira',
      branchName: branches[0]?.name || 'Sucursal Altamira',
      pickupDate: new Date().toISOString().split('T')[0],
      pickupTime: '10:00 AM - 12:00 PM',
      municipality: deliveryZones[0]?.municipality || 'Chacao',
      deliveryFee: 0,
      paymentMethod: 'pago_movil'
    };

    // Actualizar caja de sucursal
    const updateBranchInfo = () => {
      const select = document.getElementById('checkout-branch');
      const b = branches.find(item => item.id === select.value);
      if (b) {
        checkoutState.branchId = b.id;
        checkoutState.branchName = b.name;
        document.getElementById('branch-info-name').textContent = b.name;
        document.getElementById('branch-info-addr').textContent = b.address;
        document.getElementById('branch-info-sched').textContent = `Horario: ${b.schedule}`;
      }
    };

    // Cambiar entre Retiro y Delivery
    const btnPickup = document.getElementById('tab-delivery-pickup');
    const btnDelivery = document.getElementById('tab-delivery-courier');
    const secPickup = document.getElementById('section-pickup-details');
    const secDelivery = document.getElementById('section-delivery-details');
    const summaryDelivery = document.getElementById('summary-delivery');
    const summaryTotalUsd = document.getElementById('summary-total-usd');
    const summaryTotalBs = document.getElementById('summary-total-bs');

    const updateTotals = () => {
      const totalUsd = subtotalUsd + checkoutState.deliveryFee;
      summaryTotalUsd.textContent = formatUsd(totalUsd);
      summaryTotalBs.textContent = formatBs(totalUsd);
    };

    btnPickup.addEventListener('click', () => {
      checkoutState.deliveryType = 'pickup';
      checkoutState.deliveryFee = 0;
      btnPickup.className = 'delivery-type-btn active py-2.5 px-3 rounded-xl border border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold text-xs flex flex-col items-center gap-1';
      btnDelivery.className = 'delivery-type-btn py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs flex flex-col items-center gap-1';
      secPickup.classList.remove('hidden');
      secDelivery.classList.add('hidden');
      summaryDelivery.textContent = '$0.00 (Retiro en Tienda)';
      summaryDelivery.className = 'font-orbitron font-semibold text-emerald-400';
      updateTotals();
    });

    btnDelivery.addEventListener('click', () => {
      checkoutState.deliveryType = 'delivery';
      const munSelect = document.getElementById('checkout-municipality');
      const cost = parseFloat(munSelect.options[munSelect.selectedIndex]?.dataset.cost || 3);
      checkoutState.deliveryFee = cost;
      checkoutState.municipality = munSelect.value;
      btnDelivery.className = 'delivery-type-btn active py-2.5 px-3 rounded-xl border border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold text-xs flex flex-col items-center gap-1';
      btnPickup.className = 'delivery-type-btn py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs flex flex-col items-center gap-1';
      secDelivery.classList.remove('hidden');
      secPickup.classList.add('hidden');
      summaryDelivery.textContent = `+$${cost.toFixed(2)} (${munSelect.value})`;
      summaryDelivery.className = 'font-orbitron font-semibold text-cyan-400';
      updateTotals();
    });

    document.getElementById('checkout-branch').addEventListener('change', updateBranchInfo);
    document.getElementById('checkout-municipality').addEventListener('change', (e) => {
      const cost = parseFloat(e.target.options[e.target.selectedIndex]?.dataset.cost || 3);
      checkoutState.deliveryFee = cost;
      checkoutState.municipality = e.target.value;
      summaryDelivery.textContent = `+$${cost.toFixed(2)} (${e.target.value})`;
      updateTotals();
    });

    // Cambiar Método de Pago
    const renderPaymentBox = (method) => {
      checkoutState.paymentMethod = method;
      const box = document.getElementById('payment-details-box');
      const totalUsd = subtotalUsd + checkoutState.deliveryFee;
      const totalBs = totalUsd * settings.bcv_rate;

      if (method === 'pago_movil') {
        const pm = settings.payment_accounts?.pago_movil || {};
        box.innerHTML = `
          <div class="space-y-1.5">
            <div class="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
              <span>Datos para Pago Móvil Interbancario:</span>
              <span class="text-white">${formatBs(totalUsd)}</span>
            </div>
            <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-300 bg-slate-900 p-2 rounded-xl border border-slate-800">
              <div><span class="text-slate-500">Banco:</span> ${pm.bank || 'Banesco (0134)'}</div>
              <div><span class="text-slate-500">Teléfono:</span> ${pm.phone || '0412-5558899'}</div>
              <div><span class="text-slate-500">RIF:</span> ${pm.rif || 'J-50123984-0'}</div>
              <div><span class="text-slate-500">Titular:</span> ${pm.beneficiary || 'Nexus Hardware C.A.'}</div>
            </div>
            <div class="pt-1">
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Número de Referencia (Últimos 6 dígitos):</label>
              <input type="text" id="pay-ref" placeholder="Ej: 492019" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
          </div>
        `;
      } else if (method === 'efectivo') {
        box.innerHTML = `
          <div class="space-y-1.5">
            <div class="text-[11px] font-bold text-emerald-400">Pago en Efectivo ($ USD):</div>
            <p class="text-[11px] text-slate-300">
              Pagas en persona al retirar en la sucursal o al repartidor al recibir el delivery. Se aceptan billetes en buen estado sin roturas ni marcas.
            </p>
            <div class="pt-1">
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">¿Con cuánto billete pagarás? (Para coordinar cambio):</label>
              <input type="text" id="pay-cash-denomination" placeholder="Ej: Pago con billete de $100" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
          </div>
        `;
      } else if (method === 'zelle') {
        const zelle = settings.payment_accounts?.zelle || {};
        box.innerHTML = `
          <div class="space-y-1.5">
            <div class="text-[11px] font-bold text-cyan-400">Datos Oficiales Zelle:</div>
            <div class="text-[11px] text-slate-300 bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-0.5">
              <div><span class="text-slate-500">Correo Zelle:</span> <b class="text-white">${zelle.email || 'pagos@nexushardware.com'}</b></div>
              <div><span class="text-slate-500">Titular:</span> ${zelle.beneficiary || 'Nexus Hardware LLC'}</div>
              <div><span class="text-slate-500">Monto exacto:</span> <b class="text-cyan-400">${formatUsd(totalUsd)}</b></div>
            </div>
            <div class="pt-1">
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Nombre del Titular de la cuenta Zelle emisora:</label>
              <input type="text" id="pay-ref" placeholder="Ej: Titular Zelle / Referencia" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
          </div>
        `;
      } else if (method === 'binance') {
        const b = settings.payment_accounts?.binance || {};
        box.innerHTML = `
          <div class="space-y-1.5">
            <div class="text-[11px] font-bold text-amber-400">Binance Pay (Cero Comisión):</div>
            <div class="text-[11px] text-slate-300 bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-0.5">
              <div><span class="text-slate-500">Binance Pay ID:</span> <b class="text-amber-300">${b.pay_id || '883921049'}</b></div>
              <div><span class="text-slate-500">Moneda:</span> USDT / USDC (Equivalente: ${formatUsd(totalUsd)})</div>
            </div>
            <div class="pt-1">
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">ID de Transacción / Order ID Binance:</label>
              <input type="text" id="pay-ref" placeholder="Ej: 3940291039" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
          </div>
        `;
      } else if (method === 'paypal') {
        const pp = settings.payment_accounts?.paypal || {};
        box.innerHTML = `
          <div class="space-y-1.5">
            <div class="text-[11px] font-bold text-blue-400">PayPal Checkout:</div>
            <div class="text-[11px] text-slate-300 bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-0.5">
              <div><span class="text-slate-500">Cuenta:</span> <b class="text-white">${pp.email || 'ventas@nexushardware.com'}</b></div>
              <div><span class="text-slate-500">Total a transferir:</span> <b class="text-cyan-400">${formatUsd(totalUsd)}</b></div>
            </div>
            <div class="pt-1">
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">ID de Transacción PayPal:</label>
              <input type="text" id="pay-ref" placeholder="Ej: 9XR182910" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
            </div>
          </div>
        `;
      } else if (method === 'pos_tienda') {
        box.innerHTML = `
          <div class="space-y-1.5">
            <div class="text-[11px] font-bold text-cyan-400">Punto de Venta / Biopago en Tienda:</div>
            <p class="text-[11px] text-slate-300">
              Pasa tus tarjetas de débito o crédito nacional, Biopago BDV o tarjeta internacional directamente en la sucursal al retirar tu producto. Tasa oficial BCV.
            </p>
          </div>
        `;
      }
    };

    renderPaymentBox('pago_movil');

    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pay-btn').forEach(b => {
          b.className = 'pay-btn p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold flex flex-col items-center gap-1';
        });
        btn.className = 'pay-btn active p-2 rounded-xl border border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold flex flex-col items-center gap-1';
        renderPaymentBox(btn.dataset.pay);
      });
    });

    // Control de cantidades dentro del carrito
    document.querySelectorAll('.cart-qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        const action = btn.dataset.action;
        const item = state.cart[idx];

        if (action === 'inc') {
          if (item.qty < item.product.stock) {
            item.qty += 1;
          } else {
            showToast(`Máximo stock disponible alcanzado (${item.product.stock})`, 'warning');
          }
        } else if (action === 'dec') {
          item.qty -= 1;
          if (item.qty <= 0) {
            state.cart.splice(idx, 1);
          }
        }
        updateCartBadge();
        renderCartView();
      });
    });

    document.getElementById('btn-empty-cart').addEventListener('click', () => {
      state.cart = [];
      updateCartBadge();
      renderCartView();
      showToast('Carrito vaciado', 'info');
    });

    document.getElementById('btn-cart-login-prompt')?.addEventListener('click', () => openAuthModal('auto'));

    // PROCESAMIENTO FINAL DEL PEDIDO (Guarda en BD y Descuenta Stock)
    document.getElementById('btn-process-checkout').addEventListener('click', async () => {
      const custName = document.getElementById('cust-name').value.trim();
      const custPhone = document.getElementById('cust-phone').value.trim();
      const custCi = document.getElementById('cust-ci').value.trim();
      const custEmail = document.getElementById('cust-email').value.trim();

      if (!custName || !custPhone) {
        showToast('Por favor ingresa al menos Nombre y Teléfono de contacto.', 'error');
        return;
      }

      if (checkoutState.deliveryType === 'delivery') {
        const address = document.getElementById('checkout-delivery-address').value.trim();
        if (!address) {
          showToast('Ingresa la dirección detallada para el delivery en Caracas.', 'error');
          return;
        }
        checkoutState.deliveryAddress = address;
      } else {
        checkoutState.pickupDate = document.getElementById('checkout-pickup-date').value;
        checkoutState.pickupTime = document.getElementById('checkout-pickup-time').value;
      }

      const refInput = document.getElementById('pay-ref');
      const cashInput = document.getElementById('pay-cash-denomination');
      const paymentRef = refInput ? refInput.value.trim() : cashInput ? cashInput.value.trim() : 'Presencial';

      const totalUsd = subtotalUsd + checkoutState.deliveryFee;
      const totalBs = totalUsd * settings.bcv_rate;

      const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      /**
       * PARA QUÉ SE HIZO:
       * Registrar la orden de compra con identificación exclusiva del cliente activo (RBAC)
       * y emitir de forma inmediata la factura digital legal (FACT-XXXXXX) para que el
       * cliente pueda descargarla en ese mismo instante.
       *
       * CÓMO SE HIZO:
       * Asocia 'userId' y 'username' de 'state.currentUser', asigna correlativo fiscal oficial
       * ('invoiceNumber' y 'controlNumber'), y registra los datos de contacto y facturación.
       */
      const orderPayload = {
        id: orderId,
        date: new Date().toISOString(),
        userId: state.currentUser?.id || 'guest',
        username: state.currentUser?.username || 'invitado',
        invoiceNumber: `FACT-${orderId.replace('ORD-', '')}`,
        controlNumber: `00-${orderId.replace('ORD-', '')}-2026`,
        customer: {
          name: custName,
          phone: custPhone,
          ci: custCi || 'V-No especificado',
          email: custEmail || (state.currentUser?.email || 'No especificado')
        },
        deliveryType: checkoutState.deliveryType,
        branchId: checkoutState.branchId,
        branchName: checkoutState.branchName,
        pickupDate: checkoutState.pickupDate,
        pickupTime: checkoutState.pickupTime,
        deliveryAddress: checkoutState.deliveryAddress,
        municipality: checkoutState.municipality,
        items: state.cart.map(i => ({
          productId: i.product.id,
          name: i.product.name,
          price: i.product.price,
          qty: i.qty
        })),
        subtotal: subtotalUsd,
        deliveryFee: checkoutState.deliveryFee,
        totalUsd: totalUsd,
        totalBs: totalBs,
        bcvRate: settings.bcv_rate,
        paymentMethod: checkoutState.paymentMethod,
        paymentDetails: {
          reference: paymentRef
        },
        status: checkoutState.paymentMethod === 'pago_movil' || checkoutState.paymentMethod === 'zelle' ? 'Listo para retiro' : 'Confirmado'
      };

      try {
        // Ejecutar en BD local y actualizar stock
        const createdOrder = await window.dbManager.processOrder(orderPayload);
        
        // Registrar en memoria de sesión si el usuario compra en modo invitado
        state.sessionGuestOrders = state.sessionGuestOrders || [];
        state.sessionGuestOrders.push(createdOrder.id);

        state.cart = [];
        updateCartBadge();
        showOrderConfirmationModal(createdOrder);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================
  // MÓDULO DE EMISIÓN DE FACTURAS Y COMPROBANTES DE PAGO
  // ==========================================================
  let activeInvoiceOrder = null;
  let activeInvoiceDocType = 'factura'; // 'factura' | 'receipt'
  let adminFiscalPeriod = 'day'; // 'day' | 'week' | 'month' | 'year' | 'all'

  const modalInvoice = document.getElementById('modal-invoice');
  const btnCloseInvoice = document.getElementById('modal-invoice-close');
  const btnDocTypeInvoice = document.getElementById('btn-doc-type-invoice');
  const btnDocTypeReceipt = document.getElementById('btn-doc-type-receipt');
  const btnInvoicePrint = document.getElementById('btn-invoice-print');
  const btnInvoiceDownloadHtml = document.getElementById('btn-invoice-download-html');
  const btnToggleEmailPanel = document.getElementById('btn-toggle-email-panel');
  const btnCloseEmailDrawer = document.getElementById('btn-close-email-drawer');
  const invoiceEmailDrawer = document.getElementById('invoice-email-drawer');
  const invoiceTargetEmail = document.getElementById('invoice-target-email');
  const btnSendEmailAction = document.getElementById('btn-send-email-action');
  const btnMailtoFallback = document.getElementById('btn-mailto-fallback');
  const invoiceEmailStatus = document.getElementById('invoice-email-status');
  const invoiceEmailStatusText = document.getElementById('invoice-email-status-text');
  const invoicePreviewContainer = document.getElementById('invoice-preview-container');
  const invoicePrintContainer = document.getElementById('invoice-print-container');

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Diseñar y proveer un logotipo vectorial oficial, moderno y de alta fidelidad
   * estética Cyberpunk para "Nexus Hardware Caracas".
   *
   * CÓMO SE HIZO:
   * Retorna un elemento SVG vectorial completo y escalable con gradientes de neón
   * (cian a púrpura), escudo hexagonal blindado, pistas de microcircuitos y
   * monograma "N" central con resplandor digital. Se inyecta tanto en la interfaz
   * móvil como en facturas descargables, impresiones en PDF y reportes tributarios.
   * =========================================================================
   */
  function getNexusStoreLogoSvg(size = 40, showText = false) {
    const idPrefix = 'nexus_brand_' + Math.random().toString(36).substring(2, 7);
    return `
      <div style="display: inline-flex; align-items: center; gap: 10px;">
        <svg class="store-logo-svg" style="width: ${size}px; height: ${size}px; min-width: ${size}px;" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="${idPrefix}_hexBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0f172a" />
              <stop offset="50%" stop-color="#1e1b4b" />
              <stop offset="100%" stop-color="#080c14" />
            </linearGradient>
            <linearGradient id="${idPrefix}_neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#22d3ee" />
              <stop offset="50%" stop-color="#6366f1" />
              <stop offset="100%" stop-color="#a855f7" />
            </linearGradient>
            <linearGradient id="${idPrefix}_letterN" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#06b6d4" />
              <stop offset="45%" stop-color="#38bdf8" />
              <stop offset="100%" stop-color="#c084fc" />
            </linearGradient>
            <filter id="${idPrefix}_glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <polygon points="60,8 104,33 104,87 60,112 16,87 16,33" fill="url(#${idPrefix}_hexBg)" stroke="url(#${idPrefix}_neonGlow)" stroke-width="3" stroke-linejoin="round" />
          <path d="M16 60 H34 L42 68" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-opacity="0.8" />
          <circle cx="42" cy="68" r="2.5" fill="#22d3ee" />
          <path d="M104 60 H86 L78 52" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-opacity="0.8" />
          <circle cx="78" cy="52" r="2.5" fill="#c084fc" />
          <path d="M60 16 V28" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-opacity="0.8" />
          <circle cx="60" cy="28" r="2" fill="#22d3ee" />
          <path d="M42 80 V40 L72 80 V40" stroke="url(#${idPrefix}_letterN)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#${idPrefix}_glow)" />
          <polygon points="57,60 60,55 63,60 60,65" fill="#ffffff" />
        </svg>
        ${showText ? `
          <div>
            <div style="font-family: Orbitron, sans-serif; font-weight: 900; font-size: 15px; letter-spacing: 0.5px; color: #ffffff; line-height: 1.1;">
              NEXUS <span style="color: #22d3ee;">HARDWARE</span>
            </div>
            <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">
              Caracas &bull; High Performance
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Validar estrictamente la pertenencia de una orden de compra a un cliente específico (RBAC),
   * asegurando que un usuario cliente no pueda ver las órdenes de otros clientes de la tienda.
   *
   * CÓMO SE HIZO:
   * Compara los identificadores disponibles en la orden (userId, username, customer.email,
   * customer.phone) contra el usuario actualmente autenticado (state.currentUser).
   * - Si el usuario es 'admin': tiene acceso irrestricto y puede ver todas las órdenes.
   * - Si es 'cliente': debe coincidir con su ID de usuario o sus credenciales verificadas.
   * - Si es 'guest': solo ve órdenes generadas durante su sesión temporal activa.
   * =========================================================================
   */
  function isUserOrder(order, user) {
    if (!user) return false;
    if (user.role === 'admin') return true; // Administrador tiene acceso total

    // Coincidencia por ID de usuario
    if (order.userId && order.userId === user.id) return true;

    // Coincidencia por nombre de usuario
    if (order.username && user.username && order.username.toLowerCase() === user.username.toLowerCase()) return true;

    // Coincidencia por correo electrónico registrado
    const ordEmail = order.customer?.email?.trim().toLowerCase();
    const userEmail = user.email?.trim().toLowerCase();
    if (ordEmail && userEmail && ordEmail === userEmail && userEmail !== 'no especificado') return true;

    // Coincidencia por teléfono móvil
    const ordPhone = order.customer?.phone?.replace(/\D/g, '');
    const userPhone = user.phone?.replace(/\D/g, '');
    if (ordPhone && userPhone && ordPhone === userPhone && ordPhone.length > 6) return true;

    // Si el usuario realizó una compra en esta misma sesión como invitado
    if (user.id === 'guest' && Array.isArray(state.sessionGuestOrders) && state.sessionGuestOrders.includes(order.id)) {
      return true;
    }

    return false;
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Filtrar con precisión temporal las órdenes para que la cuenta Administrador
   * pueda emitir y auditar las facturas del día (hoy), de la semana, del mes o del año.
   *
   * CÓMO SE HIZO:
   * Analiza la fecha ISO de cada orden y la contrasta contra los límites del calendario:
   * - 'day': Mismo día calendario local (hoy).
   * - 'week': Últimos 7 días móviles desde la fecha actual.
   * - 'month': Mismo mes y año en curso (ej. Octubre 2026).
   * - 'year': Mismo año calendario en curso (ej. 2026).
   * - 'all': Todas las facturas históricas registradas.
   * =========================================================================
   */
  function filterOrdersByFiscalPeriod(orders, period = 'day') {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    return orders.filter(ord => {
      if (!ord.date) return false;
      const d = new Date(ord.date);
      if (isNaN(d.getTime())) return false;

      switch (period) {
        case 'day': {
          return d.getFullYear() === todayY && d.getMonth() === todayM && d.getDate() === todayD;
        }
        case 'week': {
          const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          return d >= sevenDaysAgo && d <= now;
        }
        case 'month': {
          return d.getFullYear() === todayY && d.getMonth() === todayM;
        }
        case 'year': {
          return d.getFullYear() === todayY;
        }
        case 'all':
        default:
          return true;
      }
    });
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Permitir a la cuenta de Administrador emitir formalmente el Libro Fiscal de Ventas
   * y Resumen Consolidado de Facturas del Día, de la Semana, del Mes o del Año,
   * con formato tributario oficial de la República Bolivariana de Venezuela,
   * listo para descargar en HTML o imprimir/guardar en PDF.
   *
   * CÓMO SE HIZO:
   * 1. Totaliza montos en USD y Bolívares calculados a la tasa oficial BCV del día.
   * 2. Desglosa cada factura emitida en el período (N° Factura, Control, Cliente, RIF,
   *    Método de pago, Referencia bancaria, Total).
   * 3. Incluye membrete legal oficial de Nexus Hardware Caracas, C.A. (RIF J-50129482-1),
   *    código de validación y firma de la Gerencia de Administración.
   * =========================================================================
   */
  function generatePeriodBillingReportHTML(orders, period = 'day', settings = state.settings) {
    const bcvRate = settings?.bcv_rate || 889.57;
    const periodTitles = {
      day: 'LIBRO DE VENTAS & FACTURACIÓN DEL DÍA (HOY)',
      week: 'REPORTE CONSOLIDADO DE FACTURACIÓN SEMANAL (ÚLTIMOS 7 DÍAS)',
      month: 'LIBRO DE VENTAS & FACTURACIÓN FISCAL MENSUAL',
      year: 'BALANCE ANUAL DE FACTURACIÓN & EMISIÓN FISCAL',
      all: 'LIBRO HISTÓRICO CONSOLIDADO DE FACTURACIÓN'
    };

    const periodName = periodTitles[period] || 'REPORTE FISCAL DE FACTURAS';
    const nowStr = new Date().toLocaleString('es-VE', { 
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const totalUsd = orders.reduce((sum, o) => sum + (o.totalUsd || 0), 0);
    const totalBs = orders.reduce((sum, o) => sum + (o.totalBs || (o.totalUsd * bcvRate) || 0), 0);
    const totalItems = orders.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.qty || 1), 0) : 0), 0);
    const avgTicket = orders.length > 0 ? (totalUsd / orders.length) : 0;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${periodName} - Nexus Hardware Caracas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { background: #f8fafc; color: #0f172a; padding: 24px; display: flex; justify-content: center; }
    .report-card { background: #ffffff; max-width: 950px; width: 100%; border: 1px solid #cbd5e1; border-radius: 14px; padding: 30px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.07); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0891b2; padding-bottom: 18px; margin-bottom: 20px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; }
    .company-sub { font-size: 11px; color: #64748b; line-height: 1.5; margin-top: 4px; }
    .doc-badge-col { text-align: right; }
    .doc-type-badge { display: inline-block; background: #ecfeff; color: #0891b2; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a5f3fc; text-transform: uppercase; margin-bottom: 6px; }
    .doc-date { font-size: 11px; color: #64748b; margin-top: 2px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .kpi-lbl { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-val { font-size: 18px; font-weight: 800; color: #0891b2; font-family: monospace; }
    .kpi-val-bs { font-size: 11px; color: #475569; font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; font-weight: 700; }
    th.text-right, td.text-right { text-align: right; }
    td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
    tr:nth-child(even) td { background: #f8fafc; }
    .totals-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; }
    .btn-print { background: #0891b2; color: #ffffff; border: none; padding: 8px 16px; font-size: 12px; font-weight: 700; border-radius: 8px; cursor: pointer; }
    .btn-print:hover { background: #0e7490; }
    .print-bar { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    .footer-stamp { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 10px; color: #64748b; }
    .sign-box { border-top: 1px dashed #94a3b8; width: 220px; text-align: center; padding-top: 6px; font-weight: 600; font-size: 11px; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .report-card { border: none; box-shadow: none; max-width: 100%; padding: 0; }
      .print-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="print-bar">
      <div style="font-size: 12px; font-weight: 700; color: #0891b2;">
        🏛️ Sistema de Administración y Auditoría Fiscal Nexus Hardware Caracas
      </div>
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
    </div>

    <div class="header-row">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${getNexusStoreLogoSvg(48, false)}
        <div>
          <div class="company-title">NEXUS HARDWARE CARACAS, C.A.</div>
          <div class="company-sub">
            <b>RIF:</b> J-50129482-1 &bull; <b>NIT:</b> 0491823011<br>
            Av. Francisco de Miranda, Centro Plaza, Nivel 3, Ofic. 22, Chacao, Caracas, Venezuela.<br>
            Teléfono: +58 212-993-4411 &bull; facturacion@nexushardware.com
          </div>
        </div>
      </div>
      <div class="doc-badge-col">
        <span class="doc-type-badge">${periodName}</span>
        <div style="font-size: 12px; font-weight: 700; color: #0891b2;">Tasa BCV Oficial: ${bcvRate.toFixed(2)} Bs/$</div>
        <div class="doc-date">Fecha de Emisión: ${nowStr}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-lbl">Facturas Emitidas</div>
        <div class="kpi-val">${orders.length}</div>
        <div class="kpi-val-bs">${totalItems} componentes</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Monto Facturado ($)</div>
        <div class="kpi-val">$${totalUsd.toFixed(2)}</div>
        <div class="kpi-val-bs">Divisas USD</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Total en Bolívares</div>
        <div class="kpi-val" style="font-size: 14px;">${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.</div>
        <div class="kpi-val-bs">A tasa oficial BCV</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Ticket Promedio ($)</div>
        <div class="kpi-val">$${avgTicket.toFixed(2)}</div>
        <div class="kpi-val-bs">Por orden comercial</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>N° Factura</th>
          <th>N° Control</th>
          <th>Fecha / Hora</th>
          <th>Cliente Receptor</th>
          <th>C.I. / RIF</th>
          <th>Método de Pago</th>
          <th class="text-right">Total ($ USD)</th>
          <th class="text-right">Total en Bs.</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${orders.length > 0 ? orders.map(ord => {
          const ordDate = new Date(ord.date).toLocaleString('es-VE', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          const factNum = ord.invoiceNumber || `FACT-${ord.id.replace('ORD-', '')}`;
          const ctrlNum = ord.controlNumber || `00-${ord.id.replace('ORD-', '')}-2026`;
          const bsVal = ord.totalBs || (ord.totalUsd * bcvRate);
          return `
            <tr>
              <td style="font-weight: 700; font-family: monospace; color: #0891b2;">${factNum}</td>
              <td style="font-family: monospace; font-size: 10px; color: #64748b;">${ctrlNum}</td>
              <td>${ordDate}</td>
              <td style="font-weight: 600;">${ord.customer?.name || 'Cliente'}</td>
              <td style="font-family: monospace;">${ord.customer?.ci || 'V-No esp.'}</td>
              <td>${formatPaymentMethodName(ord.paymentMethod)} ${ord.paymentDetails?.reference ? `<small style="font-family: monospace;">(Ref: ${ord.paymentDetails.reference})</small>` : ''}</td>
              <td class="text-right" style="font-weight: 700;">$${ord.totalUsd.toFixed(2)}</td>
              <td class="text-right" style="font-weight: 600;">${bsVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.</td>
              <td><span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0369a1;">${ord.status}</span></td>
            </tr>
          `;
        }).join('') : `
          <tr>
            <td colspan="9" style="text-align: center; padding: 20px; color: #64748b;">
              No se registraron facturas emitidas en el período seleccionado.
            </td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="totals-box">
      <div>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a;">CONCILIACIÓN Y BALANCE FISCAL CONSOLIDADO</div>
        <div style="font-size: 11px; color: #64748b;">Libro de ventas generado de conformidad con la normativa del SENIAT y el Banco Central de Venezuela.</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 16px; font-weight: 800; color: #0891b2;">TOTAL GENERAL: $${totalUsd.toFixed(2)} USD</div>
        <div style="font-size: 13px; font-weight: 700; color: #1e293b;">${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bolívares</div>
      </div>
    </div>

    <div class="footer-stamp">
      <div style="max-width: 480px;">
        <b>Nexus Hardware Caracas, C.A. &bull; RIF: J-50129482-1</b><br>
        Documento mercantil emitido electrónicamente como libro auxiliar de ventas y facturación. Válido a efectos de auditoría y control de inventarios.
      </div>
      <div class="sign-box">
        Firma Autorizada y Sello<br>
        <span style="font-size: 9px; color: #64748b;">Gerencia de Administración y Finanzas</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Descargar en archivo HTML el Libro de Ventas y Reporte Fiscal del período seleccionado
   * (del día, de la semana, del mes o del año) para la cuenta administrador.
   *
   * CÓMO SE HIZO:
   * Genera el HTML enriquecido con generatePeriodBillingReportHTML, construye un Blob
   * en memoria y ejecuta la descarga local en el navegador del usuario.
   * =========================================================================
   */
  function downloadPeriodBillingReport(orders, period) {
    const html = generatePeriodBillingReportHTML(orders, period, state.settings);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Libro_Fiscal_Facturas_${period.toUpperCase()}_Nexus_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Libro de Facturación (${period}) descargado exitosamente.`, 'success');
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Imprimir o Guardar en PDF el Libro Fiscal de Facturación del período seleccionado
   * para el Administrador.
   *
   * CÓMO SE HIZO:
   * Abre una ventana emergente limpia con el reporte formateado y llama a window.print().
   * =========================================================================
   */
  function printPeriodBillingReport(orders, period) {
    const html = generatePeriodBillingReportHTML(orders, period, state.settings);
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 350);
    } else {
      if (invoicePrintContainer) {
        invoicePrintContainer.innerHTML = html;
        window.print();
      }
    }
    showToast('Generando reporte fiscal para impresión / Guardar en PDF...', 'info');
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Permitir al Administrador descargar en un único lote todas las facturas individuales
   * del período seleccionado en un dossier comercial unificado.
   *
   * CÓMO SE HIZO:
   * Compila el HTML individual de cada orden del período separadas por salto de página
   * para impresión o auditoría completa en un solo archivo.
   * =========================================================================
   */
  function batchDownloadInvoicesHTML(orders, period) {
    if (!orders || orders.length === 0) {
      showToast('No hay facturas registradas en este período para descargar.', 'warning');
      return;
    }

    let dossierContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Lote de Facturas (${period.toUpperCase()}) - Nexus Hardware Caracas</title>
  <style>
    @media print {
      .invoice-page { page-break-after: always; }
    }
    .invoice-page { margin-bottom: 40px; }
  </style>
</head>
<body style="background: #f1f5f9; padding: 20px;">
`;

    for (const ord of orders) {
      const singleHtml = generateStandaloneInvoiceHTML(ord, 'factura');
      // Extraer el cuerpo de la tarjeta para compilar
      const bodyMatch = singleHtml.match(/<div class="invoice-card">([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        dossierContent += `<div class="invoice-page"><div class="invoice-card" style="background:#fff;max-width:800px;margin:0 auto;border:1px solid #cbd5e1;border-radius:16px;padding:32px;">${bodyMatch[1]}</div>`;
      }
    }

    dossierContent += `</body></html>`;

    const blob = new Blob([dossierContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lote_Facturas_${period.toUpperCase()}_Nexus_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Lote de ${orders.length} facturas descargado con éxito.`, 'success');
  }

  function getQrSvg() {
    return `<svg class="w-16 h-16 inline-block" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="white" rx="8"/>
      <rect x="10" y="10" width="26" height="26" fill="#0f172a"/>
      <rect x="15" y="15" width="16" height="16" fill="white"/>
      <rect x="18" y="18" width="10" height="10" fill="#0f172a"/>
      <rect x="64" y="10" width="26" height="26" fill="#0f172a"/>
      <rect x="69" y="15" width="16" height="16" fill="white"/>
      <rect x="72" y="18" width="10" height="10" fill="#0f172a"/>
      <rect x="10" y="64" width="26" height="26" fill="#0f172a"/>
      <rect x="15" y="69" width="16" height="16" fill="white"/>
      <rect x="18" y="72" width="10" height="10" fill="#0f172a"/>
      <rect x="42" y="14" width="8" height="8" fill="#0f172a"/>
      <rect x="52" y="24" width="8" height="8" fill="#0f172a"/>
      <rect x="42" y="34" width="8" height="8" fill="#0f172a"/>
      <rect x="42" y="44" width="18" height="8" fill="#0f172a"/>
      <rect x="64" y="44" width="10" height="10" fill="#0f172a"/>
      <rect x="78" y="52" width="12" height="8" fill="#0f172a"/>
      <rect x="45" y="64" width="10" height="10" fill="#0f172a"/>
      <rect x="58" y="74" width="12" height="8" fill="#0f172a"/>
      <rect x="74" y="68" width="16" height="16" fill="#0f172a"/>
      <rect x="79" y="73" width="6" height="6" fill="white"/>
    </svg>`;
  }

  function formatPaymentMethodName(method) {
    const map = {
      pago_movil: 'Pago Móvil Interbancario (Banesco)',
      efectivo_usd: 'Efectivo en Dólares ($ USD)',
      zelle: 'Zelle (Transferencia Directa USD)',
      binance_pay: 'Binance Pay (Criptoactivos USDT)',
      paypal: 'PayPal Internacional',
      punto_venta: 'Punto de Venta / Biopago en Sucursal'
    };
    return map[method] || (method ? method.toUpperCase().replace('_', ' ') : 'Pago en Tienda');
  }

  function getPaymentChannelAccount(method) {
    switch (method) {
      case 'pago_movil':
        return 'Banesco (0134) &bull; RIF: J-50129482-1 &bull; Tel: +58 412-993-4411';
      case 'zelle':
        return 'pagos@nexushardware.com (Nexus Hardware Caracas LLC)';
      case 'binance_pay':
        return 'Binance Pay ID: 892301924 (NexusHardware_VE)';
      case 'paypal':
        return 'checkout@nexushardware.com';
      case 'efectivo_usd':
        return 'Taquilla / Caja Principal de Sucursal';
      default:
        return 'Terminal Punto de Venta / Biopago Presencial';
    }
  }

  function generateMailtoLink(order, docType = 'factura') {
    const isFactura = docType === 'factura';
    const email = order.customer?.email && order.customer.email.includes('@') ? order.customer.email : '';
    const subject = encodeURIComponent(`${isFactura ? 'Factura Digital' : 'Comprobante de Pago'} Nexus Hardware Caracas - ${order.id}`);
    
    const itemsList = order.items.map(i => `* ${i.qty}x ${i.name} -> $${(i.price * i.qty).toFixed(2)}`).join('\n');
    const totalBsStr = order.totalBs ? `${order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.` : '';

    const bodyText = `
Estimado(a) ${order.customer?.name || 'Cliente'},

Le hacemos entrega de su ${isFactura ? 'Factura Digital Oficial' : 'Comprobante de Pago Bancario'} emitido por Nexus Hardware Caracas, C.A.:

---------------------------------------------------------
NEXUS HARDWARE CARACAS, C.A.
RIF: J-50129482-1 | Av. Francisco de Miranda, Centro Plaza, Caracas
---------------------------------------------------------
DOCUMENTO: ${isFactura ? 'FACTURA DIGITAL' : 'COMPROBANTE DE TRANSACCIÓN'}
N° DOCUMENTO: ${isFactura ? 'FACT-' : 'COMP-'}${order.id.replace('ORD-', '')}
N° DE ORDEN: ${order.id}
FECHA: ${new Date(order.date).toLocaleString('es-VE')}
CLIENTE: ${order.customer?.name || 'Cliente'}
CÉDULA / RIF: ${order.customer?.ci || 'V-No especificado'}
TELÉFONO: ${order.customer?.phone || 'No especificado'}
MODALIDAD: ${order.deliveryType === 'pickup' ? `Retiro en Sucursal ${order.branchName}` : `Delivery en ${order.municipality}`}

DETALLE DE PRODUCTOS:
${itemsList}

SUBTOTAL: $${order.subtotal ? order.subtotal.toFixed(2) : order.totalUsd.toFixed(2)} USD
DELIVERY: $${(order.deliveryFee || 0).toFixed(2)} USD
TASA OFICIAL BCV: ${order.bcvRate ? order.bcvRate.toFixed(2) : '45.50'} Bs/$
TOTAL FINAL: $${order.totalUsd.toFixed(2)} USD (${totalBsStr})

MÉTODO DE PAGO: ${formatPaymentMethodName(order.paymentMethod)}
CUENTA RECEPTORA: ${getPaymentChannelAccount(order.paymentMethod)}
REFERENCIA / TXID: ${order.paymentDetails?.reference || 'CONCILIADO EN CAJA'}
ESTADO: ${order.status}

GARANTÍA OFICIAL:
12 meses de garantía directa de reemplazo por serial en cualquiera de nuestras 5 sucursales de Caracas.

Atentamente,
Departamento de Facturación y Despacho
Nexus Hardware Caracas, C.A.
    `.trim();

    return `mailto:${email}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  }

  function generateStandaloneInvoiceHTML(order, docType = 'factura') {
    const isFactura = docType === 'factura';
    const docTitle = isFactura ? 'FACTURA DIGITAL COMERCIAL' : 'COMPROBANTE DE TRANSACCIÓN Y PAGO';
    const docNumber = isFactura ? `FACT-${order.id.replace('ORD-', '')}` : `COMP-${order.id.replace('ORD-', '')}`;
    const controlNumber = `00-${order.id.replace('ORD-', '')}-2026`;
    const formattedDate = new Date(order.date).toLocaleString('es-VE', { 
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    const subtotalVal = order.subtotal || order.totalUsd;
    const deliveryVal = order.deliveryFee || 0;
    const bcvRate = order.bcvRate || 45.50;
    const totalUsdVal = order.totalUsd;
    const totalBsVal = order.totalBs || (totalUsdVal * bcvRate);
    const paymentLabel = formatPaymentMethodName(order.paymentMethod);
    const paymentRef = order.paymentDetails?.reference || 'CONCILIADO EN CAJA';
    const accountInfo = getPaymentChannelAccount(order.paymentMethod);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} - ${order.id} - Nexus Hardware Caracas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { background: #f1f5f9; color: #0f172a; padding: 24px; display: flex; justify-content: center; }
    .invoice-card { background: #ffffff; max-width: 800px; width: 100%; border: 1px solid #cbd5e1; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #06b6d4; padding-bottom: 20px; margin-bottom: 20px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }
    .company-sub { font-size: 11px; color: #64748b; line-height: 1.5; margin-top: 4px; }
    .doc-badge-col { text-align: right; }
    .doc-type-badge { display: inline-block; background: #ecfeff; color: #0891b2; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a5f3fc; text-transform: uppercase; margin-bottom: 6px; }
    .doc-num { font-size: 18px; font-weight: 800; color: #0891b2; font-family: monospace; }
    .doc-date { font-size: 11px; color: #64748b; margin-top: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 12px; }
    .info-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
    .info-val { font-weight: 600; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; }
    th.text-right, td.text-right { text-align: right; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
    tr:nth-child(even) td { background: #f8fafc; }
    .totals-area { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    .totals-box { width: 340px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 12px; }
    .tot-row { display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b; }
    .tot-row.grand-total { border-top: 2px solid #06b6d4; padding-top: 8px; margin-top: 8px; font-weight: 800; font-size: 16px; color: #0891b2; }
    .tot-row.grand-total-bs { font-size: 13px; font-weight: 700; color: #334155; }
    .payment-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; margin-bottom: 24px; font-size: 11px; color: #166534; display: flex; justify-content: space-between; align-items: center; }
    .pay-stamp { display: inline-block; border: 2px solid #16a34a; color: #16a34a; font-weight: 900; font-size: 12px; padding: 4px 10px; border-radius: 8px; text-transform: uppercase; transform: rotate(-3deg); }
    .footer-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 10px; color: #64748b; }
    .print-bar { margin-bottom: 16px; text-align: right; }
    .btn-print { background: #0891b2; color: #ffffff; border: none; padding: 8px 16px; font-size: 12px; font-weight: 700; border-radius: 8px; cursor: pointer; }
    .btn-print:hover { background: #0e7490; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-card { border: none; box-shadow: none; max-width: 100%; padding: 0; }
      .print-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="print-bar">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
    </div>

    <div class="header-row">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${getNexusStoreLogoSvg(48, false)}
        <div>
          <div class="company-title">NEXUS HARDWARE CARACAS, C.A.</div>
          <div class="company-sub">
            <b>RIF:</b> J-50129482-1 &bull; <b>NIT:</b> 0491823011<br>
            Av. Francisco de Miranda, Centro Plaza, Nivel 3, Ofic. 22, Chacao, Caracas, Venezuela.<br>
            Teléfono: +58 212-993-4411 &bull; Correo: facturacion@nexushardware.com
          </div>
        </div>
      </div>
      <div class="doc-badge-col">
        <span class="doc-type-badge">${isFactura ? 'Factura Comercial Digital' : 'Comprobante de Pago'}</span>
        <div class="doc-num">${docNumber}</div>
        <div class="doc-date">N° Control: ${controlNumber}</div>
        <div class="doc-date">${formattedDate}</div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="info-label">Datos del Cliente</div>
        <div class="info-val">${order.customer?.name || 'Cliente'}</div>
        <div class="company-sub">
          <b>Cédula / RIF:</b> ${order.customer?.ci || 'V-No especificado'}<br>
          <b>Teléfono:</b> ${order.customer?.phone || 'No registrado'}<br>
          <b>Correo:</b> ${order.customer?.email || 'No registrado'}
        </div>
      </div>
      <div>
        <div class="info-label">Modalidad y Despacho</div>
        <div class="info-val">${order.deliveryType === 'pickup' ? `Retiro en Tienda: ${order.branchName}` : `Delivery a Domicilio (${order.municipality})`}</div>
        <div class="company-sub">
          ${order.deliveryType === 'pickup' 
            ? `Fecha programada: <b>${order.pickupDate || 'Inmediato'}</b> (${order.pickupTime || 'Horario comercial'})`
            : `Dirección: <b>${order.deliveryAddress || 'Caracas'}</b>`
          }<br>
          <b>N° de Orden del Sistema:</b> ${order.id}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50px;">Cant.</th>
          <th>Descripción del Componente</th>
          <th>SKU / Ref</th>
          <th class="text-right">Precio Unit. ($)</th>
          <th class="text-right">Total ($)</th>
          <th class="text-right">Total Bs.</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map(item => `
          <tr>
            <td style="font-weight: 700;">${item.qty}x</td>
            <td><b>${item.name}</b></td>
            <td style="font-family: monospace; font-size: 10px; color: #64748b;">${item.productId || '-'}</td>
            <td class="text-right">$${parseFloat(item.price).toFixed(2)}</td>
            <td class="text-right" style="font-weight: 700;">$${(item.price * item.qty).toFixed(2)}</td>
            <td class="text-right">${((item.price * item.qty) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="totals-box">
        <div class="tot-row">
          <span>Subtotal Productos:</span>
          <span>$${subtotalVal.toFixed(2)}</span>
        </div>
        <div class="tot-row">
          <span>Servicio de Entrega / Despacho:</span>
          <span>$${deliveryVal.toFixed(2)}</span>
        </div>
        <div class="tot-row">
          <span>Tasa Oficial BCV del Día:</span>
          <span style="font-weight: 700;">${bcvRate.toFixed(2)} Bs/$</span>
        </div>
        <div class="tot-row grand-total">
          <span>TOTAL FACTURA ($):</span>
          <span>$${totalUsdVal.toFixed(2)} USD</span>
        </div>
        <div class="tot-row grand-total-bs">
          <span>TOTAL EN BOLÍVARES (Bs.):</span>
          <span>${totalBsVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.</span>
        </div>
      </div>
    </div>

    <div class="payment-box">
      <div>
        <div style="font-weight: 800; font-size: 12px; margin-bottom: 2px;">DETALLES DE LIQUIDACIÓN Y PAGO:</div>
        <div><b>Método:</b> ${paymentLabel} &bull; <b>Referencia:</b> <span style="font-family: monospace;">${paymentRef}</span></div>
        <div style="font-size: 10px; color: #15803d; margin-top: 2px;"><b>Canal Oficial:</b> ${accountInfo}</div>
      </div>
      <div class="pay-stamp">✓ PAGADO & CONCILIADO</div>
    </div>

    <div class="footer-row">
      <div style="max-width: 540px;">
        <b>Garantía Oficial Nexus Hardware:</b> 12 meses de garantía directa de reemplazo por serial ante fallas de fábrica.<br>
        Documento mercantil emitido electrónicamente de conformidad con la normativa legal vigente de comercio y facturación en la República Bolivariana de Venezuela.
      </div>
      <div>
        ${getQrSvg()}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Renderizar la vista del documento en el contenedor del Modal
  function renderInvoiceContent(order, docType = 'factura') {
    if (!invoicePreviewContainer) return;
    const isFactura = docType === 'factura';
    const docTitle = isFactura ? 'FACTURA DIGITAL COMERCIAL' : 'COMPROBANTE DE TRANSACCIÓN Y PAGO';
    const docNumber = isFactura ? `FACT-${order.id.replace('ORD-', '')}` : `COMP-${order.id.replace('ORD-', '')}`;
    const controlNumber = `00-${order.id.replace('ORD-', '')}-2026`;
    const formattedDate = new Date(order.date).toLocaleString('es-VE', { 
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    const subtotalVal = order.subtotal || order.totalUsd;
    const deliveryVal = order.deliveryFee || 0;
    const bcvRate = order.bcvRate || 45.50;
    const totalUsdVal = order.totalUsd;
    const totalBsVal = order.totalBs || (totalUsdVal * bcvRate);
    const paymentLabel = formatPaymentMethodName(order.paymentMethod);
    const paymentRef = order.paymentDetails?.reference || 'CONCILIADO EN CAJA';
    const accountInfo = getPaymentChannelAccount(order.paymentMethod);

    invoicePreviewContainer.innerHTML = `
      <div class="invoice-paper-view bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
        
        <!-- Encabezado de la Factura -->
        <div class="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-cyan-500/30 pb-3.5">
          <div class="space-y-1">
            <div class="flex items-center gap-2.5">
              ${getNexusStoreLogoSvg(36, false)}
              <h2 class="text-sm font-extrabold font-orbitron text-white">NEXUS HARDWARE CARACAS, C.A.</h2>
            </div>
            <p class="text-[10px] text-slate-400 leading-relaxed">
              <b>RIF:</b> J-50129482-1 &bull; <b>NIT:</b> 0491823011<br>
              Av. Francisco de Miranda, Centro Plaza, Nivel 3, Ofic. 22, Chacao, Caracas.<br>
              Teléfono: +58 212-993-4411 &bull; facturacion@nexushardware.com
            </p>
          </div>

          <div class="text-left sm:text-right shrink-0">
            <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider ${isFactura ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}">
              ${isFactura ? 'Factura Comercial' : 'Comprobante de Pago'}
            </span>
            <div class="font-mono font-extrabold text-sm text-cyan-400 mt-1">${docNumber}</div>
            <div class="text-[10px] text-slate-400">Control: <span class="font-mono">${controlNumber}</span></div>
            <div class="text-[10px] text-slate-400">${formattedDate}</div>
          </div>
        </div>

        <!-- Datos del Cliente y Despacho -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
          <div class="space-y-1">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente / Receptor:</div>
            <div class="font-bold text-white">${order.customer?.name || 'Cliente'}</div>
            <div class="text-[11px] text-slate-300"><b>C.I. / RIF:</b> ${order.customer?.ci || 'V-No especificado'}</div>
            <div class="text-[11px] text-slate-300"><b>Tel:</b> ${order.customer?.phone || 'No registrado'}</div>
            <div class="text-[11px] text-slate-400 truncate"><b>Email:</b> ${order.customer?.email || 'No registrado'}</div>
          </div>

          <div class="space-y-1">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Despacho & Modalidad:</div>
            <div class="font-bold text-emerald-400">
              <i class="fa-solid ${order.deliveryType === 'pickup' ? 'fa-store' : 'fa-motorcycle'} mr-1"></i>
              ${order.deliveryType === 'pickup' ? `Retiro: ${order.branchName}` : `Delivery en ${order.municipality}`}
            </div>
            <div class="text-[11px] text-slate-300">
              ${order.deliveryType === 'pickup'
                ? `Fecha: <b>${order.pickupDate || 'Inmediato'}</b> (${order.pickupTime || 'Horario comercial'})`
                : `Dirección: <b>${order.deliveryAddress || 'Caracas'}</b>`
              }
            </div>
            <div class="text-[11px] text-slate-400"><b>Orden del Sistema:</b> <span class="font-mono text-cyan-400">${order.id}</span></div>
          </div>
        </div>

        <!-- Tabla de Productos -->
        <div class="overflow-x-auto rounded-xl border border-slate-800">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-800">
              <tr>
                <th class="p-2 text-center w-10">Cant.</th>
                <th class="p-2">Descripción del Componente</th>
                <th class="p-2 text-right">P. Unit ($)</th>
                <th class="p-2 text-right">Total ($)</th>
                <th class="p-2 text-right">Total Bs.</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 bg-slate-950/40">
              ${order.items.map(item => `
                <tr class="hover:bg-slate-900/40">
                  <td class="p-2 text-center font-bold text-cyan-400">${item.qty}x</td>
                  <td class="p-2">
                    <div class="font-bold text-white">${item.name}</div>
                    <div class="text-[10px] text-slate-500 font-mono">${item.productId || '-'}</div>
                  </td>
                  <td class="p-2 text-right text-slate-300 font-mono">$${parseFloat(item.price).toFixed(2)}</td>
                  <td class="p-2 text-right font-bold text-white font-mono">$${(item.price * item.qty).toFixed(2)}</td>
                  <td class="p-2 text-right text-slate-400 text-[11px] font-mono">${((item.price * item.qty) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Cuadro de Totales Dual -->
        <div class="flex justify-end">
          <div class="w-full sm:w-72 p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1.5 text-xs">
            <div class="flex justify-between text-slate-400">
              <span>Subtotal Productos:</span>
              <span class="font-mono font-semibold text-white">$${subtotalVal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-slate-400">
              <span>Delivery / Despacho:</span>
              <span class="font-mono font-semibold text-white">$${deliveryVal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
              <span>Tasa Oficial BCV:</span>
              <span class="font-bold text-emerald-400 font-mono">${bcvRate.toFixed(2)} Bs/$</span>
            </div>
            <div class="flex justify-between items-baseline pt-1">
              <span class="font-extrabold text-white text-xs">TOTAL FACTURA ($):</span>
              <span class="font-orbitron font-extrabold text-cyan-400 text-sm">$${totalUsdVal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-baseline text-[11px]">
              <span class="text-slate-400 font-medium">TOTAL EN BOLÍVARES:</span>
              <span class="font-bold text-slate-200 font-mono">${totalBsVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.</span>
            </div>
          </div>
        </div>

        <!-- Cuadro de Conciliación y Pago -->
        <div class="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
          <div class="space-y-0.5">
            <div class="text-[10px] uppercase font-bold text-emerald-400">Liquidación y Conciliación:</div>
            <div class="text-white font-semibold"><b>Método:</b> ${paymentLabel}</div>
            <div class="text-slate-300 text-[11px]"><b>Referencia Bancaria:</b> <span class="font-mono text-cyan-300">${paymentRef}</span></div>
            <div class="text-[10px] text-slate-400"><b>Receptor:</b> ${accountInfo}</div>
          </div>
          <div class="px-2.5 py-1 rounded-lg border-2 border-emerald-500 text-emerald-400 font-extrabold text-xs uppercase tracking-wider bg-emerald-500/10 shrink-0">
            ✓ PAGADO & CONCILIADO
          </div>
        </div>

        <!-- Pie de Garantía y QR de Validación -->
        <div class="pt-2 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] text-slate-400">
          <div class="space-y-0.5 max-w-sm">
            <p><b>Garantía Oficial:</b> 12 meses de garantía directa de reemplazo por serial ante defectos técnicos.</p>
            <p class="text-slate-500">Documento electrónico emitido conforme al régimen de facturación de Venezuela.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-right text-[9px] text-slate-500 hidden sm:block">Validación<br>Electrónica</span>
            ${getQrSvg()}
          </div>
        </div>

      </div>
    `;
  }

  function openInvoiceModal(order, defaultDocType = 'factura', openEmailDrawer = false) {
    if (!order) return;
    activeInvoiceOrder = order;
    activeInvoiceDocType = defaultDocType;

    // Actualizar selector visual de documento
    if (activeInvoiceDocType === 'factura') {
      btnDocTypeInvoice?.classList.add('bg-cyan-600', 'text-white', 'shadow');
      btnDocTypeInvoice?.classList.remove('text-slate-400');
      btnDocTypeReceipt?.classList.remove('bg-cyan-600', 'text-white', 'shadow');
      btnDocTypeReceipt?.classList.add('text-slate-400');
    } else {
      btnDocTypeReceipt?.classList.add('bg-cyan-600', 'text-white', 'shadow');
      btnDocTypeReceipt?.classList.remove('text-slate-400');
      btnDocTypeInvoice?.classList.remove('bg-cyan-600', 'text-white', 'shadow');
      btnDocTypeInvoice?.classList.add('text-slate-400');
    }

    // Configurar correo destinatario
    const defaultEmail = order.customer?.email && order.customer.email.includes('@')
      ? order.customer.email
      : (state.currentUser && state.currentUser.id !== 'guest' && state.currentUser.email ? state.currentUser.email : '');
    
    if (invoiceTargetEmail) {
      invoiceTargetEmail.value = defaultEmail;
    }

    if (btnMailtoFallback) {
      btnMailtoFallback.href = generateMailtoLink(order, activeInvoiceDocType);
    }

    if (invoiceEmailStatus) {
      if (order.invoiceSent) {
        invoiceEmailStatus.classList.remove('hidden');
        if (invoiceEmailStatusText) {
          invoiceEmailStatusText.innerHTML = `Factura enviada anteriormente a <b>${order.invoiceSentTo}</b> (${order.invoiceSentAt ? new Date(order.invoiceSentAt).toLocaleTimeString('es-VE') : ''}).`;
        }
      } else {
        invoiceEmailStatus.classList.add('hidden');
      }
    }

    if (openEmailDrawer && invoiceEmailDrawer) {
      invoiceEmailDrawer.classList.remove('hidden');
      setTimeout(() => invoiceTargetEmail?.focus(), 100);
    } else if (invoiceEmailDrawer) {
      invoiceEmailDrawer.classList.add('hidden');
    }

    renderInvoiceContent(order, activeInvoiceDocType);

    if (modalInvoice) {
      modalInvoice.classList.remove('hidden');
    }
  }

  function closeInvoiceModal() {
    if (modalInvoice) {
      modalInvoice.classList.add('hidden');
    }
  }

  function downloadInvoiceHTML(order, docType = 'factura') {
    const html = generateStandaloneInvoiceHTML(order, docType);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docType === 'factura' ? 'Factura' : 'Comprobante'}_Nexus_${order.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Descarga de ${docType === 'factura' ? 'Factura' : 'Comprobante'} iniciada exitosamente.`, 'success');
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Permitir al usuario (cliente o administrador) descargar en PDF o imprimir
   * la factura fiscal oficial o comprobante con formato limpio y optimizado.
   *
   * CÓMO SE HIZO:
   * Asegura que el modal de factura esté renderizado con el documento comercial
   * activo, prepara el contenedor de impresión e invoca 'window.print()'.
   * =========================================================================
   */
  function printInvoice(order, docType = 'factura') {
    openInvoiceModal(order, docType);
    if (invoicePrintContainer) {
      invoicePrintContainer.innerHTML = generateStandaloneInvoiceHTML(order, docType);
    }
    showToast('Abriendo asistente de impresión / Guardar como PDF...', 'info');
    setTimeout(() => {
      window.print();
    }, 350);
  }

  async function sendInvoiceByEmail(order, docType, targetEmail) {
    if (!targetEmail || !targetEmail.trim() || !targetEmail.includes('@')) {
      showToast('Por favor ingresa una dirección de correo válida.', 'warning');
      return;
    }

    if (btnSendEmailAction) {
      btnSendEmailAction.disabled = true;
      btnSendEmailAction.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    }

    // Simulación de pasarela SMTP de Nexus Hardware Caracas
    await new Promise(r => setTimeout(r, 750));

    order.invoiceSent = true;
    order.invoiceSentTo = targetEmail.trim();
    order.invoiceSentAt = new Date().toISOString();
    order.invoiceDocType = docType;

    await window.dbManager.put('orders', order);

    if (btnSendEmailAction) {
      btnSendEmailAction.disabled = false;
      btnSendEmailAction.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Ahora';
    }

    if (invoiceEmailStatus) {
      invoiceEmailStatus.classList.remove('hidden');
      if (invoiceEmailStatusText) {
        invoiceEmailStatusText.innerHTML = `<b>Documento enviado con éxito</b> a <u>${targetEmail}</u> el ${new Date().toLocaleTimeString('es-VE')}.`;
      }
    }

    showToast(`¡Factura y comprobante enviados exitosamente a ${targetEmail}!`, 'success');

    // Si estamos en la pestaña de pedidos o admin, refrescar reactivamente
    if (state.currentTab === 'orders') {
      renderOrdersView();
    } else if (state.currentTab === 'admin') {
      renderAdminView();
    }
  }

  // Listeners del Modal de Facturas
  btnCloseInvoice?.addEventListener('click', closeInvoiceModal);
  if (modalInvoice) {
    modalInvoice.addEventListener('click', (e) => {
      if (e.target === modalInvoice) closeInvoiceModal();
    });
  }

  btnDocTypeInvoice?.addEventListener('click', () => {
    if (activeInvoiceOrder) {
      activeInvoiceDocType = 'factura';
      openInvoiceModal(activeInvoiceOrder, 'factura', !invoiceEmailDrawer?.classList.contains('hidden'));
    }
  });

  btnDocTypeReceipt?.addEventListener('click', () => {
    if (activeInvoiceOrder) {
      activeInvoiceDocType = 'receipt';
      openInvoiceModal(activeInvoiceOrder, 'receipt', !invoiceEmailDrawer?.classList.contains('hidden'));
    }
  });

  btnInvoicePrint?.addEventListener('click', () => {
    if (activeInvoiceOrder) {
      printInvoice(activeInvoiceOrder, activeInvoiceDocType);
    }
  });

  btnInvoiceDownloadHtml?.addEventListener('click', () => {
    if (activeInvoiceOrder) {
      downloadInvoiceHTML(activeInvoiceOrder, activeInvoiceDocType);
    }
  });

  btnToggleEmailPanel?.addEventListener('click', () => {
    if (invoiceEmailDrawer) {
      invoiceEmailDrawer.classList.toggle('hidden');
      if (!invoiceEmailDrawer.classList.contains('hidden')) {
        setTimeout(() => invoiceTargetEmail?.focus(), 100);
      }
    }
  });

  btnCloseEmailDrawer?.addEventListener('click', () => {
    if (invoiceEmailDrawer) invoiceEmailDrawer.classList.add('hidden');
  });

  btnSendEmailAction?.addEventListener('click', () => {
    if (activeInvoiceOrder) {
      const emailVal = invoiceTargetEmail?.value.trim() || '';
      sendInvoiceByEmail(activeInvoiceOrder, activeInvoiceDocType, emailVal);
    }
  });

  // MODAL DE CONFIRMACIÓN DE PEDIDO Y FACTURA DIGITAL
  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Permitir al cliente descargar de inmediato su factura comercial al momento
   * exacto de confirmar su compra, ya sea en formato HTML autónomo o imprimiendo /
   * guardando como PDF, así como verla en pantalla o enviarla a su correo.
   *
   * CÓMO SE HIZO:
   * Genera una ventana modal interactiva con los datos de la orden recién procesada,
   * asignando botones de acción directa vinculados a 'downloadInvoiceHTML' y
   * 'printInvoice' sin obligar al usuario a navegar a otra pantalla.
   * =========================================================================
   */
  function showOrderConfirmationModal(order) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn';

    const factNum = order.invoiceNumber || `FACT-${order.id.replace('ORD-', '')}`;
    const ctrlNum = order.controlNumber || `00-${order.id.replace('ORD-', '')}-2026`;

    modal.innerHTML = `
      <div class="bg-slate-900 border border-emerald-500/50 rounded-3xl w-full max-w-sm max-h-[92vh] overflow-y-auto p-5 shadow-2xl relative animate-scaleUp text-center scrollbar-thin scrollbar-thumb-slate-700">
        
        <!-- Logotipo Oficial y Badge de Éxito -->
        <div class="flex items-center justify-center gap-2 mb-2">
          ${getNexusStoreLogoSvg(38, true)}
        </div>

        <div class="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl mb-2 shadow-lg shadow-emerald-500/30">
          <i class="fa-solid fa-circle-check"></i>
        </div>

        <h3 class="text-base font-extrabold font-orbitron text-white">¡COMPRA EXITOSA!</h3>
        <p class="text-xs text-slate-400 mt-0.5">Tu orden y factura fiscal han sido emitidas exitosamente.</p>

        <!-- Ficha de Datos Fiscales y Despacho -->
        <div class="mt-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-1.5">
          <div class="flex justify-between items-center pb-1 border-b border-slate-800/80">
            <span class="text-slate-400 text-[11px]">N° Factura Fiscal:</span>
            <span class="font-mono font-extrabold text-cyan-400 text-xs">${factNum}</span>
          </div>
          <div class="flex justify-between text-[11px]">
            <span class="text-slate-400">N° de Control:</span>
            <span class="font-mono text-slate-300">${ctrlNum}</span>
          </div>
          <div class="flex justify-between text-[11px]">
            <span class="text-slate-400">N° de Orden:</span>
            <span class="font-mono text-slate-200">${order.id}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Cliente:</span>
            <span class="font-bold text-white">${order.customer.name}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Modalidad:</span>
            <span class="font-semibold text-emerald-400 capitalize">
              ${order.deliveryType === 'pickup' ? `Retiro en ${order.branchName}` : `Delivery (${order.municipality})`}
            </span>
          </div>
          ${order.deliveryType === 'pickup' ? `
            <div class="flex justify-between text-[10px] text-cyan-300">
              <span>Programado:</span>
              <span class="font-bold">${order.pickupDate} (${order.pickupTime})</span>
            </div>
          ` : ''}
          <div class="flex justify-between text-[11px]">
            <span class="text-slate-400">Método de Pago:</span>
            <span class="font-semibold text-white uppercase text-[10px]">${order.paymentMethod.replace('_', ' ')}</span>
          </div>
          <div class="pt-2 border-t border-slate-800 flex justify-between items-baseline font-bold">
            <span class="text-white">Monto Total:</span>
            <div class="text-right">
              <span class="font-orbitron text-cyan-400">${formatUsd(order.totalUsd)}</span>
              <div class="text-[10px] text-slate-400">${formatBs(order.totalUsd)}</div>
            </div>
          </div>
        </div>

        <!-- Botones de Emisión y Descarga Inmediata para el Cliente -->
        <div class="mt-4 space-y-2">
          <div class="text-[10px] font-bold text-cyan-300 uppercase tracking-wider text-left pl-1">
            <i class="fa-solid fa-file-arrow-down mr-1"></i> Descarga de tu Factura Comercial:
          </div>

          <!-- Botón 1: Descargar Archivo HTML de Factura -->
          <button id="btn-download-invoice-now" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 font-extrabold text-white text-xs shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 active:scale-95">
            <i class="fa-solid fa-download"></i> Descargar Factura Oficial (.HTML)
          </button>

          <!-- Botón 2: Descargar / Imprimir en PDF -->
          <button id="btn-print-invoice-now" class="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95">
            <i class="fa-solid fa-print"></i> Descargar en PDF / Imprimir
          </button>

          <!-- Botón 3: Ver Factura Digital en Pantalla -->
          <button id="btn-view-invoice-now" class="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-eye"></i> Ver Factura Digital en Pantalla
          </button>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <button id="btn-view-order-history" class="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold text-[11px] transition-colors flex items-center justify-center gap-1">
              <i class="fa-solid fa-clock-rotate-left"></i> Mis Pedidos
            </button>
            <button id="btn-close-confirm" class="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 font-semibold text-[11px] transition-colors">
              Seguir Tienda
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // Eventos de los botones de descarga y visualización
    modal.querySelector('#btn-download-invoice-now')?.addEventListener('click', () => {
      downloadInvoiceHTML(order, 'factura');
    });

    modal.querySelector('#btn-print-invoice-now')?.addEventListener('click', () => {
      printInvoice(order, 'factura');
    });

    modal.querySelector('#btn-view-invoice-now')?.addEventListener('click', () => {
      modal.remove();
      openInvoiceModal(order, 'factura');
    });

    modal.querySelector('#btn-close-confirm')?.addEventListener('click', () => {
      modal.remove();
      switchTab('catalog');
    });

    modal.querySelector('#btn-view-order-history')?.addEventListener('click', () => {
      modal.remove();
      switchTab('orders');
    });
  }

  // ------------------------------------------
  // 4. VISTA: HISTORIAL DE COMPRAS (BASE DE DATOS)
  // ------------------------------------------
  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * 1. Cumplir estrictamente con la privacidad exigida por el usuario:
   *    - Un usuario con rol Cliente NO PUEDE ver los pedidos de los demás clientes,
   *      sino ÚNICAMENTE los suyos.
   *    - El usuario Administrador SÍ PUEDE ver los pedidos de todos los clientes,
   *      pudiendo filtrarlos por cliente, período fiscal (día, semana, mes, año) y estado.
   * 2. Permitir que los clientes descarguen sus facturas comerciales de compras pasadas
   *    en formato autónomo .HTML o en PDF/Impresión con 1 solo clic.
   *
   * CÓMO SE HIZO:
   * - Consulta todas las órdenes de la tabla 'orders' en IndexedDB.
   * - Evalúa el rol del usuario conectado ('state.currentUser'):
   *   - Si es 'cliente': Filtra el array de órdenes usando 'isUserOrder(ord, currentUser)',
   *     garantizando aislamiento de datos. No renderiza selectores de otros clientes.
   *   - Si es 'admin': Renderiza la barra de herramientas de auditoría con selector
   *     de clientes, selector de período fiscal y buscador en tiempo real.
   *   - Si es 'guest': Muestra únicamente las órdenes hechas durante la sesión actual
   *     y una tarjeta informativa para registrarse o iniciar sesión.
   * =========================================================================
   */
  async function renderOrdersView() {
    const allOrders = await window.dbManager.getAll('orders');
    allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    const isAdmin = state.currentUser && state.currentUser.role === 'admin';
    const isLoggedClient = state.currentUser && state.currentUser.role === 'cliente' && state.currentUser.id !== 'guest';

    // Lista de clientes únicos para el selector del Administrador
    const uniqueClients = [];
    const clientMap = new Set();
    allOrders.forEach(o => {
      const clientName = o.customer?.name || 'Cliente';
      if (!clientMap.has(clientName)) {
        clientMap.add(clientName);
        uniqueClients.push({
          name: clientName,
          email: o.customer?.email || '',
          userId: o.userId || ''
        });
      }
    });

    // Filtrar órdenes según rol: Cliente solo ve las suyas, Admin puede ver todas
    let visibleOrders = isAdmin 
      ? allOrders 
      : allOrders.filter(ord => isUserOrder(ord, state.currentUser));

    let html = `
      <div class="p-3.5 space-y-3.5 animate-fadeIn">
        
        <!-- Cabecera de la Vista -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-extrabold font-orbitron text-white flex items-center gap-1.5">
              <i class="fa-solid fa-clock-rotate-left text-cyan-400"></i> ${isAdmin ? 'CONTROL GLOBAL DE PEDIDOS' : 'MIS PEDIDOS Y FACTURAS'}
            </h2>
            <p class="text-[11px] text-slate-400">
              ${isAdmin 
                ? 'Auditoría administrativa de todos los clientes de la tienda' 
                : isLoggedClient 
                  ? `Historial exclusivo de compras de <b>${state.currentUser.fullName || state.currentUser.username}</b>` 
                  : 'Modo Invitado: Compras de la sesión temporal activa'
              }
            </p>
          </div>
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${isAdmin ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-cyan-300 border border-slate-700'}">
            ${visibleOrders.length} ${visibleOrders.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>

        ${!isAdmin && isLoggedClient ? `
          <!-- Indicador de Privacidad y Seguridad para el Cliente -->
          <div class="p-2.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-200 flex items-center justify-between gap-2 shadow-sm">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-shield-halved text-cyan-400 text-sm shrink-0"></i>
              <span>Tus compras y facturas son privadas y exclusivas de tu cuenta <b>@${state.currentUser.username}</b>.</span>
            </div>
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
              Protegido
            </span>
          </div>
        ` : ''}

        ${!isAdmin && !isLoggedClient ? `
          <!-- Alerta para modo invitado -->
          <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
            <div class="flex items-start gap-2">
              <i class="fa-solid fa-circle-info text-amber-400 text-sm mt-0.5 shrink-0"></i>
              <div>
                <b>Estás navegando en modo Invitado.</b>
                <p class="text-[11px] text-amber-300/80 mt-0.5">Para ver tu historial de compras pasadas y resguardar tus facturas comerciales, inicia sesión con tu cuenta de cliente.</p>
              </div>
            </div>
            <button type="button" id="btn-orders-guest-login" class="w-full py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión / Registrarme
            </button>
          </div>
        ` : ''}

        ${isAdmin ? `
          <!-- BARRA DE AUDITORÍA Y FILTROS ADMINISTRATIVOS (SOLO ADMIN) -->
          <div class="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-2.5">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-white flex items-center gap-1.5">
                <i class="fa-solid fa-filter text-cyan-400"></i> Filtros de Auditoría Administrativa:
              </span>
              <span class="text-[10px] text-slate-400">Total en BD: <b>${allOrders.length}</b></span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label class="block text-[10px] text-slate-400 font-semibold mb-1">Filtrar por Cliente:</label>
                <select id="admin-orders-client-filter" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                  <option value="all">Todos los Clientes (${uniqueClients.length})</option>
                  ${uniqueClients.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                </select>
              </div>

              <div>
                <label class="block text-[10px] text-slate-400 font-semibold mb-1">Período Fiscal:</label>
                <select id="admin-orders-period-filter" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                  <option value="all">Todo el Historial</option>
                  <option value="day">Del Día (Hoy)</option>
                  <option value="week">De la Semana</option>
                  <option value="month">Del Mes</option>
                  <option value="year">Del Año (2026)</option>
                </select>
              </div>
            </div>

            <!-- Buscador administrativo en tiempo real -->
            <div class="relative">
              <span class="absolute left-3 top-2 text-slate-400 text-xs"><i class="fa-solid fa-magnifying-glass"></i></span>
              <input type="text" id="admin-orders-search" placeholder="Buscar por N° Factura, Orden, Cliente o CI..." class="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500">
            </div>
          </div>
        ` : ''}

        <!-- Contenedor dinámico de lista de órdenes -->
        <div id="orders-list-wrapper" class="space-y-3">
          ${renderOrdersListHtml(visibleOrders, isAdmin)}
        </div>

      </div>
    `;

    appContainer.innerHTML = html;

    // Conectar eventos de facturación y descarga
    attachOrderCardEvents();

    // Evento para login de invitado si aparece el botón
    document.getElementById('btn-orders-guest-login')?.addEventListener('click', () => openAuthModal('login'));

    // Eventos de filtrado para el Administrador
    if (isAdmin) {
      const clientSelect = document.getElementById('admin-orders-client-filter');
      const periodSelect = document.getElementById('admin-orders-period-filter');
      const searchInput = document.getElementById('admin-orders-search');

      function applyAdminFilters() {
        const clientVal = clientSelect?.value || 'all';
        const periodVal = periodSelect?.value || 'all';
        const searchVal = (searchInput?.value || '').trim().toLowerCase();

        let filtered = [...allOrders];

        // Filtro por cliente
        if (clientVal !== 'all') {
          filtered = filtered.filter(o => o.customer?.name === clientVal);
        }

        // Filtro por período fiscal (día, semana, mes, año)
        if (periodVal !== 'all') {
          filtered = filterOrdersByFiscalPeriod(filtered, periodVal);
        }

        // Filtro de búsqueda por texto
        if (searchVal) {
          filtered = filtered.filter(o => {
            const factId = (o.invoiceNumber || o.id || '').toLowerCase();
            const custName = (o.customer?.name || '').toLowerCase();
            const custCi = (o.customer?.ci || '').toLowerCase();
            const custPhone = (o.customer?.phone || '').toLowerCase();
            return factId.includes(searchVal) || custName.includes(searchVal) || custCi.includes(searchVal) || custPhone.includes(searchVal);
          });
        }

        const listWrapper = document.getElementById('orders-list-wrapper');
        if (listWrapper) {
          listWrapper.innerHTML = renderOrdersListHtml(filtered, true);
          attachOrderCardEvents();
        }
      }

      clientSelect?.addEventListener('change', applyAdminFilters);
      periodSelect?.addEventListener('change', applyAdminFilters);
      searchInput?.addEventListener('input', applyAdminFilters);
    }
  }

  /**
   * Helper que genera el HTML de las tarjetas de pedidos individuales
   */
  function renderOrdersListHtml(ordersList, isAdmin) {
    if (!ordersList || ordersList.length === 0) {
      return `
        <div class="py-12 text-center text-slate-400 space-y-3 bg-slate-900/50 rounded-2xl border border-slate-800/80 p-6">
          <div class="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500 text-xl">
            <i class="fa-solid fa-file-invoice"></i>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-300">No se encontraron pedidos registrados.</p>
            <p class="text-[11px] text-slate-500 mt-0.5">${isAdmin ? 'No hay órdenes que coincidan con los filtros de auditoría.' : 'Aún no tienes compras en tu cuenta.'}</p>
          </div>
          ${!isAdmin ? `
            <button onclick="document.querySelector('[data-tab=catalog]')?.click()" class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-md shadow-cyan-600/20">
              <i class="fa-solid fa-store"></i> Explorar Catálogo de Hardware
            </button>
          ` : ''}
        </div>
      `;
    }

    return ordersList.map(ord => {
      const dateStr = new Date(ord.date).toLocaleDateString('es-VE', { 
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
      });
      const factNum = ord.invoiceNumber || `FACT-${ord.id.replace('ORD-', '')}`;

      return `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-md">
          <div class="flex justify-between items-start">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold font-orbitron text-cyan-400">${ord.id}</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                  ${factNum}
                </span>
              </div>
              <div class="text-[10px] text-slate-400 mt-0.5">${dateStr}</div>
              ${isAdmin ? `
                <div class="text-[11px] text-white font-semibold flex items-center gap-1 mt-0.5">
                  <i class="fa-solid fa-user text-cyan-400 text-[10px]"></i> ${ord.customer?.name} <span class="text-slate-500 font-mono text-[10px]">(${ord.customer?.ci || 'V-No esp.'})</span>
                </div>
              ` : ''}
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              ord.status === 'Entregado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              ord.status === 'En camino' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }">
              ${ord.status}
            </span>
          </div>

          <!-- Detalle de Entrega -->
          <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-300">
            <div class="flex items-center gap-1 font-semibold text-white">
              <i class="fa-solid ${ord.deliveryType === 'pickup' ? 'fa-store text-cyan-400' : 'fa-motorcycle text-indigo-400'}"></i>
              <span>${ord.deliveryType === 'pickup' ? `Retiro: ${ord.branchName}` : `Delivery en ${ord.municipality}`}</span>
            </div>
            ${ord.deliveryType === 'pickup' ? `
              <div class="text-slate-400 text-[10px] mt-0.5">
                Fecha programada: <b class="text-slate-200">${ord.pickupDate || 'Inmediato'}</b> (${ord.pickupTime || 'Horario comercial'})
              </div>
            ` : `
              <div class="text-slate-400 text-[10px] mt-0.5 truncate">${ord.deliveryAddress || 'Dirección de envío'}</div>
            `}
          </div>

          <!-- Ítems del Pedido -->
          <div class="text-[11px] space-y-1">
            ${ord.items.map(i => `
              <div class="flex justify-between text-slate-300">
                <span class="truncate max-w-[210px]">${i.qty}x ${i.name}</span>
                <span class="font-orbitron font-semibold text-slate-400">${formatUsd(i.price * i.qty)}</span>
              </div>
            `).join('')}
          </div>

          <!-- Totales y Pago -->
          <div class="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
            <div class="text-[10px] text-slate-400">
              Pago: <b class="text-white uppercase">${ord.paymentMethod.replace('_', ' ')}</b>
              ${ord.paymentDetails?.reference ? ` | Ref: <span class="text-cyan-400 font-mono">${ord.paymentDetails.reference}</span>` : ''}
            </div>
            <div class="text-right">
              <div class="font-extrabold font-orbitron text-cyan-400">${formatUsd(ord.totalUsd)}</div>
              <div class="text-[9px] text-slate-400">${formatBs(ord.totalUsd)}</div>
            </div>
          </div>

          <!-- Barra de Facturación y Descarga para el Cliente / Administrador -->
          <div class="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <!-- Botón 1: Descarga directa HTML -->
              <button data-id="${ord.id}" class="btn-order-download-invoice px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all" title="Descargar Factura Oficial en formato HTML para archivar">
                <i class="fa-solid fa-download"></i> Descargar Factura (.HTML)
              </button>

              <!-- Botón 2: Descargar PDF / Imprimir -->
              <button data-id="${ord.id}" class="btn-order-print-invoice px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all" title="Abrir diálogo para Descargar en PDF o Imprimir">
                <i class="fa-solid fa-print"></i> PDF / Imprimir
              </button>

              <!-- Botón 3: Ver Factura en Modal -->
              <button data-id="${ord.id}" class="btn-order-view-invoice px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 transition-all" title="Ver Factura Digital en Pantalla">
                <i class="fa-solid fa-file-invoice"></i> Ver
              </button>

              <!-- Botón 4: Enviar por Correo -->
              <button data-id="${ord.id}" class="btn-order-email-invoice px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[10px] transition-all" title="Enviar por Correo Electrónico">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>

            ${ord.invoiceSent ? `
              <span class="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 font-medium" title="Enviada a ${ord.invoiceSentTo}">
                <i class="fa-solid fa-check-double"></i> Enviada por correo
              </span>
            ` : ''}
          </div>

        </div>
      `;
    }).join('');
  }

  /**
   * Conecta los event listeners a las tarjetas de órdenes renderizadas
   */
  function attachOrderCardEvents() {
    // Ver Factura en Modal
    document.querySelectorAll('.btn-order-view-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) openInvoiceModal(ord, 'factura');
      });
    });

    // Descargar Factura HTML directa
    document.querySelectorAll('.btn-order-download-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) downloadInvoiceHTML(ord, 'factura');
      });
    });

    // Imprimir / Guardar a PDF
    document.querySelectorAll('.btn-order-print-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) printInvoice(ord, 'factura');
      });
    });

    // Enviar Factura por correo
    document.querySelectorAll('.btn-order-email-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) openInvoiceModal(ord, 'factura', true);
      });
    });
  }

  // ------------------------------------------
  // 5. VISTA: RESEÑAS DE CLIENTES
  // ------------------------------------------
  async function renderReviewsView() {
    const reviews = await window.dbManager.getAll('reviews');
    const branches = await window.dbManager.getAll('branches');
    const products = await window.dbManager.getAll('products');
    reviews.sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = `
      <div class="p-3.5 space-y-4 animate-fadeIn">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-extrabold font-orbitron text-white flex items-center gap-1.5">
              <i class="fa-solid fa-star text-amber-400"></i> OPINIONES Y RESEÑAS
            </h2>
            <p class="text-[11px] text-slate-400">Calidad de hardware y atención al cliente en Caracas</p>
          </div>
          <button id="btn-toggle-review-form" class="text-xs px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white flex items-center gap-1 shadow-md shadow-cyan-600/30">
            <i class="fa-solid fa-pen-to-square"></i> Dejar Reseña
          </button>
        </div>

        <!-- FORMULARIO DESPLEGABLE PARA NUEVA RESEÑA -->
        <div id="new-review-form-box" class="hidden bg-slate-900 border border-cyan-500/40 rounded-2xl p-4 space-y-3 animate-scaleUp">
          <h3 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <i class="fa-solid fa-comment-dots text-cyan-400"></i> Escribir mi opinión:
          </h3>

          <div>
            <label class="text-[11px] font-semibold text-slate-300 block mb-1">Tu Nombre o Alias:</label>
            <input type="text" id="rev-author" value="${(state.currentUser && state.currentUser.id !== 'guest') ? (state.currentUser.fullName || state.currentUser.username) : ''}" placeholder="Ej: Daniel V." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">¿Qué deseas calificar?</label>
              <select id="rev-type" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                <option value="service">Atención al Cliente / Sucursal</option>
                <option value="product">Un Producto de Hardware</option>
              </select>
            </div>
            <div>
              <label class="text-[11px] font-semibold text-slate-300 block mb-1">Sucursal o Producto:</label>
              <select id="rev-target" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                ${branches.map(b => `<option value="${b.name}">${b.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Selector de Estrellas -->
          <div>
            <label class="text-[11px] font-semibold text-slate-300 block mb-1">Calificación:</label>
            <div id="star-rating-selector" class="flex items-center gap-2 text-xl text-amber-400 cursor-pointer">
              <i class="fa-solid fa-star star-opt" data-val="1"></i>
              <i class="fa-solid fa-star star-opt" data-val="2"></i>
              <i class="fa-solid fa-star star-opt" data-val="3"></i>
              <i class="fa-solid fa-star star-opt" data-val="4"></i>
              <i class="fa-solid fa-star star-opt" data-val="5"></i>
              <span id="star-val-text" class="text-xs text-slate-400 ml-2 font-bold">5 de 5 estrellas</span>
            </div>
          </div>

          <div>
            <label class="text-[11px] font-semibold text-slate-300 block mb-1">Comentario / Experiencia:</label>
            <textarea id="rev-comment" rows="2" placeholder="Cuéntanos cómo fue la atención, entrega o el rendimiento de tu compra..." class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"></textarea>
          </div>

          <button id="btn-save-review" class="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30">
            Publicar Reseña en Base de Datos
          </button>
        </div>

        <!-- LISTA DE RESEÑAS -->
        <div class="space-y-3">
          ${reviews.map(r => `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-bold text-xs text-white flex items-center gap-1.5">
                    <span>${r.author}</span>
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-normal">
                      <i class="fa-solid fa-circle-check text-[8px]"></i> Verificado
                    </span>
                  </div>
                  <div class="text-[10px] text-cyan-400 font-semibold mt-0.5">${r.categoryLabel || 'Opinión'}: ${r.target}</div>
                </div>
                <div class="flex text-amber-400 text-xs">
                  ${Array(5).fill(0).map((_, i) => `
                    <i class="fa-solid fa-star ${i < r.rating ? 'text-amber-400' : 'text-slate-700'}"></i>
                  `).join('')}
                </div>
              </div>

              <p class="text-xs text-slate-300 pt-1 leading-relaxed">${r.comment}</p>
              
              <div class="text-[9px] text-slate-500 text-right pt-1 border-t border-slate-800/60">
                Fecha: ${r.date}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    appContainer.innerHTML = html;

    // Control del formulario de reseñas
    const formBox = document.getElementById('new-review-form-box');
    const toggleBtn = document.getElementById('btn-toggle-review-form');
    let selectedRating = 5;

    toggleBtn.addEventListener('click', () => {
      formBox.classList.toggle('hidden');
    });

    const typeSelect = document.getElementById('rev-type');
    const targetSelect = document.getElementById('rev-target');

    typeSelect.addEventListener('change', () => {
      if (typeSelect.value === 'service') {
        targetSelect.innerHTML = branches.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
      } else {
        targetSelect.innerHTML = products.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
      }
    });

    // Control de estrellas
    const starOpts = document.querySelectorAll('.star-opt');
    const starText = document.getElementById('star-val-text');

    starOpts.forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.val);
        starText.textContent = `${selectedRating} de 5 estrellas`;
        starOpts.forEach((s, idx) => {
          if (idx < selectedRating) {
            s.classList.replace('text-slate-700', 'text-amber-400');
          } else {
            s.classList.replace('text-amber-400', 'text-slate-700');
          }
        });
      });
    });

    // Guardar Reseña
    document.getElementById('btn-save-review').addEventListener('click', async () => {
      const author = document.getElementById('rev-author').value.trim() || 'Cliente Anónimo';
      const comment = document.getElementById('rev-comment').value.trim();
      const type = typeSelect.value;
      const target = targetSelect.value;

      if (!comment) {
        showToast('Escribe tu comentario antes de enviar.', 'error');
        return;
      }

      const newReview = {
        id: `rev-${Date.now()}`,
        author,
        type,
        categoryLabel: type === 'service' ? 'Atención al Cliente' : 'Producto',
        rating: selectedRating,
        target,
        comment,
        date: new Date().toISOString().split('T')[0],
        verified: true
      };

      await window.dbManager.put('reviews', newReview);
      showToast('¡Gracias! Tu reseña ha sido guardada en la base de datos.', 'success');
      renderReviewsView();
    });
  }

  // ------------------------------------------
  // 6. VISTA: PANEL DE ADMINISTRACIÓN Y REPORTES (PROTEGIDO POR ROL)
  // ------------------------------------------
  async function renderAdminView() {
    // Verificación estricta de Rol: Solo Administradores
    if (state.currentUser.role !== 'admin') {
      renderAccessDeniedView('el Panel de Administración');
      return;
    }

    const products = await window.dbManager.getAll('products');
    const orders = await window.dbManager.getAll('orders');
    const settings = state.settings;

    // Métricas clave
    const totalSalesUsd = orders.reduce((sum, o) => sum + (o.totalUsd || 0), 0);
    const totalSalesBs = orders.reduce((sum, o) => sum + (o.totalBs || 0), 0);
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const lowStockCount = products.filter(p => p.stock <= 3).length;
    const inventoryValuation = products.reduce((sum, p) => sum + (p.price * p.stock), 0);

    let html = `
      <div class="p-3.5 space-y-4 animate-fadeIn">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-extrabold font-orbitron text-white flex items-center gap-1.5">
              <i class="fa-solid fa-chart-pie text-cyan-400"></i> PANEL DE CONTROL & REPORTES
            </h2>
            <p class="text-[11px] text-slate-400">Administración de tienda, inventario y tasa BCV</p>
          </div>
          <button id="btn-admin-add-product" class="text-xs px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white flex items-center gap-1 shadow-md shadow-cyan-600/30">
            <i class="fa-solid fa-plus"></i> Nuevo Producto
          </button>
        </div>

        <!-- KPI CARDS -->
        <div class="grid grid-cols-2 gap-2.5">
          <div class="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
            <div class="text-[10px] text-slate-400 font-semibold uppercase">Ventas Totales ($)</div>
            <div class="text-base font-extrabold font-orbitron text-emerald-400">${formatUsd(totalSalesUsd)}</div>
            <div class="text-[9px] text-slate-500">${totalSalesBs.toLocaleString('es-VE')} Bs.</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
            <div class="text-[10px] text-slate-400 font-semibold uppercase">Pedidos Registrados</div>
            <div class="text-base font-extrabold font-orbitron text-cyan-400">${orders.length}</div>
            <div class="text-[9px] text-slate-500">En base de datos local</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
            <div class="text-[10px] text-slate-400 font-semibold uppercase">Valor de Inventario</div>
            <div class="text-base font-extrabold font-orbitron text-indigo-400">${formatUsd(inventoryValuation)}</div>
            <div class="text-[9px] text-slate-500">${totalStock} unidades físicas</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
            <div class="text-[10px] text-slate-400 font-semibold uppercase">Alerta de Stock Bajo</div>
            <div class="text-base font-extrabold font-orbitron ${lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}">
              ${lowStockCount} items
            </div>
            <div class="text-[9px] text-slate-500">Stock &le; 3 unidades</div>
          </div>
        </div>

        <!-- GESTIÓN RÁPIDA DE TASA BCV -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white flex items-center gap-1.5">
              <i class="fa-solid fa-coins text-emerald-400"></i> Ajustar Tasa BCV Oficial:
            </span>
            <span class="text-xs font-bold font-orbitron text-emerald-400">${settings.bcv_rate.toFixed(2)} Bs/$</span>
          </div>
          <div class="flex gap-2">
            <input type="number" step="0.10" id="admin-bcv-input" value="${settings.bcv_rate}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-500">
            <button id="admin-btn-save-bcv" class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap">
              Actualizar
            </button>
          </div>
        </div>

        <!-- ========================================================== -->
        <!-- CENTRO DE EMISIÓN DE FACTURAS Y LIBRO FISCAL (ADMIN)       -->
        <!-- ========================================================== -->
        <!-- 
          PARA QUÉ SE HIZO:
          Permitir que la cuenta administrador pueda emitir formalmente las facturas
          comerciales y libros de ventas del día, de la semana, del mes o del año,
          generando reportes fiscales descargables e imprimibles a PDF en lote o individuales.

          CÓMO SE HIZO:
          Selector de pestañas reactivas ('day', 'week', 'month', 'year', 'all') que
          filtra en tiempo real las órdenes de IndexedDB, calculando métricas acumuladas
          y proporcionando descarga en HTML del Libro Fiscal Oficial y del lote de facturas.
        -->
        <div class="bg-slate-900 border border-cyan-500/40 rounded-2xl p-3.5 space-y-3 shadow-lg shadow-cyan-950/30">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-xs font-extrabold text-white flex items-center gap-1.5 uppercase font-orbitron">
                <i class="fa-solid fa-file-invoice-dollar text-cyan-400"></i> Emisión de Facturas & Libro Fiscal
              </h3>
              <p class="text-[10px] text-slate-400">Emisión y auditoría tributaria por períodos oficiales</p>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
              RIF J-50129482-1
            </span>
          </div>

          <!-- Selector de Período Fiscal: Del Día, De la Semana, Del Mes o Del Año -->
          <div class="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-bold">
            <button type="button" class="btn-fiscal-tab py-1.5 rounded-lg transition-all text-center ${adminFiscalPeriod === 'day' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}" data-period="day">
              ⚡ Del Día
            </button>
            <button type="button" class="btn-fiscal-tab py-1.5 rounded-lg transition-all text-center ${adminFiscalPeriod === 'week' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}" data-period="week">
              📅 Semana
            </button>
            <button type="button" class="btn-fiscal-tab py-1.5 rounded-lg transition-all text-center ${adminFiscalPeriod === 'month' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}" data-period="month">
              📆 Del Mes
            </button>
            <button type="button" class="btn-fiscal-tab py-1.5 rounded-lg transition-all text-center ${adminFiscalPeriod === 'year' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}" data-period="year">
              🗓️ Del Año
            </button>
          </div>

          <!-- Contenedor dinámico del período fiscal seleccionado -->
          <div id="admin-fiscal-container">
            ${renderAdminFiscalContent(orders, adminFiscalPeriod, settings)}
          </div>
        </div>

        <!-- CONTROL DE INVENTARIO Y STOCK -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
              <i class="fa-solid fa-boxes-stacked text-cyan-400"></i> Control de Stock (${products.length})
            </h3>
            <span class="text-[10px] text-slate-400">Actualización en BD local</span>
          </div>

          <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
            ${products.map(p => `
              <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div class="min-w-0 flex-1 pr-2">
                  <div class="font-bold text-white truncate">${p.name}</div>
                  <div class="text-[10px] text-cyan-400 font-orbitron">${formatUsd(p.price)} &bull; ${p.category}</div>
                </div>
                <!-- Edición de Stock -->
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] text-slate-400">Stock:</span>
                  <input type="number" min="0" data-id="${p.id}" value="${p.stock}" class="admin-stock-input w-14 bg-slate-800 border border-slate-700 rounded-lg text-center py-1 text-xs text-white font-bold focus:outline-none focus:border-cyan-500">
                  <button data-id="${p.id}" class="btn-admin-del-prod text-slate-500 hover:text-rose-400 text-xs p-1" title="Eliminar Producto">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- GESTIÓN DE ESTADOS DE PEDIDOS -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <h3 class="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
            <i class="fa-solid fa-list-check text-cyan-400"></i> Gestión de Pedidos (${orders.length})
          </h3>

          <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
            ${orders.map(o => `
              <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <div class="font-bold font-orbitron text-cyan-400">${o.id} - ${o.customer?.name}</div>
                  <div class="text-[10px] text-slate-400">${o.deliveryType === 'pickup' ? `Retiro: ${o.branchName}` : `Delivery: ${o.municipality}`} &bull; ${formatUsd(o.totalUsd)}</div>
                </div>
                <div class="flex items-center gap-1.5">
                  <button data-id="${o.id}" class="admin-btn-order-invoice px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1 transition-all" title="Emitir Factura y Comprobante">
                    <i class="fa-solid fa-file-invoice-dollar"></i> Factura
                  </button>
                  <select data-id="${o.id}" class="admin-order-status-select bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-[11px] font-semibold focus:outline-none focus:border-cyan-500">
                    <option value="Pendiente" ${o.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Confirmado" ${o.status === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                    <option value="Listo para retiro" ${o.status === 'Listo para retiro' ? 'selected' : ''}>Listo para retiro</option>
                    <option value="En camino" ${o.status === 'En camino' ? 'selected' : ''}>En camino</option>
                    <option value="Entregado" ${o.status === 'Entregado' ? 'selected' : ''}>Entregado</option>
                  </select>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    appContainer.innerHTML = html;

    // Actualizar Tasa BCV
    document.getElementById('admin-btn-save-bcv').addEventListener('click', async () => {
      const val = parseFloat(document.getElementById('admin-bcv-input').value);
      if (val > 0) {
        await window.dbManager.updateBcvRate(val);
        showToast(`Tasa BCV actualizada a ${val.toFixed(2)} Bs/$ en toda la tienda`, 'success');
        renderAdminView();
      }
    });

    // Actualizar Stock de productos en tiempo real
    document.querySelectorAll('.admin-stock-input').forEach(input => {
      input.addEventListener('change', async () => {
        const prodId = input.dataset.id;
        const newStock = parseInt(input.value) || 0;
        const prod = await window.dbManager.get('products', prodId);
        if (prod) {
          prod.stock = newStock;
          await window.dbManager.put('products', prod);
          showToast(`Stock de "${prod.name}" actualizado a ${newStock}`, 'success');
        }
      });
    });

    // Eliminar Producto
    document.querySelectorAll('.btn-admin-del-prod').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prodId = btn.dataset.id;
        if (confirm('¿Deseas eliminar este producto del inventario?')) {
          await window.dbManager.delete('products', prodId);
          showToast('Producto eliminado del inventario', 'warning');
          renderAdminView();
        }
      });
    });

    // Actualizar Estado de Pedido
    document.querySelectorAll('.admin-order-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const ordId = sel.dataset.id;
        const newStatus = sel.value;
        const order = await window.dbManager.get('orders', ordId);
        if (order) {
          order.status = newStatus;
          await window.dbManager.put('orders', order);
          showToast(`Estado de orden ${ordId} cambiado a "${newStatus}"`, 'info');
        }
      });
    });

    // Emitir Factura y Comprobante desde Admin
    document.querySelectorAll('.admin-btn-order-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) openInvoiceModal(ord, 'factura');
      });
    });

    // Pestañas del Centro de Emisión Fiscal del Administrador (Día, Semana, Mes, Año)
    document.querySelectorAll('.btn-fiscal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        adminFiscalPeriod = btn.dataset.period;
        document.querySelectorAll('.btn-fiscal-tab').forEach(b => {
          b.className = `btn-fiscal-tab py-1.5 rounded-lg transition-all text-center ${b.dataset.period === adminFiscalPeriod ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`;
        });
        const container = document.getElementById('admin-fiscal-container');
        if (container) {
          container.innerHTML = renderAdminFiscalContent(orders, adminFiscalPeriod, settings);
          attachAdminFiscalEvents(orders, settings);
        }
      });
    });

    // Conectar eventos del módulo fiscal inicial
    attachAdminFiscalEvents(orders, settings);

    // Modal para Nuevo Producto
    document.getElementById('btn-admin-add-product').addEventListener('click', () => {
      openNewProductModal();
    });
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Generar la interfaz dinámica del Centro de Facturación del Administrador para
   * el período seleccionado (del día, de la semana, del mes o del año).
   *
   * CÓMO SE HIZO:
   * 1. Filtra las órdenes del período con 'filterOrdersByFiscalPeriod'.
   * 2. Calcula los totales en USD y en Bolívares oficiales con la tasa BCV.
   * 3. Proporciona botones de acción en lote: Emitir Libro Fiscal, Imprimir a PDF
   *    y Descargar Lote de Facturas.
   * 4. Muestra la tabla de órdenes del período con botones individuales para cada factura.
   * =========================================================================
   */
  function renderAdminFiscalContent(orders, period, settings) {
    const periodOrders = filterOrdersByFiscalPeriod(orders, period);
    const bcvRate = settings?.bcv_rate || 889.57;

    const periodLabels = {
      day: 'Facturas Emitidas Hoy (Día)',
      week: 'Facturas de la Semana (Últimos 7 Días)',
      month: 'Facturas del Mes en Curso',
      year: 'Facturas del Año Fiscal 2026',
      all: 'Todas las Facturas Históricas'
    };

    const totalPeriodUsd = periodOrders.reduce((sum, o) => sum + (o.totalUsd || 0), 0);
    const totalPeriodBs = periodOrders.reduce((sum, o) => sum + (o.totalBs || (o.totalUsd * bcvRate) || 0), 0);
    const avgTicket = periodOrders.length > 0 ? (totalPeriodUsd / periodOrders.length) : 0;

    return `
      <div class="space-y-3 pt-1 animate-fadeIn">
        
        <!-- Tarjetas de Métricas del Período -->
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <div class="text-[9px] text-slate-400 font-bold uppercase">Facturas (${period})</div>
            <div class="text-base font-extrabold font-orbitron text-cyan-400">${periodOrders.length}</div>
            <div class="text-[9px] text-slate-500">${periodLabels[period]}</div>
          </div>
          <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <div class="text-[9px] text-slate-400 font-bold uppercase">Total Facturado ($)</div>
            <div class="text-base font-extrabold font-orbitron text-emerald-400">${formatUsd(totalPeriodUsd)}</div>
            <div class="text-[9px] text-slate-500">Promedio: ${formatUsd(avgTicket)}</div>
          </div>
          <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
            <div class="text-[9px] text-slate-400 font-bold uppercase">Total en Bolívares</div>
            <div class="text-xs font-extrabold font-orbitron text-cyan-300 mt-1">${totalPeriodBs.toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs.</div>
            <div class="text-[9px] text-emerald-400 font-semibold">${bcvRate.toFixed(2)} Bs/$</div>
          </div>
        </div>

        <!-- Acciones en Lote de Emisión Fiscal -->
        <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div class="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <i class="fa-solid fa-stamp text-cyan-400"></i> Acciones Fiscales del Administrador (${periodLabels[period]}):
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <!-- Botón 1: Emitir Libro Fiscal HTML -->
            <button type="button" id="btn-admin-emit-ledger" class="py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all active:scale-95">
              <i class="fa-solid fa-book-bookmark"></i> Emitir Libro de Ventas (.HTML)
            </button>

            <!-- Botón 2: Imprimir / Guardar PDF del Reporte -->
            <button type="button" id="btn-admin-print-ledger" class="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95">
              <i class="fa-solid fa-print"></i> Imprimir Libro / PDF
            </button>

            <!-- Botón 3: Descargar Lote de Facturas -->
            <button type="button" id="btn-admin-batch-download" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95">
              <i class="fa-solid fa-file-zipper"></i> Descargar Facturas (.HTML)
            </button>
          </div>
        </div>

        <!-- Tabla / Listado de Facturas del Período -->
        <div class="space-y-1.5">
          <div class="flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase px-1">
            <span>Listado de Facturas (${periodOrders.length})</span>
            <span>Acciones por Documento</span>
          </div>

          <div class="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            ${periodOrders.length > 0 ? periodOrders.map(ord => {
              const factNum = ord.invoiceNumber || `FACT-${ord.id.replace('ORD-', '')}`;
              const ordDate = new Date(ord.date).toLocaleDateString('es-VE', { 
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
              });
              return `
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="font-mono font-bold text-cyan-400 text-xs">${factNum}</span>
                      <span class="text-[10px] text-slate-400">${ordDate}</span>
                    </div>
                    <div class="text-[11px] text-white font-semibold truncate">
                      ${ord.customer?.name} <span class="text-slate-500 font-mono text-[10px]">(${ord.customer?.ci || 'V-No esp.'})</span>
                    </div>
                    <div class="text-[10px] text-emerald-400 font-bold">
                      ${formatUsd(ord.totalUsd)} <span class="text-slate-500 font-normal">(${formatPaymentMethodName(ord.paymentMethod)})</span>
                    </div>
                  </div>

                  <!-- Botones de Acción Individual para Admin -->
                  <div class="flex items-center gap-1 shrink-0">
                    <button data-id="${ord.id}" class="admin-period-view-invoice px-2 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 text-[10px] font-bold transition-all" title="Ver Factura Digital">
                      <i class="fa-solid fa-eye"></i> Ver
                    </button>
                    <button data-id="${ord.id}" class="admin-period-dl-invoice px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold transition-all" title="Descargar Factura (.HTML)">
                      <i class="fa-solid fa-download"></i>
                    </button>
                    <button data-id="${ord.id}" class="admin-period-print-invoice px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[10px] transition-all" title="Imprimir / Guardar como PDF">
                      <i class="fa-solid fa-print"></i>
                    </button>
                    <button data-id="${ord.id}" class="admin-period-email-invoice px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] transition-all" title="Enviar por Correo">
                      <i class="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="p-6 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800/80">
                <i class="fa-solid fa-calendar-xmark text-xl text-slate-600 mb-1"></i>
                <p class="text-xs">No hay facturas emitidas en el período "${periodLabels[period]}".</p>
              </div>
            `}
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Conecta los eventos de los botones del módulo fiscal del Administrador
   */
  function attachAdminFiscalEvents(orders, settings) {
    const periodOrders = filterOrdersByFiscalPeriod(orders, adminFiscalPeriod);

    // Botón Emitir Libro Fiscal HTML
    document.getElementById('btn-admin-emit-ledger')?.addEventListener('click', () => {
      downloadPeriodBillingReport(periodOrders, adminFiscalPeriod);
    });

    // Botón Imprimir Libro Fiscal a PDF
    document.getElementById('btn-admin-print-ledger')?.addEventListener('click', () => {
      printPeriodBillingReport(periodOrders, adminFiscalPeriod);
    });

    // Botón Descargar Lote de Facturas HTML
    document.getElementById('btn-admin-batch-download')?.addEventListener('click', () => {
      batchDownloadInvoicesHTML(periodOrders, adminFiscalPeriod);
    });

    // Botones individuales por factura dentro del período
    document.querySelectorAll('.admin-period-view-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) openInvoiceModal(ord, 'factura');
      });
    });

    document.querySelectorAll('.admin-period-dl-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) downloadInvoiceHTML(ord, 'factura');
      });
    });

    document.querySelectorAll('.admin-period-print-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) printInvoice(ord, 'factura');
      });
    });

    document.querySelectorAll('.admin-period-email-invoice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ord = await window.dbManager.get('orders', btn.dataset.id);
        if (ord) openInvoiceModal(ord, 'factura', true);
      });
    });
  }

  // MODAL CREAR NUEVO PRODUCTO
  function openNewProductModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn';

    modal.innerHTML = `
      <div class="bg-slate-900 border border-cyan-500/50 rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5 shadow-2xl relative animate-scaleUp">
        <button id="close-modal-add" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <h3 class="text-sm font-bold font-orbitron text-white mb-3">CREAR NUEVO COMPONENTE</h3>

        <div class="space-y-2.5 text-xs">
          <div>
            <label class="text-slate-300 block mb-1">Nombre del Producto:</label>
            <input type="text" id="np-name" placeholder="Ej: Memoria RAM DDR5 32GB" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-slate-300 block mb-1">Categoría:</label>
              <select id="np-category" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-white">
                <option value="Procesadores">Procesadores</option>
                <option value="Tarjetas de Video">Tarjetas de Video</option>
                <option value="Placas Madre">Placas Madre</option>
                <option value="Memorias RAM">Memorias RAM</option>
                <option value="Fuentes de Poder">Fuentes de Poder</option>
                <option value="Almacenamiento">Almacenamiento</option>
                <option value="Gabinetes">Gabinetes</option>
                <option value="Refrigeración">Refrigeración</option>
                <option value="Periféricos">Periféricos</option>
              </select>
            </div>
            <div>
              <label class="text-slate-300 block mb-1">Marca:</label>
              <input type="text" id="np-brand" placeholder="Ej: AMD, Corsair" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-slate-300 block mb-1">Precio en USD ($):</label>
              <input type="number" id="np-price" placeholder="100.00" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white">
            </div>
            <div>
              <label class="text-slate-300 block mb-1">Stock Inicial:</label>
              <input type="number" id="np-stock" value="10" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white">
            </div>
          </div>

          <div>
            <label class="text-slate-300 block mb-1">URL de Imagen:</label>
            <input type="text" id="np-image" value="https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&auto=format&fit=crop&q=60" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white">
          </div>

          <div>
            <label class="text-slate-300 block mb-1">Descripción Técnica:</label>
            <textarea id="np-desc" rows="2" placeholder="Especificaciones principales..." class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"></textarea>
          </div>

          <button id="np-btn-save" class="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white shadow-lg shadow-cyan-600/30">
            Guardar en Base de Datos
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-modal-add').addEventListener('click', () => modal.remove());
    modal.querySelector('#np-btn-save').addEventListener('click', async () => {
      const name = document.getElementById('np-name').value.trim();
      const category = document.getElementById('np-category').value;
      const brand = document.getElementById('np-brand').value.trim() || 'Nexus';
      const price = parseFloat(document.getElementById('np-price').value) || 0;
      const stock = parseInt(document.getElementById('np-stock').value) || 0;
      const image = document.getElementById('np-image').value.trim();
      const desc = document.getElementById('np-desc').value.trim();

      if (!name || price <= 0) {
        showToast('Ingresa al menos el nombre y un precio válido.', 'error');
        return;
      }

      const newProd = {
        id: `prod-${Date.now()}`,
        name,
        category,
        brand,
        price,
        stock,
        image,
        description: desc || 'Componente de hardware de alto rendimiento.',
        specs: { socket: 'Universal', ramType: 'Universal' }
      };

      await window.dbManager.put('products', newProd);
      showToast(`Producto "${name}" agregado al catálogo`, 'success');
      modal.remove();
      renderAdminView();
    });
  }

  // ------------------------------------------
  // 7. VISTA: VISOR DE BASE DE DATOS LOCAL EN FORMATO DE TABLA (PROTEGIDO POR ROL)
  // ------------------------------------------
  async function renderDatabaseViewer() {
    // Verificación estricta de Rol: Solo Administradores
    if (state.currentUser.role !== 'admin') {
      renderAccessDeniedView('la Base de Datos');
      return;
    }

    let activeTable = 'products';
    let currentViewMode = 'table'; // 'table' | 'json'
    let currentFilter = '';

    // Cargar todos los almacenes de la BD local
    const loadAllData = async () => ({
      products: await window.dbManager.getAll('products'),
      orders: await window.dbManager.getAll('orders'),
      branches: await window.dbManager.getAll('branches'),
      reviews: await window.dbManager.getAll('reviews'),
      settings: await window.dbManager.getAll('settings'),
      users: await window.dbManager.getAll('users')
    });

    let dbData = await loadAllData();

    function renderMainContainer() {
      let html = `
        <div class="p-3.5 space-y-4 animate-fadeIn">
          <!-- Cabecera de la Base de Datos -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm shadow-md shadow-emerald-500/10">
                  <i class="fa-solid fa-table-cells"></i>
                </span>
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-sm font-extrabold font-orbitron text-white">
                      BASE DE DATOS <span class="text-emerald-400">EN TABLA</span>
                    </h2>
                    <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <i class="fa-solid fa-lock text-[8px]"></i> Solo Administrador
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-400">Motor IndexedDB local estructurado en tablas relacionales</p>
                </div>
              </div>
            </div>

            <!-- Botones de Respaldo y Exportación -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <button id="btn-export-csv" class="text-xs px-2.5 py-1.5 rounded-xl bg-cyan-700/80 hover:bg-cyan-600 font-bold text-white flex items-center gap-1 shadow-sm transition-all" title="Descargar tabla activa en formato CSV para Excel">
                <i class="fa-solid fa-file-csv text-cyan-300"></i> Exportar CSV
              </button>
              <button id="btn-export-db" class="text-xs px-2.5 py-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 font-bold text-white flex items-center gap-1 shadow-sm transition-all" title="Copia de seguridad completa en JSON">
                <i class="fa-solid fa-download text-emerald-300"></i> Backup JSON
              </button>
              <label class="text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold cursor-pointer flex items-center gap-1 transition-all" title="Restaurar copia de seguridad JSON">
                <i class="fa-solid fa-upload text-indigo-400"></i> Restaurar
                <input type="file" id="db-import-file" accept=".json" class="hidden">
              </label>
              <button id="btn-reset-db" class="text-xs px-2.5 py-1.5 rounded-xl bg-rose-900/30 text-rose-300 border border-rose-700/50 hover:bg-rose-900/50 font-bold flex items-center gap-1 transition-all" title="Restaurar a valores de fábrica">
                <i class="fa-solid fa-arrow-rotate-left"></i> Reset
              </button>
            </div>
          </div>

          <!-- Selector de Tablas (Pestañas) -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button data-table="products" class="db-table-btn ${activeTable === 'products' ? 'active bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'} px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all">
              <i class="fa-solid fa-boxes-stacked text-[11px]"></i>
              <span>products</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300">${dbData.products.length}</span>
            </button>
            <button data-table="orders" class="db-table-btn ${activeTable === 'orders' ? 'active bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'} px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all">
              <i class="fa-solid fa-receipt text-[11px]"></i>
              <span>orders</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300">${dbData.orders.length}</span>
            </button>
            <button data-table="branches" class="db-table-btn ${activeTable === 'branches' ? 'active bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'} px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all">
              <i class="fa-solid fa-store text-[11px]"></i>
              <span>branches</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300">${dbData.branches.length}</span>
            </button>
            <button data-table="reviews" class="db-table-btn ${activeTable === 'reviews' ? 'active bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'} px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all">
              <i class="fa-solid fa-star text-[11px]"></i>
              <span>reviews</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300">${dbData.reviews.length}</span>
            </button>
            <button data-table="settings" class="db-table-btn ${activeTable === 'settings' ? 'active bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'} px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all">
              <i class="fa-solid fa-sliders text-[11px]"></i>
              <span>settings</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300">${dbData.settings.length}</span>
            </button>
            <button data-table="users" class="db-table-btn ${activeTable === 'users' ? 'active bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'} px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all">
              <i class="fa-solid fa-users-gear text-[11px]"></i>
              <span>users (roles)</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300">${dbData.users.length}</span>
            </button>
          </div>

          <!-- Barra de Herramientas: Búsqueda, Vista Tabla/JSON, Botón Nuevo -->
          <div class="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 p-2 rounded-2xl flex-wrap">
            <div class="relative flex-1 min-w-[160px]">
              <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-500 text-xs"></i>
              <input type="text" id="db-search-input" value="${currentFilter}" placeholder="Filtrar en tabla ${activeTable}..." class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500">
            </div>

            <div class="flex items-center gap-1.5">
              <!-- Alternar entre Vista Tabla y Vista JSON -->
              <div class="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
                <button id="btn-mode-table" class="${currentViewMode === 'table' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'} px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all" title="Vista en Tabla HTML">
                  <i class="fa-solid fa-table"></i> <span class="hidden sm:inline">Tabla</span>
                </button>
                <button id="btn-mode-json" class="${currentViewMode === 'json' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'} px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all" title="Vista JSON Inspeccionable">
                  <i class="fa-solid fa-code"></i> <span class="hidden sm:inline">JSON</span>
                </button>
              </div>

              <!-- Botón Agregar Registro -->
              <button id="btn-db-add-row" class="text-xs px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white flex items-center gap-1 shadow-sm transition-all whitespace-nowrap">
                <i class="fa-solid fa-plus"></i> <span class="hidden sm:inline">Nuevo Registro</span>
              </button>
            </div>
          </div>

          <!-- Contenedor Principal de la Tabla Renderizada -->
          <div id="db-table-output-container">
            <!-- Se inyecta aquí -->
          </div>
        </div>

        <!-- Modal flotante para Ver / Editar / Agregar Registro en la Tabla -->
        <div id="modal-db-row-edit" class="modal-backdrop hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scaleUp">
            <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/80">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">
                  <i class="fa-solid fa-pen-to-square"></i>
                </div>
                <div>
                  <h3 id="modal-db-edit-title" class="font-bold text-sm text-white font-orbitron">Editar Registro</h3>
                  <p id="modal-db-edit-subtitle" class="text-[10px] text-slate-400">Tabla: products</p>
                </div>
              </div>
              <button id="modal-db-edit-close" class="text-slate-400 hover:text-white text-lg p-1">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div id="modal-db-edit-body" class="p-4 overflow-y-auto space-y-3 text-xs flex-1 scrollbar-thin scrollbar-thumb-slate-700">
              <!-- Campos del formulario dinámico -->
            </div>

            <div class="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2">
              <button id="modal-db-edit-cancel" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors">
                Cancelar
              </button>
              <button id="modal-db-edit-save" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all">
                <i class="fa-solid fa-floppy-disk"></i> Guardar en BD
              </button>
            </div>
          </div>
        </div>
      `;

      appContainer.innerHTML = html;
      attachHeaderEvents();
      renderContent();
    }

    function attachHeaderEvents() {
      // Cambio de pestañas de tabla
      document.querySelectorAll('.db-table-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeTable = btn.dataset.table;
          currentFilter = '';
          renderMainContainer();
        });
      });

      // Switch de modo: Tabla vs JSON
      document.getElementById('btn-mode-table').addEventListener('click', () => {
        currentViewMode = 'table';
        renderMainContainer();
      });
      document.getElementById('btn-mode-json').addEventListener('click', () => {
        currentViewMode = 'json';
        renderMainContainer();
      });

      // Filtro en tiempo real
      const searchInput = document.getElementById('db-search-input');
      searchInput.addEventListener('input', (e) => {
        currentFilter = e.target.value;
        renderContent();
      });

      // Botón Exportar CSV
      document.getElementById('btn-export-csv').addEventListener('click', async () => {
        try {
          const csv = await window.dbManager.exportTableCSV(activeTable);
          if (!csv) {
            showToast('No hay datos en esta tabla para exportar.', 'warning');
            return;
          }
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `NexusHardware_${activeTable}_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          showToast(`Tabla "${activeTable}" exportada a CSV exitosamente.`, 'success');
        } catch (err) {
          showToast('Error al exportar tabla a CSV: ' + err.message, 'error');
        }
      });

      // Exportar Backup JSON completo
      document.getElementById('btn-export-db').addEventListener('click', async () => {
        const dump = await window.dbManager.exportBackupJSON();
        const blob = new Blob([dump], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NexusHardware_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Copia de seguridad JSON descargada.', 'success');
      });

      // Importar JSON
      document.getElementById('db-import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            await window.dbManager.importBackupJSON(event.target.result);
            showToast('Base de datos restaurada con éxito.', 'success');
            dbData = await loadAllData();
            renderMainContainer();
          } catch (err) {
            showToast('Error al importar archivo JSON: ' + err.message, 'error');
          }
        };
        reader.readAsText(file);
      });

      // Restaurar a valores iniciales de prueba
      document.getElementById('btn-reset-db').addEventListener('click', async () => {
        if (confirm('¿Restaurar inventario y base de datos completa a sus valores iniciales de fábrica?')) {
          await window.dbManager.resetToDefaults();
          showToast('Base de datos reseteada a los valores de prueba iniciales.', 'info');
          dbData = await loadAllData();
          renderMainContainer();
        }
      });

      // Botón Nuevo Registro
      document.getElementById('btn-db-add-row').addEventListener('click', () => {
        openRecordModal(activeTable, null);
      });

      // Cerrar modal de edición
      const modal = document.getElementById('modal-db-row-edit');
      document.getElementById('modal-db-edit-close').addEventListener('click', () => modal.classList.add('hidden'));
      document.getElementById('modal-db-edit-cancel').addEventListener('click', () => modal.classList.add('hidden'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    }

    function getFilteredData() {
      const data = dbData[activeTable] || [];
      if (!currentFilter.trim()) return data;
      const q = currentFilter.toLowerCase().trim();
      return data.filter(item => JSON.stringify(item).toLowerCase().includes(q));
    }

    function renderContent() {
      const outputContainer = document.getElementById('db-table-output-container');
      const filtered = getFilteredData();

      if (currentViewMode === 'json') {
        outputContainer.innerHTML = renderJsonView(filtered);
      } else {
        outputContainer.innerHTML = renderTableHtml(filtered);
      }

      attachTableActionEvents();
    }

    function renderJsonView(data) {
      return `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
          <div class="text-[11px] text-cyan-400 font-bold flex justify-between items-center border-b border-slate-800 pb-2">
            <span><i class="fa-solid fa-code"></i> Volcado JSON de la tabla: <code class="text-white">${activeTable}</code> (${data.length} de ${dbData[activeTable].length} registros)</span>
            <span class="text-slate-500 font-mono text-[10px]">IndexedDB ObjectStore</span>
          </div>
          <div class="max-h-[500px] overflow-y-auto space-y-2 font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate-700">
            ${data.map(item => `
              <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-slate-300 overflow-x-auto whitespace-pre-wrap select-text">
${JSON.stringify(item, null, 2)}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    function renderTableHtml(data) {
      if (data.length === 0) {
        return `
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            <i class="fa-solid fa-folder-open text-3xl mb-2 text-slate-600 block"></i>
            <p class="text-xs font-semibold">No se encontraron registros en la tabla "${activeTable}".</p>
            ${currentFilter ? `<p class="text-[11px] text-slate-500 mt-1">Prueba con otro término de búsqueda.</p>` : ''}
          </div>
        `;
      }

      if (activeTable === 'products') return renderProductsTable(data);
      if (activeTable === 'orders') return renderOrdersTable(data);
      if (activeTable === 'branches') return renderBranchesTable(data);
      if (activeTable === 'reviews') return renderReviewsTable(data);
      if (activeTable === 'settings') return renderSettingsTable(data);
      if (activeTable === 'users') return renderUsersTable(data);
      return '';
    }

    function renderProductsTable(data) {
      return `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div class="px-3 py-2 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center text-xs">
            <span class="text-cyan-400 font-bold flex items-center gap-1.5 font-orbitron">
              <i class="fa-solid fa-table"></i> TABLA: <code class="text-white font-mono">products</code>
            </span>
            <span class="text-[11px] text-slate-400">${data.length} de ${dbData.products.length} productos</span>
          </div>

          <div class="overflow-x-auto db-table-wrapper max-h-[520px]">
            <table class="db-table-custom text-left text-xs text-slate-300 w-full min-w-[760px]">
              <thead class="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th class="p-2.5">ID</th>
                  <th class="p-2.5">Foto</th>
                  <th class="p-2.5">Producto & Marca</th>
                  <th class="p-2.5">Categoría</th>
                  <th class="p-2.5 text-right">Precio USD</th>
                  <th class="p-2.5 text-right">Precio Bs.</th>
                  <th class="p-2.5 text-center">Stock</th>
                  <th class="p-2.5">Specs Clave</th>
                  <th class="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                ${data.map(p => {
                  const stockClass = p.stock > 3 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                    : (p.stock > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-rose-500/20 text-rose-400 border-rose-500/40');
                  const stockText = p.stock > 3 ? `${p.stock} unids` : (p.stock > 0 ? `⚠️ ${p.stock} unids` : '🚫 Agotado');
                  const specsBadges = p.specs 
                    ? Object.entries(p.specs).slice(0, 3).map(([k, v]) => `<span class="bg-slate-800 text-[9px] px-1.5 py-0.5 rounded text-slate-300 border border-slate-700 font-mono">${k}: ${v}</span>`).join(' ') 
                    : '-';

                  return `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="p-2.5 font-mono text-[11px] text-cyan-400 font-bold whitespace-nowrap">${p.id}</td>
                      <td class="p-2.5">
                        <img src="${p.image || 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=200'}" alt="${p.name}" class="w-9 h-9 rounded-lg object-cover border border-slate-700 bg-slate-950" onerror="this.src='https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=200'">
                      </td>
                      <td class="p-2.5">
                        <div class="font-bold text-white leading-tight">${p.name}</div>
                        <span class="text-[10px] text-indigo-400 font-semibold">${p.brand || 'Nexus'}</span>
                      </td>
                      <td class="p-2.5 whitespace-nowrap">
                        <span class="bg-slate-800 text-[10px] px-2 py-0.5 rounded-full text-slate-300 border border-slate-700 font-semibold">${p.category}</span>
                      </td>
                      <td class="p-2.5 text-right font-bold text-emerald-400 font-orbitron whitespace-nowrap">${formatUsd(p.price)}</td>
                      <td class="p-2.5 text-right font-medium text-slate-300 text-[11px] whitespace-nowrap">${formatBs(p.price)}</td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${stockClass}">${stockText}</span>
                      </td>
                      <td class="p-2.5 max-w-[200px]">
                        <div class="flex flex-wrap gap-1">${specsBadges}</div>
                      </td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                          <button data-id="${p.id}" class="btn-db-row-edit w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center justify-center transition-all" title="Ver / Editar Fila">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                          </button>
                          <button data-id="${p.id}" class="btn-db-row-del w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 flex items-center justify-center transition-all" title="Eliminar de BD">
                            <i class="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderOrdersTable(data) {
      return `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div class="px-3 py-2 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center text-xs">
            <span class="text-cyan-400 font-bold flex items-center gap-1.5 font-orbitron">
              <i class="fa-solid fa-table"></i> TABLA: <code class="text-white font-mono">orders</code>
            </span>
            <span class="text-[11px] text-slate-400">${data.length} de ${dbData.orders.length} órdenes</span>
          </div>

          <div class="overflow-x-auto db-table-wrapper max-h-[520px]">
            <table class="db-table-custom text-left text-xs text-slate-300 w-full min-w-[850px]">
              <thead class="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th class="p-2.5">ID Orden</th>
                  <th class="p-2.5">Fecha</th>
                  <th class="p-2.5">Cliente</th>
                  <th class="p-2.5">Modalidad & Entrega</th>
                  <th class="p-2.5">Items</th>
                  <th class="p-2.5 text-right">Total USD</th>
                  <th class="p-2.5 text-right">Total Bs.</th>
                  <th class="p-2.5">Método de Pago</th>
                  <th class="p-2.5 text-center">Estado (Reactivo)</th>
                  <th class="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                ${data.map(o => {
                  const dateStr = o.date ? new Date(o.date).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                  const deliveryDesc = o.deliveryType === 'pickup' 
                    ? `<span class="text-indigo-400 font-semibold flex items-center gap-1"><i class="fa-solid fa-store"></i> Retiro: ${o.branchName || o.branchId}</span>` 
                    : `<span class="text-cyan-400 font-semibold flex items-center gap-1"><i class="fa-solid fa-motorcycle"></i> Delivery: ${o.municipality || 'Caracas'}</span><div class="text-[10px] text-slate-500 truncate max-w-[150px]">${o.deliveryAddress || ''}</div>`;
                  const itemsList = o.items ? o.items.map(it => `<span class="bg-slate-800 text-[9px] px-1.5 py-0.5 rounded text-slate-300 font-mono">${it.qty}x ${it.name}</span>`).join(' ') : '-';
                  const payRef = o.paymentDetails?.reference ? `(Ref: ${o.paymentDetails.reference})` : '';

                  return `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="p-2.5 font-mono text-[11px] text-cyan-400 font-bold whitespace-nowrap">${o.id}</td>
                      <td class="p-2.5 text-[11px] text-slate-400 whitespace-nowrap">${dateStr}</td>
                      <td class="p-2.5">
                        <div class="font-bold text-white">${o.customer?.name || 'Cliente'}</div>
                        <div class="text-[10px] text-slate-400">${o.customer?.phone || ''} ${o.customer?.ci ? `&bull; ${o.customer.ci}` : ''}</div>
                      </td>
                      <td class="p-2.5 text-xs">${deliveryDesc}</td>
                      <td class="p-2.5 max-w-[180px]">
                        <div class="flex flex-wrap gap-1">${itemsList}</div>
                      </td>
                      <td class="p-2.5 text-right font-bold text-emerald-400 font-orbitron whitespace-nowrap">${formatUsd(o.totalUsd || 0)}</td>
                      <td class="p-2.5 text-right font-medium text-slate-300 text-[11px] whitespace-nowrap">${o.totalBs ? o.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs.' : '-'}</td>
                      <td class="p-2.5 text-xs whitespace-nowrap">
                        <div class="font-bold text-white capitalize">${o.paymentMethod || 'Efectivo'}</div>
                        <div class="text-[10px] text-slate-400">${payRef}</div>
                      </td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <select data-id="${o.id}" class="db-order-status-select bg-slate-950 border border-slate-700 text-cyan-300 text-[11px] font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500">
                          <option value="Pendiente" ${o.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                          <option value="Confirmado" ${o.status === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                          <option value="Listo para retiro" ${o.status === 'Listo para retiro' ? 'selected' : ''}>Listo para retiro</option>
                          <option value="En camino" ${o.status === 'En camino' ? 'selected' : ''}>En camino</option>
                          <option value="Entregado" ${o.status === 'Entregado' ? 'selected' : ''}>Entregado</option>
                          <option value="Cancelado" ${o.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                      </td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                          <button data-id="${o.id}" class="btn-db-order-invoice w-7 h-7 rounded-lg bg-slate-800 hover:bg-cyan-600 text-cyan-300 hover:text-white flex items-center justify-center transition-all" title="Emitir Factura y Comprobante">
                            <i class="fa-solid fa-file-invoice-dollar text-xs"></i>
                          </button>
                          <button data-id="${o.id}" class="btn-db-row-edit w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center justify-center transition-all" title="Ver Comprobante / Editar">
                            <i class="fa-solid fa-eye text-xs"></i>
                          </button>
                          <button data-id="${o.id}" class="btn-db-row-del w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 flex items-center justify-center transition-all" title="Eliminar Orden">
                            <i class="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderBranchesTable(data) {
      return `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div class="px-3 py-2 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center text-xs">
            <span class="text-cyan-400 font-bold flex items-center gap-1.5 font-orbitron">
              <i class="fa-solid fa-table"></i> TABLA: <code class="text-white font-mono">branches</code>
            </span>
            <span class="text-[11px] text-slate-400">${data.length} de ${dbData.branches.length} sucursales</span>
          </div>

          <div class="overflow-x-auto db-table-wrapper max-h-[520px]">
            <table class="db-table-custom text-left text-xs text-slate-300 w-full min-w-[750px]">
              <thead class="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th class="p-2.5">ID</th>
                  <th class="p-2.5">Sucursal</th>
                  <th class="p-2.5">Municipio</th>
                  <th class="p-2.5">Dirección</th>
                  <th class="p-2.5">Horario</th>
                  <th class="p-2.5">Teléfono</th>
                  <th class="p-2.5 text-center">Estado</th>
                  <th class="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                ${data.map(b => `
                  <tr class="hover:bg-slate-800/40 transition-colors">
                    <td class="p-2.5 font-mono text-[11px] text-cyan-400 font-bold whitespace-nowrap">${b.id}</td>
                    <td class="p-2.5 font-bold text-white whitespace-nowrap">${b.name}</td>
                    <td class="p-2.5 whitespace-nowrap">
                      <span class="bg-slate-800 text-indigo-300 border border-indigo-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">${b.municipality}</span>
                    </td>
                    <td class="p-2.5 text-slate-300 text-xs min-w-[180px]">${b.address}</td>
                    <td class="p-2.5 text-[11px] text-slate-400 whitespace-nowrap">${b.schedule}</td>
                    <td class="p-2.5 text-[11px] font-mono text-cyan-400 whitespace-nowrap">${b.phone}</td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                      <span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">${b.status || 'Abierto'}</span>
                    </td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                      <div class="flex items-center justify-center gap-1">
                        <button data-id="${b.id}" class="btn-db-row-edit w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center justify-center transition-all" title="Ver / Editar Sucursal">
                          <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button data-id="${b.id}" class="btn-db-row-del w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 flex items-center justify-center transition-all" title="Eliminar Sucursal">
                          <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderReviewsTable(data) {
      return `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div class="px-3 py-2 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center text-xs">
            <span class="text-cyan-400 font-bold flex items-center gap-1.5 font-orbitron">
              <i class="fa-solid fa-table"></i> TABLA: <code class="text-white font-mono">reviews</code>
            </span>
            <span class="text-[11px] text-slate-400">${data.length} de ${dbData.reviews.length} reseñas</span>
          </div>

          <div class="overflow-x-auto db-table-wrapper max-h-[520px]">
            <table class="db-table-custom text-left text-xs text-slate-300 w-full min-w-[750px]">
              <thead class="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th class="p-2.5">ID</th>
                  <th class="p-2.5">Cliente</th>
                  <th class="p-2.5">Tipo</th>
                  <th class="p-2.5">Calificación</th>
                  <th class="p-2.5">Objetivo</th>
                  <th class="p-2.5">Comentario</th>
                  <th class="p-2.5">Fecha</th>
                  <th class="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                ${data.map(r => {
                  const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
                  return `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="p-2.5 font-mono text-[11px] text-cyan-400 font-bold whitespace-nowrap">${r.id}</td>
                      <td class="p-2.5 whitespace-nowrap">
                        <div class="font-bold text-white flex items-center gap-1">
                          ${r.author}
                          ${r.verified ? '<i class="fa-solid fa-circle-check text-cyan-400 text-[10px]" title="Cliente Verificado"></i>' : ''}
                        </div>
                      </td>
                      <td class="p-2.5 whitespace-nowrap">
                        <span class="bg-slate-800 text-[10px] px-2 py-0.5 rounded-full text-slate-300 border border-slate-700 font-semibold">${r.type}</span>
                      </td>
                      <td class="p-2.5 text-amber-400 font-bold tracking-widest whitespace-nowrap text-xs">${stars}</td>
                      <td class="p-2.5 font-semibold text-slate-200 text-xs min-w-[130px]">${r.target}</td>
                      <td class="p-2.5 text-slate-300 text-xs italic min-w-[200px]">"${r.comment}"</td>
                      <td class="p-2.5 text-[11px] text-slate-400 whitespace-nowrap">${r.date || '-'}</td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                          <button data-id="${r.id}" class="btn-db-row-edit w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center justify-center transition-all" title="Ver / Editar">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                          </button>
                          <button data-id="${r.id}" class="btn-db-row-del w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 flex items-center justify-center transition-all" title="Eliminar Reseña">
                            <i class="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderSettingsTable(data) {
      return `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div class="px-3 py-2 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center text-xs">
            <span class="text-cyan-400 font-bold flex items-center gap-1.5 font-orbitron">
              <i class="fa-solid fa-table"></i> TABLA: <code class="text-white font-mono">settings</code>
            </span>
            <span class="text-[11px] text-slate-400">${data.length} registros</span>
          </div>

          <div class="overflow-x-auto db-table-wrapper max-h-[520px]">
            <table class="db-table-custom text-left text-xs text-slate-300 w-full min-w-[700px]">
              <thead class="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th class="p-2.5">Clave (Key)</th>
                  <th class="p-2.5">Nombre de Tienda</th>
                  <th class="p-2.5 text-right">Tasa BCV (Bs/$)</th>
                  <th class="p-2.5">WhatsApp Soporte</th>
                  <th class="p-2.5">Última Fecha Tasa</th>
                  <th class="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                ${data.map(s => `
                  <tr class="hover:bg-slate-800/40 transition-colors">
                    <td class="p-2.5 font-mono text-[11px] text-cyan-400 font-bold whitespace-nowrap">${s.key}</td>
                    <td class="p-2.5 font-bold text-white whitespace-nowrap">${s.store_name || 'Nexus Hardware Caracas'}</td>
                    <td class="p-2.5 text-right font-bold text-emerald-400 font-orbitron whitespace-nowrap">${(s.bcv_rate || 0).toFixed(2)} Bs/$</td>
                    <td class="p-2.5 text-[11px] font-mono text-cyan-300 whitespace-nowrap">${s.support_whatsapp || '-'}</td>
                    <td class="p-2.5 text-[11px] text-slate-400 whitespace-nowrap">${s.last_rate_date || '-'}</td>
                    <td class="p-2.5 text-center whitespace-nowrap">
                      <button data-id="${s.key}" class="btn-db-row-edit px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold text-xs transition-all flex items-center gap-1 mx-auto">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderUsersTable(data) {
      return `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div class="px-3 py-2 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center text-xs">
            <span class="text-cyan-400 font-bold flex items-center gap-1.5 font-orbitron">
              <i class="fa-solid fa-users-gear"></i> TABLA: <code class="text-white font-mono">users</code> (Control de Roles y Permisos)
            </span>
            <span class="text-[11px] text-slate-400">${data.length} de ${dbData.users.length} usuarios</span>
          </div>

          <div class="overflow-x-auto db-table-wrapper max-h-[520px]">
            <table class="db-table-custom text-left text-xs text-slate-300 w-full min-w-[750px]">
              <thead class="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th class="p-2.5">ID</th>
                  <th class="p-2.5">Usuario</th>
                  <th class="p-2.5">Nombre Completo</th>
                  <th class="p-2.5">Correo</th>
                  <th class="p-2.5 text-center">Rol Asignado</th>
                  <th class="p-2.5 text-center">Estado</th>
                  <th class="p-2.5">Último Acceso</th>
                  <th class="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                ${data.map(u => {
                  const dateStr = u.lastLogin ? new Date(u.lastLogin).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                  return `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                      <td class="p-2.5 font-mono text-[11px] text-cyan-400 font-bold whitespace-nowrap">${u.id}</td>
                      <td class="p-2.5 font-bold text-white whitespace-nowrap">${u.username}</td>
                      <td class="p-2.5 text-slate-200 whitespace-nowrap">${u.fullName || '-'}</td>
                      <td class="p-2.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">${u.email || '-'}</td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <select data-id="${u.id}" class="db-user-role-select bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1 font-semibold ${u.role === 'admin' ? 'text-emerald-400 border-emerald-500/40' : 'text-indigo-300 border-indigo-500/30'} focus:outline-none focus:border-cyan-500">
                          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>🛡️ Administrador</option>
                          <option value="cliente" ${u.role === 'cliente' ? 'selected' : ''}>👤 Cliente</option>
                        </select>
                      </td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">${u.status || 'Activo'}</span>
                      </td>
                      <td class="p-2.5 text-[11px] text-slate-400 whitespace-nowrap">${dateStr}</td>
                      <td class="p-2.5 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1">
                          <button data-id="${u.id}" class="btn-db-row-edit w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 flex items-center justify-center transition-all" title="Ver / Editar Usuario">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                          </button>
                          <button data-id="${u.id}" class="btn-db-row-del w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 flex items-center justify-center transition-all" title="Eliminar Usuario">
                            <i class="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function attachTableActionEvents() {
      // 1. Selector reactivo de estado de orden directamente en la tabla
      document.querySelectorAll('.db-order-status-select').forEach(sel => {
        sel.addEventListener('change', async () => {
          const ordId = sel.dataset.id;
          const order = await window.dbManager.get('orders', ordId);
          if (order) {
            order.status = sel.value;
            await window.dbManager.put('orders', order);
            showToast(`Orden ${ordId} actualizada a "${sel.value}"`, 'success');
            dbData = await loadAllData();
          }
        });
      });

      // 2. Selector reactivo de Rol de Usuario (Admin vs Cliente) directamente en la tabla
      document.querySelectorAll('.db-user-role-select').forEach(sel => {
        sel.addEventListener('change', async () => {
          const uId = sel.dataset.id;
          const user = await window.dbManager.get('users', uId);
          if (user) {
            user.role = sel.value;
            await window.dbManager.put('users', user);
            showToast(`Rol de "${user.username}" actualizado a "${sel.value}"`, 'success');
            if (state.currentUser.id === uId) {
              state.currentUser.role = sel.value;
              localStorage.setItem('nexus_auth_user', JSON.stringify(state.currentUser));
              updateRoleUI();
            }
            dbData = await loadAllData();
            renderContent();
          }
        });
      });

      // 2. Botón Emitir Factura / Comprobante desde la tabla orders
      document.querySelectorAll('.btn-db-order-invoice').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ord = await window.dbManager.get('orders', btn.dataset.id);
          if (ord) openInvoiceModal(ord, 'factura');
        });
      });

      // 3. Botón Editar / Ver fila de la tabla
      document.querySelectorAll('.btn-db-row-edit').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const item = await window.dbManager.get(activeTable, id);
          if (item) {
            openRecordModal(activeTable, item);
          } else {
            showToast('No se encontró el registro.', 'error');
          }
        });
      });

      // 3. Botón Eliminar fila de la tabla
      document.querySelectorAll('.btn-db-row-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (confirm(`¿Estás seguro de eliminar el registro "${id}" de la tabla "${activeTable}" en la Base de Datos Local?`)) {
            await window.dbManager.delete(activeTable, id);
            showToast(`Registro "${id}" eliminado exitosamente.`, 'info');
            dbData = await loadAllData();
            renderContent();
          }
        });
      });
    }

    // Modal de Creación o Edición de Registros en la Tabla
    function openRecordModal(tableName, record = null) {
      const modal = document.getElementById('modal-db-row-edit');
      const title = document.getElementById('modal-db-edit-title');
      const subtitle = document.getElementById('modal-db-edit-subtitle');
      const body = document.getElementById('modal-db-edit-body');
      const btnSave = document.getElementById('modal-db-edit-save');

      const isEdit = !!record;
      title.textContent = isEdit ? `Editar Registro: ${record.id || record.key}` : `Nuevo Registro en ${tableName}`;
      subtitle.textContent = `Tabla: ${tableName} (IndexedDB)`;

      let fieldsHtml = '';

      if (tableName === 'products') {
        const p = record || {
          id: `prod-${Math.floor(100 + Math.random() * 900)}`,
          name: '',
          brand: 'AMD',
          category: 'Procesadores',
          price: 99.99,
          stock: 10,
          image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600',
          description: '',
          specs: { socket: 'AM5', ramType: 'DDR5' }
        };

        fieldsHtml = `
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">ID (Clave Primaria):</label>
              <input type="text" id="field-id" value="${p.id}" ${isEdit ? 'readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-500 font-mono text-xs"' : 'class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500"'}>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Marca:</label>
              <input type="text" id="field-brand" value="${p.brand || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Nombre del Producto:</label>
            <input type="text" id="field-name" value="${p.name || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
          </div>
          <div class="grid grid-cols-3 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Categoría:</label>
              <select id="field-category" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
                ${['Procesadores', 'Tarjetas de Video', 'Placas Madre', 'Memorias RAM', 'Fuentes de Poder', 'Almacenamiento', 'Gabinetes', 'Refrigeración', 'Periféricos'].map(c => `
                  <option value="${c}" ${p.category === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Precio USD ($):</label>
              <input type="number" step="0.01" id="field-price" value="${p.price || 0}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold text-xs focus:border-cyan-500">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Stock Físico:</label>
              <input type="number" id="field-stock" value="${p.stock || 0}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold text-xs focus:border-cyan-500">
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">URL Imagen (Thumbnail):</label>
            <input type="text" id="field-image" value="${p.image || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Descripción:</label>
            <textarea id="field-description" rows="2" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white text-xs focus:border-cyan-500">${p.description || ''}</textarea>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Especificaciones Técnicas (JSON):</label>
            <textarea id="field-specs-json" rows="3" class="w-full bg-slate-950 font-mono text-[11px] border border-slate-800 rounded-xl p-2 text-cyan-300 focus:border-cyan-500">${JSON.stringify(p.specs || {}, null, 2)}</textarea>
          </div>
        `;
      } else if (tableName === 'branches') {
        const b = record || {
          id: `suc-${Math.floor(100 + Math.random() * 900)}`,
          name: '',
          municipality: 'Chacao',
          address: '',
          schedule: 'Lunes a Sábado: 9:00 AM - 7:00 PM',
          phone: '+58 212-000-0000',
          status: 'Abierto'
        };

        fieldsHtml = `
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">ID Sucursal:</label>
              <input type="text" id="field-id" value="${b.id}" ${isEdit ? 'readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-500 font-mono text-xs"' : 'class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500"'}>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Municipio:</label>
              <input type="text" id="field-municipality" value="${b.municipality || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Nombre de la Sucursal:</label>
            <input type="text" id="field-name" value="${b.name || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Dirección Exacta:</label>
            <textarea id="field-address" rows="2" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white text-xs focus:border-cyan-500">${b.address || ''}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Horario:</label>
              <input type="text" id="field-schedule" value="${b.schedule || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Teléfono:</label>
              <input type="text" id="field-phone" value="${b.phone || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
            </div>
          </div>
        `;
      } else if (tableName === 'reviews') {
        const r = record || {
          id: `rev-${Math.floor(100 + Math.random() * 900)}`,
          author: '',
          type: 'service',
          rating: 5,
          target: 'Sucursal Altamira',
          comment: '',
          date: new Date().toISOString().split('T')[0],
          verified: true
        };

        fieldsHtml = `
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">ID Reseña:</label>
              <input type="text" id="field-id" value="${r.id}" ${isEdit ? 'readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-500 font-mono text-xs"' : 'class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500"'}>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Calificación (1 - 5 ⭐):</label>
              <input type="number" min="1" max="5" id="field-rating" value="${r.rating || 5}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500 font-bold">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Nombre del Cliente:</label>
              <input type="text" id="field-author" value="${r.author || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Destino (Sucursal/Producto):</label>
              <input type="text" id="field-target" value="${r.target || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Comentario del Cliente:</label>
            <textarea id="field-comment" rows="3" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white text-xs focus:border-cyan-500">${r.comment || ''}</textarea>
          </div>
        `;
      } else if (tableName === 'users') {
        const u = record || {
          id: `usr-${Math.floor(100 + Math.random() * 900)}`,
          username: '',
          fullName: '',
          email: '',
          role: 'cliente',
          password: 'cliente2026',
          status: 'Activo'
        };

        fieldsHtml = `
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">ID Usuario:</label>
              <input type="text" id="field-id" value="${u.id}" ${isEdit ? 'readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-500 font-mono text-xs"' : 'class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500"'}>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Rol Asignado:</label>
              <select id="field-role" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs font-bold focus:border-cyan-500">
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>🛡️ Administrador (Acceso Total)</option>
                <option value="cliente" ${u.role === 'cliente' ? 'selected' : ''}>👤 Cliente (Solo Tienda)</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Nombre de Usuario:</label>
            <input type="text" id="field-username" value="${u.username || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500 font-semibold">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Nombre Completo:</label>
            <input type="text" id="field-fullname" value="${u.fullName || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Correo Electrónico:</label>
              <input type="email" id="field-email" value="${u.email || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-400 mb-1">Contraseña o PIN:</label>
              <input type="password" id="field-password" value="${u.password || ''}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-cyan-500">
            </div>
          </div>
        `;
      } else {
        // Formulario universal JSON para settings u órdenes
        fieldsHtml = `
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Edición directa del objeto en Base de Datos (JSON):</label>
            <textarea id="field-universal-json" rows="12" class="w-full bg-slate-950 font-mono text-[11px] border border-slate-800 rounded-xl p-3 text-cyan-300 focus:border-cyan-500">${JSON.stringify(record || { id: `item-${Date.now()}` }, null, 2)}</textarea>
          </div>
        `;
      }

      body.innerHTML = fieldsHtml;
      modal.classList.remove('hidden');

      // Asignar evento de guardado
      btnSave.onclick = async () => {
        try {
          let updatedObj = record ? { ...record } : {};

          if (tableName === 'products') {
            const idVal = document.getElementById('field-id').value.trim();
            if (!idVal) throw new Error('El ID del producto es obligatorio.');
            let specsParsed = {};
            try {
              specsParsed = JSON.parse(document.getElementById('field-specs-json').value);
            } catch (e) {
              throw new Error('El formato JSON de las especificaciones es inválido.');
            }

            updatedObj = {
              ...updatedObj,
              id: idVal,
              name: document.getElementById('field-name').value.trim() || 'Nuevo Producto',
              brand: document.getElementById('field-brand').value.trim() || 'Nexus',
              category: document.getElementById('field-category').value,
              price: parseFloat(document.getElementById('field-price').value) || 0,
              stock: parseInt(document.getElementById('field-stock').value) || 0,
              image: document.getElementById('field-image').value.trim(),
              description: document.getElementById('field-description').value.trim(),
              specs: specsParsed
            };
          } else if (tableName === 'branches') {
            const idVal = document.getElementById('field-id').value.trim();
            if (!idVal) throw new Error('El ID de la sucursal es obligatorio.');
            updatedObj = {
              ...updatedObj,
              id: idVal,
              name: document.getElementById('field-name').value.trim() || 'Nueva Sucursal',
              municipality: document.getElementById('field-municipality').value.trim() || 'Caracas',
              address: document.getElementById('field-address').value.trim(),
              schedule: document.getElementById('field-schedule').value.trim(),
              phone: document.getElementById('field-phone').value.trim(),
              status: 'Abierto'
            };
          } else if (tableName === 'reviews') {
            const idVal = document.getElementById('field-id').value.trim();
            if (!idVal) throw new Error('El ID de la reseña es obligatorio.');
            updatedObj = {
              ...updatedObj,
              id: idVal,
              author: document.getElementById('field-author').value.trim() || 'Cliente Anónimo',
              target: document.getElementById('field-target').value.trim() || 'Nexus Hardware',
              rating: parseInt(document.getElementById('field-rating').value) || 5,
              comment: document.getElementById('field-comment').value.trim(),
              date: new Date().toISOString().split('T')[0],
              verified: true,
              type: 'service'
            };
          } else if (tableName === 'users') {
            const idVal = document.getElementById('field-id').value.trim();
            if (!idVal) throw new Error('El ID de usuario es obligatorio.');
            updatedObj = {
              ...updatedObj,
              id: idVal,
              username: document.getElementById('field-username').value.trim() || 'usuario',
              fullName: document.getElementById('field-fullname').value.trim(),
              email: document.getElementById('field-email').value.trim(),
              role: document.getElementById('field-role').value,
              password: document.getElementById('field-password').value.trim() || 'nexus2026',
              status: 'Activo',
              lastLogin: updatedObj.lastLogin || new Date().toISOString()
            };
            if (state.currentUser.id === idVal) {
              state.currentUser.role = updatedObj.role;
              localStorage.setItem('nexus_auth_user', JSON.stringify(state.currentUser));
              updateRoleUI();
            }
          } else {
            const jsonText = document.getElementById('field-universal-json').value;
            updatedObj = JSON.parse(jsonText);
          }

          await window.dbManager.put(tableName, updatedObj);
          showToast(`Registro guardado exitosamente en la tabla "${tableName}".`, 'success');
          modal.classList.add('hidden');
          dbData = await loadAllData();
          renderMainContainer();
        } catch (err) {
          showToast('Error al guardar: ' + err.message, 'error');
        }
      };
    }

    renderMainContainer();
  }


  // MODAL CALCULADORA BCV
  const modalBcv = document.getElementById('modal-bcv');
  const btnOpenRate = document.getElementById('btn-open-rate-modal');
  const calcUsdInput = document.getElementById('calc-usd-input');
  const calcBsResult = document.getElementById('calc-bs-result');

  function recalcModalBs() {
    const usd = parseFloat(calcUsdInput?.value || 0);
    const rate = state.settings.bcv_rate || 45.50;
    const bs = usd * rate;
    if (calcBsResult) {
      calcBsResult.textContent = `${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
    }
  }

  btnOpenRate.addEventListener('click', () => {
    modalBcv.classList.remove('hidden');
    recalcModalBs();
  });

  calcUsdInput.addEventListener('input', recalcModalBs);

  modalBcv.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => modalBcv.classList.add('hidden'));
  });

  modalBcv.addEventListener('click', (e) => {
    if (e.target === modalBcv) modalBcv.classList.add('hidden');
  });

  // Render inicial de la vista de Catálogo y Control de Roles
  updateRoleUI();
  updateBcvUI();
  updateCartBadge();
  renderActiveTab();
});
