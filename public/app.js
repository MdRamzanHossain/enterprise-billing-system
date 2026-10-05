// Master Technology Billing System - Frontend Application Logic

// Global Application State
const state = {
  token: localStorage.getItem('sec_gadgets_token') || null,
  user: JSON.parse(localStorage.getItem('sec_gadgets_user') || 'null'),
  activeTab: 'dashboard',
  userSubTab: 'users', // 'users' or 'roles'
  invoices: [],
  companies: [],
  products: [],
  trash: [],
  users: [],
  roles: [],
  availablePermissions: [],
  settings: {},
  stats: {},
  theme: {
    login: {
      title: 'Master Technology',
      subtitle: 'Online Billing & Management System',
      welcomeMessage: 'Please sign in with your credentials to access your billing workspace.',
      buttonText: 'Sign In to System',
      preset: 'midnight',
      bgGradient: 'from-slate-900 via-indigo-950 to-slate-900',
      headerGradient: 'from-blue-700 via-indigo-700 to-slate-900',
      primaryColor: '#2563eb',
      primaryHover: '#1d4ed8',
      cardStyle: 'solid',
      cardRadius: 'rounded-2xl',
      showLogo: true,
      customLogo: '',
      showNotice: false,
      noticeText: 'Notice: Authorized personnel only. All access is logged.',
      footerText: '© 2026 Master Technology. All rights reserved.'
    },
    app: {
      brandName: 'Master Technology',
      brandTagline: 'Billing Online System',
      primaryColor: '#2563eb',
      primaryHover: '#1d4ed8',
      navbarTheme: 'light',
      accentColor: '#4f46e5',
      footerText: '© 2026 Master Technology. All rights reserved.'
    },
    invoice: {
      headerBg: '#1e3a8a',
      tableHeaderBg: '#f8fafc',
      accentColor: '#2563eb'
    }
  },
  themeDraft: null,
  currentInvoice: null, // For viewing/printing
  editingInvoiceId: null, // If editing existing
  invoiceForm: {
    companyId: '',
    salesOrderNo: '',
    invoiceNo: '',
    date: '',
    time: '',
    buyerName: '',
    buyerAddress: '',
    soldBy: 'Tarek',
    zone: '',
    items: [
      { sl: 1, description: '', warranty: '', quantity: 1, unitPrice: 0, total: 0 }
    ],
    totalAmount: 0,
    lessDiscount: 0,
    addVat: 0,
    addAit: 0,
    addExtraCharges: 0,
    netPayableAmount: 0,
    previousDueAmount: 0,
    totalDueAmount: 0,
    receivedAmount: 0,
    closingBalance: 0,
    takaInWords: '',
    termsNotice: ''
  }
};

// Role-based access control
function can(permKey) {
  if (!state.user) return false;
  if (state.user.role === 'admin' || state.user.role === 'role-admin') return true;
  if (Array.isArray(state.user.permissions)) {
    if (state.user.permissions.includes('*')) return true;
    return state.user.permissions.includes(permKey);
  }
  return false;
}

// Currency formatter (BDT words)
function numberToBanglaWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero Taka Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(val) {
    if (val < 20) return units[val];
    const t = Math.floor(val / 10);
    const u = val % 10;
    return tens[t] + (u > 0 ? ' ' + units[u] : '');
  }

  function convertThreeDigits(val) {
    let str = '';
    const h = Math.floor(val / 100);
    const rest = val % 100;
    if (h > 0) {
      str += units[h] + ' Hundred';
      if (rest > 0) str += ' ';
    }
    if (rest > 0) {
      str += convertTwoDigits(rest);
    }
    return str;
  }

  // Indian/Bangladeshi Numbering: Crore (1,00,00,000), Lakh (1,00,000), Thousand (1,000), Hundred (100)
  let remainder = n;
  let words = '';

  const crore = Math.floor(remainder / 10000000);
  remainder %= 10000000;

  const lakh = Math.floor(remainder / 100000);
  remainder %= 100000;

  const thousand = Math.floor(remainder / 1000);
  remainder %= 1000;

  if (crore > 0) {
    words += (crore > 99 ? convertThreeDigits(crore) : convertTwoDigits(crore)) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertTwoDigits(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertTwoDigits(thousand) + ' Thousand ';
  }
  if (remainder > 0) {
    words += convertThreeDigits(remainder) + ' ';
  }

  words = words.trim();
  // Handle poisha if decimal
  const decimals = Math.round((Math.abs(Number(num)) - n) * 100);
  let poishaStr = '';
  if (decimals > 0) {
    poishaStr = ` And ${convertTwoDigits(decimals)} Poisha`;
  }

  return `${words}${poishaStr} Only`;
}

// Base path detection (works seamlessly on root domain, subdomains, and subdirectories like /billing)
const APP_BASE = window.location.pathname.replace(/\/([^\/]*\.[^\/]*)$/, '').replace(/\/+$/, '');

// HTTP client wrapper
async function api(path, method = 'GET', data = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const options = { method, headers };
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const resolvedPath = path.startsWith('/api') ? `${APP_BASE}${path}` : path;
  try {
    const res = await fetch(resolvedPath, options);
    const contentType = res.headers.get('content-type') || '';

    let result;
    if (contentType.includes('application/json')) {
      result = await res.json();
    } else {
      // Non-JSON response (e.g. HTML error page from web server or proxy)
      const text = await res.text();
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : `Status ${res.status}`;
      throw new Error(`${title} at ${resolvedPath}`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        logout();
        throw new Error(result.error || 'Invalid credentials or session expired.');
      }
      throw new Error(result.error || 'An error occurred');
    }
    return result;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// Notification toasts
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600' : (type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600');
  toast.className = `${bg} text-white px-5 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `
    <span>${type === 'error' ? '⚠️' : '✓'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Theme manager
const THEME_PRESETS = {
  midnight: {
    name: 'Midnight Slate',
    bg: 'linear-gradient(135deg, #090d16 0%, #171b30 50%, #090d16 100%)',
    header: 'from-blue-700 via-indigo-700 to-slate-900',
    primaryColor: '#2563eb',
    primaryHover: '#1d4ed8'
  },
  royal: {
    name: 'Royal Navy',
    bg: 'linear-gradient(135deg, #020617 0%, #1e3a8a 50%, #0f172a 100%)',
    header: 'from-blue-600 via-sky-600 to-indigo-900',
    primaryColor: '#1d4ed8',
    primaryHover: '#1e40af'
  },
  emerald: {
    name: 'Emerald Forest',
    bg: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #022c22 100%)',
    header: 'from-emerald-600 via-teal-700 to-slate-950',
    primaryColor: '#059669',
    primaryHover: '#047857'
  },
  violet: {
    name: 'Cosmic Violet',
    bg: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 50%, #1e1b4b 100%)',
    header: 'from-violet-600 via-purple-700 to-indigo-950',
    primaryColor: '#7c3aed',
    primaryHover: '#6d28d9'
  },
  sunset: {
    name: 'Sunset Crimson',
    bg: 'linear-gradient(135deg, #4c0519 0%, #881337 50%, #1c1917 100%)',
    header: 'from-rose-600 via-red-700 to-slate-950',
    primaryColor: '#e11d48',
    primaryHover: '#be123c'
  },
  'clean-light': {
    name: 'Minimal Light',
    bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #dbeafe 100%)',
    header: 'from-slate-800 via-slate-900 to-blue-950',
    primaryColor: '#2563eb',
    primaryHover: '#1d4ed8'
  },
  carbon: {
    name: 'Carbon Stealth',
    bg: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)',
    header: 'from-zinc-800 via-zinc-900 to-black',
    primaryColor: '#3f3f46',
    primaryHover: '#27272a'
  }
};

async function loadTheme() {
  try {
    const res = await api('/api/theme');
    if (res && res.login) {
      state.theme = {
        login: { ...state.theme.login, ...res.login },
        app: { ...state.theme.app, ...(res.app || {}) },
        invoice: { ...state.theme.invoice, ...(res.invoice || {}) }
      };
    }
  } catch (e) {
    console.warn('Theme loading notice:', e.message);
  }
  applyTheme(state.theme);
}

function applyTheme(theme) {
  if (!theme) return;
  const primary = (theme.app && theme.app.primaryColor) || (theme.login && theme.login.primaryColor) || '#2563eb';
  const primaryHover = (theme.app && theme.app.primaryHover) || (theme.login && theme.login.primaryHover) || '#1d4ed8';

  document.documentElement.style.setProperty('--brand-primary', primary);
  document.documentElement.style.setProperty('--brand-primary-hover', primaryHover);

  const brandName = (theme.app && theme.app.brandName) || (theme.login && theme.login.title) || 'Master Technology';
  const brandTagline = (theme.app && theme.app.brandTagline) || (theme.login && theme.login.subtitle) || 'Billing Online System';
  document.title = `${brandName} - ${brandTagline}`;
}

// Application initialization
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  if (state.token && state.user) {
    try {
      await checkAuth();
      await loadInitialData();
      renderApp();
    } catch {
      renderLogin();
    }
  } else {
    renderLogin();
  }
});

async function checkAuth() {
  try {
    const res = await api('/api/auth/me');
    state.user = res.user;
    localStorage.setItem('sec_gadgets_user', JSON.stringify(res.user));
  } catch {
    logout();
  }
}

async function loadInitialData() {
  try {
    const promises = [
      api('/api/settings').catch(() => ({})),
      api('/api/theme').catch(() => null),
      api('/api/companies').catch(() => ([])),
      api('/api/products').catch(() => ([])),
      api('/api/invoices').catch(() => ([])),
      api('/api/stats').catch(() => ({})),
      api('/api/trash').catch(() => ([]))
    ];

    const [settings, themeRes, companies, products, invoices, stats, trash] = await Promise.all(promises);

    state.settings = settings || {};
    if (themeRes && themeRes.login) {
      state.theme = themeRes;
      applyTheme(state.theme);
    }
    state.companies = Array.isArray(companies) ? companies : [];
    state.products = Array.isArray(products) ? products : [];
    state.invoices = Array.isArray(invoices) ? invoices : [];
    state.stats = stats || {};
    state.trash = Array.isArray(trash) ? trash : [];

    if (can('roles.view') || can('users.view')) {
      try {
        const rolesRes = await api('/api/roles');
        state.roles = rolesRes.roles || [];
        state.availablePermissions = rolesRes.availablePermissions || [];
      } catch (e) {
        console.error('Failed loading roles:', e);
      }
    }

    if (can('users.view')) {
      try {
        state.users = await api('/api/users');
      } catch (e) {
        console.error('Failed loading users:', e);
      }
    }
  } catch (err) {
    console.error('Failed loading initial data:', err);
  }
}

// Authentication
async function login(username, password) {
  try {
    const res = await api('/api/auth/login', 'POST', { username, password });
    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('sec_gadgets_token', res.token);
    localStorage.setItem('sec_gadgets_user', JSON.stringify(res.user));
    showToast(`Welcome back, ${res.user.name}!`);
    await loadInitialData();
    renderApp();
  } catch (err) {
    console.error('Login failed:', err);
  }
}

function logout() {
  if (state.token) {
    api('/api/auth/logout', 'POST').catch(() => {});
  }
  state.token = null;
  state.user = null;
  localStorage.removeItem('sec_gadgets_token');
  localStorage.removeItem('sec_gadgets_user');
  renderLogin();
}

// Navigation
function switchTab(tab) {
  state.activeTab = tab;
  renderApp();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getThemeLoginConfig(customTheme = null) {
  const theme = customTheme || state.theme || {};
  const login = theme.login || {};
  const presetKey = login.preset || 'midnight';
  const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.midnight;

  return {
    title: login.title || 'Master Technology',
    subtitle: login.subtitle || 'Online Billing & Management System',
    welcomeMessage: login.welcomeMessage || 'Please sign in with your credentials to access your billing workspace.',
    buttonText: login.buttonText || 'Sign In to System',
    footerText: login.footerText || '© 2026 Master Technology. All rights reserved.',
    showNotice: !!login.showNotice,
    noticeText: login.noticeText || 'Notice: Authorized personnel only. All access is logged.',
    showLogo: login.showLogo !== false,
    logoUrl: login.customLogo || (state.companies && state.companies[0] && state.companies[0].logo) || window.BRAND_LOGO || '/logo.png',
    cardStyle: login.cardStyle || 'solid', // 'solid', 'glassmorphism', 'dark-glass'
    cardRadius: login.cardRadius || 'rounded-2xl',
    bgStyle: preset.bg,
    headerGradient: preset.header,
    primaryColor: login.primaryColor || preset.primaryColor || '#2563eb',
    primaryHover: login.primaryHover || preset.primaryHover || '#1d4ed8'
  };
}

// Login view
function renderLogin(previewTheme = null) {
  const root = document.getElementById('app-root');
  if (!root) return;
  const cfg = getThemeLoginConfig(previewTheme);

  const isDarkGlass = cfg.cardStyle === 'dark-glass';
  const isGlass = cfg.cardStyle === 'glassmorphism';

  let cardClasses = 'bg-white shadow-2xl border border-slate-100 text-slate-800';
  if (isDarkGlass) {
    cardClasses = 'dark-glass-card shadow-2xl border border-white/10 text-white';
  } else if (isGlass) {
    cardClasses = 'glassmorphism-card shadow-2xl border border-white/40 text-slate-800';
  }

  const labelClasses = isDarkGlass ? 'text-slate-300' : 'text-slate-600';
  const inputClasses = isDarkGlass 
    ? 'w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition'
    : 'w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition bg-white text-slate-900';

  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 transition-all duration-300" style="background: ${cfg.bgStyle};">
      <div class="${cardClasses} ${cfg.cardRadius} w-full max-w-md overflow-hidden relative shadow-2xl">
        <!-- Brand Header -->
        <div class="bg-gradient-to-r ${cfg.headerGradient} p-8 text-center text-white relative">
          ${cfg.showLogo ? `
            <div class="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4 p-2">
              <img src="${cfg.logoUrl}" alt="Brand Logo" class="w-full h-full object-contain">
            </div>
          ` : ''}
          <h1 class="text-2xl font-bold tracking-tight">${escapeHtml(cfg.title)}</h1>
          <p class="text-xs text-blue-200 mt-1 uppercase tracking-widest font-semibold">${escapeHtml(cfg.subtitle)}</p>
        </div>

        <!-- Form Body -->
        <div class="p-8">
          ${cfg.welcomeMessage ? `
            <p class="text-xs ${isDarkGlass ? 'text-slate-300' : 'text-slate-500'} mb-5 text-center leading-relaxed">${escapeHtml(cfg.welcomeMessage)}</p>
          ` : ''}

          ${cfg.showNotice ? `
            <div class="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 ${isDarkGlass ? 'text-amber-300' : 'text-amber-800'} text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>${escapeHtml(cfg.noticeText)}</span>
            </div>
          ` : ''}

          <form id="login-form" onsubmit="event.preventDefault(); handleLoginSubmit();" class="space-y-5">
            <div>
              <label class="block text-xs font-semibold ${labelClasses} uppercase tracking-wider mb-2">Username</label>
              <div class="relative">
                <input type="text" id="login-username" required placeholder="Enter username" class="${inputClasses}">
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold ${labelClasses} uppercase tracking-wider mb-2">Password</label>
              <div class="relative">
                <input type="password" id="login-password" required placeholder="Enter password" class="${inputClasses}">
              </div>
            </div>

            <button type="submit" 
              style="background-color: ${cfg.primaryColor};"
              onmouseover="this.style.backgroundColor='${cfg.primaryHover}'"
              onmouseout="this.style.backgroundColor='${cfg.primaryColor}'"
              class="w-full py-3.5 text-white font-semibold rounded-lg shadow-md transition duration-200 flex items-center justify-center gap-2">
              ${escapeHtml(cfg.buttonText)}
            </button>
          </form>

          ${cfg.footerText ? `
            <div class="mt-6 pt-4 border-t ${isDarkGlass ? 'border-slate-800' : 'border-slate-100'} text-center">
              <p class="text-[11px] ${isDarkGlass ? 'text-slate-400' : 'text-slate-400'}">${escapeHtml(cfg.footerText)}</p>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function handleLoginSubmit() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  login(username, password);
}

// Shell layout
function renderApp() {
  const root = document.getElementById('app-root');
  const canDashboard = can('reports.view') || can('invoices.view');
  const canInvoices = can('invoices.view');
  const canCreateBill = can('invoices.create');
  const canProducts = can('products.view');
  const canUsers = can('users.view') || can('roles.view');
  const canSettings = can('settings.view') || can('companies.view');
  const canTrash = can('trash.view');

  const roleDisplayName = state.user.roleName || (state.user.role === 'admin' ? 'Administrator' : state.user.role);
  const isSuperAdmin = state.user.role === 'admin' || state.user.role === 'role-admin';
  const roleBadge = isSuperAdmin ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300';

  root.innerHTML = `
    <div class="min-h-screen bg-slate-50 flex flex-col">
      <!-- Navbar -->
      <header id="app-navbar" class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="${window.BRAND_LOGO || '/logo.png'}" alt="Master Technology" class="h-10 w-auto">
            <div>
              <div class="text-sm font-bold text-slate-900 leading-tight">${escapeHtml(state.theme?.app?.brandName || 'Master Technology')}</div>
              <div class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">${escapeHtml(state.theme?.app?.brandTagline || 'Billing Online System')}</div>
            </div>
          </div>

          <!-- User Info & Action -->
          <div class="flex items-center gap-4">
            <div class="text-right hidden sm:block">
              <div class="text-sm font-semibold text-slate-800">${state.user.name}</div>
              <div class="flex items-center justify-end gap-1.5 mt-0.5">
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${roleBadge}">${roleDisplayName}</span>
                <span class="text-xs text-slate-400">@${state.user.username}</span>
              </div>
            </div>
            <button onclick="logout()" title="Logout" 
              class="px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition flex items-center gap-1.5">
              <span>Exit</span>
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-3 border-t border-slate-100 overflow-x-auto text-sm">
          ${canDashboard ? `
            <button onclick="switchTab('dashboard')" 
              class="py-3 px-3 font-medium transition border-b-2 whitespace-nowrap ${state.activeTab === 'dashboard' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}">
              📊 Dashboard
            </button>
          ` : ''}

          ${canInvoices ? `
            <button onclick="switchTab('invoices')" 
              class="py-3 px-3 font-medium transition border-b-2 whitespace-nowrap ${state.activeTab === 'invoices' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}">
              🧾 Invoices (${state.invoices.length})
            </button>
          ` : ''}

          ${canCreateBill ? `
            <button onclick="startNewInvoice()" 
              class="py-3 px-3 font-semibold transition border-b-2 whitespace-nowrap text-blue-700 bg-blue-50/60 rounded-t-md hover:bg-blue-100/60 flex items-center gap-1.5">
              ➕ Create Bill
            </button>
          ` : ''}

          ${canProducts ? `
            <button onclick="switchTab('products')" 
              class="py-3 px-3 font-medium transition border-b-2 whitespace-nowrap ${state.activeTab === 'products' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}">
              📦 Products (${state.products.length})
            </button>
          ` : ''}

          ${canUsers ? `
            <button onclick="switchTab('users')" 
              class="py-3 px-3 font-medium transition border-b-2 whitespace-nowrap ${state.activeTab === 'users' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}">
              👥 Users & Roles
            </button>
          ` : ''}

          ${canSettings ? `
            <button onclick="switchTab('settings')" 
              class="py-3 px-3 font-medium transition border-b-2 whitespace-nowrap ${state.activeTab === 'settings' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}">
              🏢 Companies & Settings
            </button>
            <button onclick="switchTab('theme')" 
              class="py-3 px-3 font-medium transition border-b-2 whitespace-nowrap ${state.activeTab === 'theme' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}">
              🎨 Theme Customization
            </button>
          ` : ''}

          ${canTrash ? `
            <button onclick="switchTab('trash')" 
              class="py-3 px-3 font-medium transition border-b-2 whitespace-nowrap ${state.activeTab === 'trash' ? 'border-red-600 text-red-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}">
              🗑️ Trash Box (${state.trash ? state.trash.length : 0})
            </button>
          ` : ''}
        </div>
      </header>

      <!-- Main Content Area -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full print:p-0 print:m-0 print:max-w-none">
        ${renderCurrentTab()}
      </main>

      <!-- Footer -->
      <footer class="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 print:hidden">
        <p>${escapeHtml(state.theme?.app?.footerText || state.theme?.login?.footerText || 'Master Technology & Win Trade International • 80, Laboratory Road, Dhaka-1205 • Phone: 01958-444381')}</p>
      </footer>
    </div>
  `;
}

// View routing
function renderCurrentTab() {
  if (state.activeTab === 'dashboard' && !can('reports.view') && !can('invoices.view')) state.activeTab = 'invoices';
  if (state.activeTab === 'invoices' && !can('invoices.view')) state.activeTab = 'products';
  if (state.activeTab === 'new-invoice' && !can('invoices.create')) state.activeTab = 'invoices';
  if (state.activeTab === 'products' && !can('products.view')) state.activeTab = 'invoices';
  if (state.activeTab === 'users' && !can('users.view') && !can('roles.view')) state.activeTab = 'invoices';
  if (state.activeTab === 'settings' && !can('settings.view')) state.activeTab = 'invoices';
  if (state.activeTab === 'theme' && !can('settings.view')) state.activeTab = 'invoices';
  if (state.activeTab === 'trash' && !can('trash.view')) state.activeTab = 'invoices';

  switch (state.activeTab) {
    case 'dashboard':
      return renderDashboardTab();
    case 'invoices':
      return renderInvoicesTab();
    case 'new-invoice':
      return renderInvoiceFormTab();
    case 'view-invoice':
      return renderViewInvoiceTab();
    case 'products':
      return renderProductsTab();
    case 'users':
      return renderUsersTab();
    case 'settings':
      return renderSettingsTab();
    case 'theme':
      return renderThemeCustomizationTab();
    case 'trash':
      return renderTrashTab();
    default:
      return renderDashboardTab();
  }
}

// Dashboard view
function renderDashboardTab() {
  const stats = state.stats || {};
  return `
    <div class="space-y-6">
      <!-- Welcome Banner -->
      <div class="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight">Billing Management Dashboard</h2>
          <p class="text-blue-100 text-sm mt-1 max-w-xl">
            Welcome back, <span class="font-bold text-white">${state.user.name}</span>. Create invoices matching the official company layout, track payments, download instant PDF copies, and manage system accounts.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button onclick="startNewInvoice()" 
            class="px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl shadow-md text-sm transition flex items-center gap-2">
            <span>➕</span> Generate New Bill
          </button>
        </div>
      </div>

      <!-- KPI Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Invoiced</div>
          <div class="text-2xl font-bold text-slate-900 mt-2">TK ${(stats.totalSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div class="text-xs text-blue-600 mt-1 font-medium">${stats.totalInvoices || 0} Bills Generated</div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Received</div>
          <div class="text-2xl font-bold text-emerald-600 mt-2">TK ${(stats.totalReceived || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div class="text-xs text-slate-500 mt-1">Paid by clients</div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Closing / Total Due</div>
          <div class="text-2xl font-bold text-amber-600 mt-2">TK ${(stats.totalDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div class="text-xs text-amber-700 mt-1 font-medium">Outstanding balance</div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory Catalog</div>
          <div class="text-2xl font-bold text-indigo-600 mt-2">${stats.totalProducts || 0} Items</div>
          <div class="text-xs text-slate-500 mt-1">${stats.totalUsers || 0} Active Staff Accounts</div>
        </div>
      </div>

      <!-- Recent Invoices Widget -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="font-bold text-slate-900 text-base">Recent Bills & Invoices</h3>
          <button onclick="switchTab('invoices')" class="text-xs font-semibold text-blue-600 hover:text-blue-800">
            View All Invoices &rarr;
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-700">
            <thead class="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3">Invoice No</th>
                <th class="px-6 py-3">Date</th>
                <th class="px-6 py-3">Buyer Name</th>
                <th class="px-6 py-3">Sold By</th>
                <th class="px-6 py-3 text-right">Net Payable</th>
                <th class="px-6 py-3 text-right">Due Balance</th>
                <th class="px-6 py-3 text-center">Status</th>
                <th class="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${state.invoices.slice(0, 5).map(inv => renderInvoiceRow(inv)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Invoices list
function renderInvoicesTab() {
  return `
    <div class="space-y-5">
      <!-- Action Toolbar -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex-1 w-full md:max-w-md relative">
          <input type="text" id="invoice-search" placeholder="Search by Invoice #, Order #, Buyer, Sold By..." 
            oninput="handleSearchInvoices(this.value)"
            class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          <span class="absolute left-3 top-2.5 text-slate-400">🔍</span>
        </div>

        <div class="flex items-center gap-3 w-full md:w-auto justify-end">
          ${can('invoices.create') ? `
            <button onclick="startNewInvoice()" 
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm text-sm transition flex items-center gap-2">
              <span>➕</span> New Invoice
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Invoices Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-700">
            <thead class="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3.5">Invoice & Order</th>
                <th class="px-6 py-3.5">Date & Time</th>
                <th class="px-6 py-3.5">Buyer Details</th>
                <th class="px-6 py-3.5">Created By</th>
                <th class="px-6 py-3.5">Sold By</th>
                <th class="px-6 py-3.5 text-right">Items</th>
                <th class="px-6 py-3.5 text-right">Net Amount</th>
                <th class="px-6 py-3.5 text-right">Closing Balance</th>
                <th class="px-6 py-3.5 text-center">Status</th>
                <th class="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="invoices-table-body" class="divide-y divide-slate-100">
              ${state.invoices.length > 0 ? state.invoices.map(inv => renderInvoiceRow(inv)).join('') : `
                <tr>
                  <td colspan="10" class="px-6 py-12 text-center text-slate-400">No invoices found.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderInvoiceRow(inv) {
  const statusColor = inv.status === 'Paid' 
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
    : (inv.status === 'Partial' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300');

  const compName = (inv.company && inv.company.name) 
    || ((state.companies.find(c => c.id === inv.companyId) || {}).name) 
    || 'master technology';

  return `
    <tr class="hover:bg-slate-50/80 transition">
      <td class="px-6 py-4">
        <div class="font-bold text-slate-900">${inv.invoiceNo}</div>
        <div class="flex items-center gap-1.5 mt-0.5">
          <span class="text-xs text-slate-500">${inv.salesOrderNo || '-'}</span>
          <span class="text-[10px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 rounded">${compName}</span>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-slate-800">${inv.date}</div>
        <div class="text-[11px] text-slate-400">${inv.time || ''}</div>
      </td>
      <td class="px-6 py-4">
        <div class="font-semibold text-slate-900">${inv.buyerName || 'Walk-in Customer'}</div>
        <div class="text-xs text-slate-500">${inv.buyerAddress || '-'}</div>
      </td>
      <td class="px-6 py-4">
        <div class="text-xs font-bold text-slate-800">${inv.createdBy ? inv.createdBy.name : (inv.soldBy || 'System')}</div>
        <div class="text-[10px] text-slate-400">@${inv.createdBy ? inv.createdBy.username : 'user'}</div>
      </td>
      <td class="px-6 py-4 text-xs font-medium text-slate-700">${inv.soldBy || 'Tarek'}</td>
      <td class="px-6 py-4 text-right text-xs font-semibold">${inv.items ? inv.items.length : 0} items</td>
      <td class="px-6 py-4 text-right font-bold text-slate-900">TK ${(inv.netPayableAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="px-6 py-4 text-right font-bold text-amber-700">TK ${(inv.closingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="px-6 py-4 text-center">
        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor}">
          ${inv.status || 'Due'}
        </span>
      </td>
      <td class="px-6 py-4 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick="viewInvoice('${inv.id}')" title="View & Print Bill" 
            class="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md text-xs font-semibold transition flex items-center gap-1">
            <span>👁️</span> View & Print
          </button>
          ${can('invoices.edit') ? `
            <button onclick="editInvoice('${inv.id}')" title="Edit Bill" 
              class="px-2 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-md text-xs font-medium transition">
              ✏️
            </button>
          ` : ''}
          ${can('invoices.delete') ? `
            <button onclick="deleteInvoice('${inv.id}')" title="Delete Bill" 
              class="px-2 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-md text-xs font-medium transition">
              🗑️
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
}

function handleSearchInvoices(query) {
  const q = query.toLowerCase().trim();
  const filtered = state.invoices.filter(inv => 
    (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(q)) ||
    (inv.salesOrderNo && inv.salesOrderNo.toLowerCase().includes(q)) ||
    (inv.buyerName && inv.buyerName.toLowerCase().includes(q)) ||
    (inv.soldBy && inv.soldBy.toLowerCase().includes(q))
  );

  const tbody = document.getElementById('invoices-table-body');
  if (tbody) {
    tbody.innerHTML = filtered.length > 0 
      ? filtered.map(inv => renderInvoiceRow(inv)).join('')
      : `<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400">No matching invoices found.</td></tr>`;
  }
}

// Invoice actions
async function startNewInvoice(targetCompanyId = null) {
  state.editingInvoiceId = null;
  try {
    const comp = (targetCompanyId && state.companies.find(c => c.id === targetCompanyId))
      || state.companies.find(c => c.isDefault)
      || state.companies[0]
      || state.settings;

    const companyId = comp && comp.id ? comp.id : '';
    const nums = await api('/api/invoices/next-numbers' + (companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''));
    state.invoiceForm = {
      companyId: companyId,
      salesOrderNo: nums.salesOrderNo,
      invoiceNo: nums.invoiceNo,
      date: new Date().toLocaleDateString('en-GB'), // DD/MM/YYYY
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      buyerName: '',
      buyerAddress: '',
      soldBy: state.settings.defaultSoldBy || state.user.name || 'Tarek',
      zone: '',
      items: [
        { sl: 1, description: '', warranty: '01 YEAR', quantity: 1, unitPrice: 0, total: 0 }
      ],
      totalAmount: 0,
      lessDiscount: 0,
      addVat: 0,
      addAit: 0,
      addExtraCharges: 0,
      netPayableAmount: 0,
      previousDueAmount: 0,
      totalDueAmount: 0,
      receivedAmount: 0,
      closingBalance: 0,
      takaInWords: 'Zero Taka Only',
      termsNotice: (comp && comp.termsNotice) || state.settings.termsNotice || 'Thank you for with us after 3 working days sold products are non exchangable and non refundable'
    };
    state.activeTab = 'new-invoice';
    renderApp();
  } catch (err) {
    console.error('Error starting new invoice:', err);
  }
}

async function handleInvoiceCompanyChange(companyId) {
  state.invoiceForm.companyId = companyId;
  const comp = state.companies.find(c => c.id === companyId);
  try {
    const nums = await api(`/api/invoices/next-numbers?companyId=${encodeURIComponent(companyId)}`);
    state.invoiceForm.salesOrderNo = nums.salesOrderNo;
    state.invoiceForm.invoiceNo = nums.invoiceNo;
    if (comp && comp.termsNotice) {
      state.invoiceForm.termsNotice = comp.termsNotice;
    }
    showToast(`Switched company to: ${comp ? comp.name : 'Selected Company'}`);
    renderApp();
  } catch (err) {
    console.error('Error switching company:', err);
  }
}

function editInvoice(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;

  state.editingInvoiceId = id;
  state.invoiceForm = JSON.parse(JSON.stringify(inv));
  if (!state.invoiceForm.companyId) {
    const defaultComp = state.companies.find(c => c.isDefault) || state.companies[0];
    state.invoiceForm.companyId = defaultComp ? defaultComp.id : '';
  }
  state.activeTab = 'new-invoice';
  renderApp();
}

function calculateInvoiceTotals() {
  const f = state.invoiceForm;
  let totalAmount = 0;

  f.items.forEach((item, idx) => {
    item.sl = idx + 1;
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    item.total = Number((qty * price).toFixed(2));
    totalAmount += item.total;
  });

  f.totalAmount = Number(totalAmount.toFixed(2));
  const discount = Number(f.lessDiscount) || 0;
  const vat = Number(f.addVat) || 0;
  const ait = Number(f.addAit) || 0;
  const extra = Number(f.addExtraCharges) || 0;

  f.netPayableAmount = Number((f.totalAmount - discount + vat + ait + extra).toFixed(2));
  const prevDue = Number(f.previousDueAmount) || 0;
  f.totalDueAmount = Number((f.netPayableAmount + prevDue).toFixed(2));

  const received = Number(f.receivedAmount) || 0;
  f.closingBalance = Number((f.totalDueAmount - received).toFixed(2));

  f.takaInWords = numberToBanglaWords(f.closingBalance > 0 ? f.closingBalance : f.netPayableAmount);
}

function addInvoiceItemRow() {
  state.invoiceForm.items.push({
    sl: state.invoiceForm.items.length + 1,
    description: '',
    warranty: '',
    quantity: 1,
    unitPrice: 0,
    total: 0
  });
  renderApp();
}

function removeInvoiceItemRow(index) {
  if (state.invoiceForm.items.length <= 1) {
    showToast('At least one item is required in the bill', 'warning');
    return;
  }
  state.invoiceForm.items.splice(index, 1);
  calculateInvoiceTotals();
  renderApp();
}

function handleProductSelect(index, productName) {
  const product = state.products.find(p => p.name === productName);
  if (product) {
    state.invoiceForm.items[index].description = product.name;
    state.invoiceForm.items[index].warranty = product.warranty || '';
    state.invoiceForm.items[index].unitPrice = product.unitPrice || 0;
    state.invoiceForm.items[index].total = (Number(state.invoiceForm.items[index].quantity) || 1) * product.unitPrice;
    calculateInvoiceTotals();
    renderApp();
  }
}

function handleProductInput(index, value) {
  state.invoiceForm.items[index].description = value;
  // If user typed or autocompleted an existing product name, pull its default price and warranty
  const matched = state.products.find(p => p.name.toLowerCase() === value.trim().toLowerCase());
  if (matched) {
    if (matched.warranty && !state.invoiceForm.items[index].warranty) {
      state.invoiceForm.items[index].warranty = matched.warranty;
    }
    if (Number(matched.unitPrice) > 0 && (!Number(state.invoiceForm.items[index].unitPrice) || Number(state.invoiceForm.items[index].unitPrice) === 0)) {
      state.invoiceForm.items[index].unitPrice = matched.unitPrice;
    }
  }
  calculateInvoiceTotals();
  updateCalculationUI();
}

function updateItemField(index, field, value) {
  state.invoiceForm.items[index][field] = value;
  calculateInvoiceTotals();
  updateCalculationUI();
}

function updateFormMeta(field, value) {
  state.invoiceForm[field] = value;
  calculateInvoiceTotals();
  updateCalculationUI();
}

function updateCalculationUI() {
  const f = state.invoiceForm;
  const el = id => document.getElementById(id);

  f.items.forEach((item, idx) => {
    const totalEl = el(`item-total-${idx}`);
    if (totalEl) totalEl.innerText = (item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  });

  if (el('calc-total-amount')) el('calc-total-amount').innerText = (f.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  if (el('calc-net-payable')) el('calc-net-payable').innerText = (f.netPayableAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  if (el('calc-total-due')) el('calc-total-due').innerText = (f.totalDueAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  if (el('calc-closing-balance')) el('calc-closing-balance').innerText = (f.closingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  if (el('calc-taka-words')) el('calc-taka-words').innerText = f.takaInWords;
}

async function saveInvoice() {
  calculateInvoiceTotals();
  const f = state.invoiceForm;

  if (!f.buyerName.trim()) {
    showToast('Please enter Buyer Name', 'warning');
    return;
  }

  if (f.items.length === 0 || !f.items[0].description.trim()) {
    showToast('Please enter at least one product description', 'warning');
    return;
  }

  try {
    if (state.editingInvoiceId) {
      const updated = await api(`/api/invoices/${state.editingInvoiceId}`, 'PUT', f);
      showToast('Invoice updated successfully! Products synchronized.');
      state.invoices = await api('/api/invoices');
      state.products = await api('/api/products'); // Reload products list
      state.stats = await api('/api/stats');
      viewInvoice(updated.id);
    } else {
      const created = await api('/api/invoices', 'POST', f);
      showToast('Invoice generated successfully! New products were saved to catalog.');
      state.invoices = await api('/api/invoices');
      state.products = await api('/api/products'); // Reload products list
      state.stats = await api('/api/stats');
      viewInvoice(created.id);
    }
  } catch (err) {
    console.error('Save invoice error:', err);
  }
}

// Invoice editor view
function renderInvoiceFormTab() {
  const f = state.invoiceForm;
  calculateInvoiceTotals();

  const selectedComp = (f.companyId && state.companies.find(c => c.id === f.companyId))
    || state.companies.find(c => c.isDefault)
    || state.companies[0]
    || { id: '', name: state.settings.companyName || 'Master Technology', address: '', phone: '', email: '', logo: window.BRAND_LOGO };

  const compLogo = selectedComp.logo || window.BRAND_LOGO || '/logo.png';

  return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-8">
      <!-- Title & Action Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">${state.editingInvoiceId ? 'Edit Invoice' : 'Create New Invoice / Bill'}</h2>
          <p class="text-xs text-slate-500 mt-1">Fill the details below. All calculations and words are automatically updated.</p>
        </div>
        <div class="flex items-center gap-3">
          <button onclick="switchTab('invoices')" class="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition">
            Cancel
          </button>
          <button onclick="saveInvoice()" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm text-sm transition flex items-center gap-2">
            <span>💾</span> Save & Preview Bill
          </button>
        </div>
      </div>

      <!-- Company Profile & Brand Selector Banner -->
      <div class="bg-gradient-to-r from-blue-50 via-indigo-50/60 to-slate-100 rounded-xl p-4 sm:p-5 border border-blue-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
            <img src="${compLogo}" alt="${selectedComp.name}" class="max-h-full max-w-full object-contain">
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/90 px-2 py-0.5 rounded">Issuing Company Profile</span>
              ${selectedComp.isDefault ? '<span class="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">Default Brand</span>' : ''}
            </div>
            <div class="text-lg font-extrabold text-slate-900 mt-0.5">${selectedComp.name}</div>
            <div class="text-xs text-slate-500 font-medium">
              ${selectedComp.address ? `${selectedComp.address} • ` : ''}Phone: ${selectedComp.phone || '01958-444381'}
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <label class="text-xs font-bold text-slate-700 whitespace-nowrap">Bill Under Company:</label>
          <select onchange="handleInvoiceCompanyChange(this.value)" 
            class="px-3.5 py-2.5 bg-white border border-blue-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 shadow-sm outline-none">
            ${state.companies.map(c => `
              <option value="${c.id}" ${c.id === (f.companyId || selectedComp.id) ? 'selected' : ''}>
                🏢 ${c.name} ${c.isDefault ? '★ (Default)' : ''}
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Invoice Metadata Form (Grid) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
        <!-- Left Side: Order & Buyer -->
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Sales Order No:</label>
            <input type="text" value="${f.salesOrderNo}" oninput="updateFormMeta('salesOrderNo', this.value)" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Invoice No:</label>
            <input type="text" value="${f.invoiceNo}" oninput="updateFormMeta('invoiceNo', this.value)" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Buyer Name *:</label>
            <input type="text" value="${f.buyerName}" placeholder="e.g. Ramzan Vai, Mostofa" oninput="updateFormMeta('buyerName', this.value)" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Buyer Address:</label>
            <input type="text" value="${f.buyerAddress}" placeholder="e.g. Hazaribagh, Dhaka" oninput="updateFormMeta('buyerAddress', this.value)" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
        </div>

        <!-- Right Side: Date, Sold By, Zone -->
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Date (DD/MM/YYYY):</label>
              <input type="text" value="${f.date}" oninput="updateFormMeta('date', this.value)" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Time:</label>
              <input type="text" value="${f.time}" oninput="updateFormMeta('time', this.value)" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Sold By:</label>
            <input type="text" value="${f.soldBy}" oninput="updateFormMeta('soldBy', this.value)" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Zone:</label>
            <input type="text" value="${f.zone}" placeholder="e.g. Dhaka South / Elephant Road" oninput="updateFormMeta('zone', this.value)" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
        </div>
      </div>

      <!-- Line Items Section -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-900">Bill Itemized Products</h3>
          <button onclick="addInvoiceItemRow()" 
            class="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
            <span>➕</span> Add Product Line
          </button>
        </div>

        <div class="overflow-x-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-100 text-xs font-bold uppercase text-slate-700 border-b border-slate-200">
              <tr>
                <th class="px-3 py-3 text-center w-12">SL</th>
                <th class="px-3 py-3">Product Description (or pick quick item)</th>
                <th class="px-3 py-3 w-32">Warranty</th>
                <th class="px-3 py-3 text-center w-24">Quantity</th>
                <th class="px-3 py-3 text-right w-36">Unit Price (TK)</th>
                <th class="px-3 py-3 text-right w-36">Total (TK)</th>
                <th class="px-3 py-3 text-center w-12"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${f.items.map((item, idx) => `
                <tr class="hover:bg-slate-50">
                  <td class="px-3 py-2.5 text-center font-bold text-slate-500">${idx + 1}</td>
                  <td class="px-3 py-2.5">
                    <div class="space-y-1">
                      <input type="text" list="products-datalist" value="${item.description}" placeholder="Type product name (new items auto-save to catalog)" 
                        oninput="handleProductInput(${idx}, this.value)"
                        class="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm font-medium focus:ring-1 focus:ring-blue-500 outline-none">
                      <!-- Quick Picker Select -->
                      <select onchange="if(this.value) handleProductSelect(${idx}, this.value)" class="text-xs text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
                        <option value="">-- Or choose from existing items --</option>
                        ${state.products.map(p => `<option value="${p.name}">${p.name} (TK ${p.unitPrice})</option>`).join('')}
                      </select>
                    </div>
                  </td>
                  <td class="px-3 py-2.5">
                    <input type="text" value="${item.warranty || ''}" placeholder="e.g. 01 YEAR" 
                      oninput="updateItemField(${idx}, 'warranty', this.value)"
                      class="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 outline-none">
                  </td>
                  <td class="px-3 py-2.5">
                    <input type="number" min="1" value="${item.quantity}" 
                      oninput="updateItemField(${idx}, 'quantity', this.value)"
                      class="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm text-center font-bold focus:ring-1 focus:ring-blue-500 outline-none">
                  </td>
                  <td class="px-3 py-2.5">
                    <input type="number" step="any" min="0" value="${item.unitPrice}" 
                      oninput="updateItemField(${idx}, 'unitPrice', this.value)"
                      class="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm text-right font-bold focus:ring-1 focus:ring-blue-500 outline-none">
                  </td>
                  <td class="px-3 py-2.5 text-right font-bold text-slate-900" id="item-total-${idx}">
                    ${(item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td class="px-3 py-2.5 text-center">
                    <button onclick="removeInvoiceItemRow(${idx})" title="Remove item" 
                      class="text-red-500 hover:text-red-700 text-sm font-bold p-1">
                      ✕
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Datalist for fast autocomplete -->
        <datalist id="products-datalist">
          ${state.products.map(p => `<option value="${p.name}">TK ${p.unitPrice}${p.warranty ? ' (' + p.warranty + ')' : ''}</option>`).join('')}
        </datalist>
        <p class="text-[11px] text-slate-400 italic">💡 Any product entered with price that is not currently in the catalog will be automatically saved to your Products Inventory upon billing.</p>
      </div>

      <!-- Financial Calculation Matrix -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        <!-- Notice & Taka Words -->
        <div class="lg:col-span-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Company Guarantee & Terms Notice:</label>
            <textarea rows="3" oninput="updateFormMeta('termsNotice', this.value)"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none">${f.termsNotice}</textarea>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div class="text-xs font-bold text-blue-900 uppercase tracking-wider">TAKA IN WORD:</div>
            <div id="calc-taka-words" class="text-sm font-bold text-blue-800 mt-1 uppercase italic">${f.takaInWords}</div>
          </div>
        </div>

        <!-- Calculations Table (matches exact reference formula) -->
        <div class="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
          <div class="flex justify-between items-center text-sm font-semibold py-1 border-b border-slate-200">
            <span class="text-slate-700">Total Amount:</span>
            <span class="text-slate-900 font-bold" id="calc-total-amount">${f.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div class="flex justify-between items-center text-xs py-1">
            <span class="text-slate-600 font-medium">Less Discount:</span>
            <input type="number" step="any" min="0" value="${f.lessDiscount}" oninput="updateFormMeta('lessDiscount', this.value)"
              class="w-32 px-2 py-1 border border-slate-300 rounded text-right text-xs font-bold">
          </div>

          <div class="flex justify-between items-center text-xs py-1">
            <span class="text-slate-600 font-medium">Add VAT:</span>
            <input type="number" step="any" min="0" value="${f.addVat}" oninput="updateFormMeta('addVat', this.value)"
              class="w-32 px-2 py-1 border border-slate-300 rounded text-right text-xs font-bold">
          </div>

          <div class="flex justify-between items-center text-xs py-1">
            <span class="text-slate-600 font-medium">Add AIT (Advance Income Tax):</span>
            <input type="number" step="any" min="0" value="${f.addAit}" oninput="updateFormMeta('addAit', this.value)"
              class="w-32 px-2 py-1 border border-slate-300 rounded text-right text-xs font-bold">
          </div>

          <div class="flex justify-between items-center text-xs py-1 border-b border-slate-200 pb-2">
            <span class="text-slate-600 font-medium">Add Extra Charges:</span>
            <input type="number" step="any" min="0" value="${f.addExtraCharges}" oninput="updateFormMeta('addExtraCharges', this.value)"
              class="w-32 px-2 py-1 border border-slate-300 rounded text-right text-xs font-bold">
          </div>

          <div class="flex justify-between items-center text-sm font-bold text-slate-900 py-1">
            <span>Net Payable Amount:</span>
            <span id="calc-net-payable">${f.netPayableAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div class="flex justify-between items-center text-xs py-1">
            <span class="text-slate-600 font-medium">Previous Due Amount:</span>
            <input type="number" step="any" min="0" value="${f.previousDueAmount}" oninput="updateFormMeta('previousDueAmount', this.value)"
              class="w-32 px-2 py-1 border border-slate-300 rounded text-right text-xs font-bold">
          </div>

          <div class="flex justify-between items-center text-sm font-bold text-slate-900 py-1 border-b border-slate-200 pb-2">
            <span>Total Due Amount:</span>
            <span id="calc-total-due">${f.totalDueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div class="flex justify-between items-center text-xs py-1">
            <span class="text-slate-600 font-medium">Received Amount:</span>
            <input type="number" step="any" min="0" value="${f.receivedAmount}" oninput="updateFormMeta('receivedAmount', this.value)"
              class="w-32 px-2 py-1 border border-emerald-400 bg-emerald-50 rounded text-right text-xs font-bold text-emerald-800">
          </div>

          <div class="flex justify-between items-center text-base font-extrabold text-blue-900 pt-2 border-t-2 border-slate-300">
            <span>Closing Balance:</span>
            <span id="calc-closing-balance" class="text-lg">TK ${f.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <!-- Bottom Submission -->
      <div class="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
        <button onclick="switchTab('invoices')" class="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition">
          Discard
        </button>
        <button onclick="saveInvoice()" class="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md text-sm transition flex items-center gap-2">
          <span>💾</span> Save & Preview Bill
        </button>
      </div>
    </div>
  `;
}

// Invoice preview and print view
function viewInvoice(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;
  state.currentInvoice = inv;
  state.activeTab = 'view-invoice';
  renderApp();
}

function renderViewInvoiceTab() {
  const inv = state.currentInvoice;
  if (!inv) return `<div class="text-center py-12">Invoice not selected. <button onclick="switchTab('invoices')" class="text-blue-600 underline">Go to invoices</button></div>`;

  // Always resolve the latest live company profile from state.companies
  const targetCompanyId = inv.companyId || (inv.company && inv.company.id);
  const liveComp = targetCompanyId ? (state.companies && state.companies.find(c => c.id === targetCompanyId)) : null;
  const defaultComp = (state.companies && state.companies.find(c => c.isDefault)) || (state.companies && state.companies[0]) || state.settings || {};
  const comp = liveComp || inv.company || defaultComp;

  const companyLogo = comp.logo || (inv.company && inv.company.logo) || window.BRAND_LOGO || '/logo.png';
  const companyName = comp.name || (inv.company && inv.company.name) || state.settings.companyName || 'master technology';
  const companyAddress = comp.address || (inv.company && inv.company.address) || state.settings.address || '80, Laboratory Road, New Elephant Road Delowar Bhaban (Gr.Flr.) Dhaka-1205';
  const companyPhone = comp.phone || (inv.company && inv.company.phone) || state.settings.phone || '01958-444381';
  const companyEmail = comp.email || (inv.company && inv.company.email) || state.settings.email || 'secgadgets@gmail.com';
  const companyTerms = inv.termsNotice || comp.termsNotice || 'Thank you for with us after 3 working days sold products are non exchangable and non refundable';

  return `
    <div class="space-y-6">
      <!-- Toolbar (Hidden in Print) -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div class="flex items-center gap-2">
          <button onclick="switchTab('invoices')" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5">
            &larr; Back to Invoices
          </button>
          <span class="text-slate-400">|</span>
          <span class="font-bold text-slate-800 text-sm">Invoice: ${inv.invoiceNo}</span>
        </div>

        <div class="flex items-center gap-3">
          ${can('invoices.edit') ? `
            <button onclick="editInvoice('${inv.id}')" 
              class="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5">
              ✏️ Edit Bill
            </button>
          ` : ''}
          ${can('invoices.delete') ? `
            <button onclick="deleteInvoice('${inv.id}')" 
              class="px-3.5 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg text-xs transition flex items-center gap-1.5">
              🗑️ Move to Trash
            </button>
          ` : ''}
          ${can('invoices.print_pdf') ? `
            <button onclick="downloadInvoicePDF()" 
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm text-xs transition flex items-center gap-1.5">
              📥 Download PDF File
            </button>
            <button onclick="window.print()" 
              class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm text-xs transition flex items-center gap-1.5">
              🖨️ Print Bill
            </button>
          ` : ''}
        </div>
      </div>

      <!-- User Tracking & Audit Info (Print-Hidden) -->
      <div class="bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between text-xs text-slate-600 print:hidden gap-3 max-w-4xl mx-auto">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-slate-800">🏢 Company:</span>
            <span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
              ${companyName}
            </span>
          </div>
          <span class="text-slate-300">|</span>
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-slate-800">👤 Created By:</span>
            <span class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
              ${inv.createdBy ? `${inv.createdBy.name} (@${inv.createdBy.username})` : (inv.soldBy || 'System')}
            </span>
            <span class="text-slate-400">•</span>
            <span class="text-slate-500">${inv.createdAt ? new Date(inv.createdAt).toLocaleString() : (inv.date + ' ' + (inv.time || ''))}</span>
          </div>
        </div>
        ${inv.updatedBy ? `
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-800">✏️ Last Updated By:</span>
            <span class="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
              ${inv.updatedBy.name} (@${inv.updatedBy.username})
            </span>
            <span class="text-slate-400">•</span>
            <span class="text-slate-500">${new Date(inv.updatedAt).toLocaleString()}</span>
          </div>
        ` : ''}
      </div>

      <!-- The A4 Bill Paper Container (Exact Layout from Reference PDF) -->
      <div id="invoice-print-area" class="flex justify-center">
        <div class="invoice-paper" id="invoice-sheet">
          <!-- Top & Table Content Wrapper -->
          <div class="invoice-body-content">
            <!-- Company Header with Logo & Details -->
            <div class="text-center pb-1">
              <!-- Brand Logo (High Resolution Base64 PNG from Selected Company Profile) -->
              <div style="text-align: center; margin-bottom: 2px;">
                <img id="invoice-brand-logo" src="${companyLogo}" alt="${companyName}" style="height: 50px; width: auto; max-width: 310px; object-fit: contain; margin: 0 auto; display: block;">
              </div>
              <!-- Address and Contacts -->
              <div class="text-[11.5px] font-medium text-black">
                Address: ${companyAddress}
              </div>
              <div class="text-[11.5px] font-medium text-black mt-0.5">
                Phone: ${companyPhone}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;E-mail: ${companyEmail}
              </div>
            </div>

            <!-- Invoice / Bill Banner -->
            <div class="invoice-header-title">
              Invoice/ Bill
            </div>

            <!-- Metadata Grid -->
            <div class="grid grid-cols-2 gap-x-6 text-[12px] mb-2.5 leading-snug">
              <!-- Left Info -->
              <div class="space-y-1">
                <div class="flex">
                  <span class="w-32 font-bold">Sales Order No:</span>
                  <span class="font-normal">${inv.salesOrderNo || ''}</span>
                </div>
                <div class="flex">
                  <span class="w-32 font-bold">Invoice No:</span>
                  <span class="font-normal">${inv.invoiceNo || ''}</span>
                </div>
                <div class="flex">
                  <span class="w-32 font-bold">Buyer Name:</span>
                  <span class="font-bold">${inv.buyerName || ''}</span>
                </div>
                <div class="flex">
                  <span class="w-32 font-bold">Buyer Address:</span>
                  <span class="font-normal">${inv.buyerAddress || ''}</span>
                </div>
              </div>

              <!-- Right Info -->
              <div class="space-y-1 pl-4">
                <div class="flex">
                  <span class="w-24 font-bold">Date:</span>
                  <span class="font-normal">${inv.date || ''}</span>
                </div>
                <div class="flex">
                  <span class="w-24 font-bold">Time:</span>
                  <span class="font-normal">${inv.time || ''}</span>
                </div>
                <div class="flex">
                  <span class="w-24 font-bold">Sold By:</span>
                  <span class="font-normal">${inv.soldBy || ''}</span>
                </div>
                <div class="flex">
                  <span class="w-24 font-bold">Zone:</span>
                  <span class="font-normal">${inv.zone || ''}</span>
                </div>
              </div>
            </div>

            <!-- Unified Single Table (Items + Summary - Perfectly Aligned Vertical Borders) -->
            <table class="invoice-table">
              <colgroup>
                <col style="width: 48px;">
                <col style="width: auto;">
                <col style="width: 86px;">
                <col style="width: 64px;">
                <col style="width: 148px;">
                <col style="width: 98px;">
              </colgroup>
              <thead>
                <tr>
                  <th style="text-align: center;">SL NO.</th>
                  <th style="text-align: left; padding-left: 10px;">Product Discription</th>
                  <th style="text-align: center;">Warranty</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right; padding-right: 8px;">Unit Price</th>
                  <th style="text-align: right; padding-right: 8px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${(inv.items || []).map((item, i) => `
                  <tr>
                    <td style="text-align: center; font-weight: 500;">${item.sl || (i + 1)}</td>
                    <td style="font-weight: 600; padding-left: 10px;">${item.description || ''}</td>
                    <td style="text-align: center;">${item.warranty || ''}</td>
                    <td style="text-align: center; font-weight: 600;">${item.quantity || 1}</td>
                    <td style="text-align: right; padding-right: 8px;">${Number(item.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style="text-align: right; font-weight: 600; padding-right: 8px;">${Number(item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}

                <!-- Padding rows to maintain exact standard table height -->
                ${Array.from({ length: Math.max(0, 5 - (inv.items ? inv.items.length : 0)) }).map(() => `
                  <tr>
                    <td style="text-align: center; color: transparent;">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                `).join('')}

                <!-- Financial Calculation & Guarantee Rows inside the exact same table -->
                <tr>
                  <td colspan="4" rowspan="9" style="vertical-align: middle; text-align: center; padding: 24px 20px; font-weight: 700; font-size: 13px; line-height: 1.45;">
                    ${companyTerms}
                  </td>
                  <td style="font-weight: 700; padding-left: 8px;">Total Amount</td>
                  <td style="text-align: right; font-weight: 600; padding-right: 8px;">${Number(inv.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; padding-left: 8px;">Less Discount</td>
                  <td style="text-align: right; padding-right: 8px;">${Number(inv.lessDiscount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; padding-left: 8px;">Add VAT</td>
                  <td style="text-align: right; padding-right: 8px;">${Number(inv.addVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; padding-left: 8px;">Add AIT</td>
                  <td style="text-align: right; padding-right: 8px;">${Number(inv.addAit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; padding-left: 8px;">Add Extra Charges</td>
                  <td style="text-align: right; padding-right: 8px;">${Number(inv.addExtraCharges || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; padding-left: 8px;">Net Payable Amount</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 8px;">${Number(inv.netPayableAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; padding-left: 8px;">Previous Due Amount</td>
                  <td style="text-align: right; padding-right: 8px;">${Number(inv.previousDueAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; padding-left: 8px;">Total Due Amount</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 8px;">${Number(inv.totalDueAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700; padding-left: 8px;">Received Amount</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 8px;">${Number(inv.receivedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <!-- Taka in Words & Closing Balance -->
                <tr>
                  <td colspan="4" style="font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 5px 8px;">
                    TAKA IN WORD: ${inv.takaInWords || ''}
                  </td>
                  <td style="font-weight: 800; font-size: 12.5px; padding-left: 8px;">Closing Balance</td>
                  <td style="text-align: right; font-weight: 800; font-size: 12.5px; padding-right: 8px;">${Number(inv.closingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer Signatures anchored at very bottom of page -->
          <div class="invoice-signatures-footer">
            <div class="text-center">
              <div class="signature-line">Signature of Customer</div>
            </div>
            <div class="text-center">
              <div class="signature-line">Authorised By</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

// PDF export
function downloadInvoicePDF() {
  const element = document.getElementById('invoice-sheet');
  if (!element) {
    showToast('Invoice element not found', 'error');
    return;
  }

  const invoiceNo = (state.currentInvoice && state.currentInvoice.invoiceNo) 
    ? state.currentInvoice.invoiceNo.replace(/[^a-zA-Z0-9_-]/g, '_') 
    : 'Invoice';

  showToast('Generating high-resolution PDF file...', 'info');

  const opt = {
    margin: 0,
    filename: `Invoice_${invoiceNo}.pdf`,
    image: { type: 'jpeg', quality: 1.0 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      allowTaint: true,
      backgroundColor: '#ffffff',
      scrollY: 0,
      scrollX: 0,
      logging: false 
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (window.html2pdf) {
    window.html2pdf().set(opt).from(element).save().then(() => {
      showToast('PDF downloaded successfully!');
    }).catch(err => {
      console.error('PDF error, falling back to print:', err);
      window.print();
    });
  } else {
    window.print();
  }
}

async function deleteInvoice(id) {
  if (!confirm('Move this bill to the Trash Box? You can restore it anytime from the Trash Box.')) return;
  try {
    const res = await api(`/api/invoices/${id}`, 'DELETE');
    showToast(res.message || 'Invoice moved to Trash Box');
    state.invoices = await api('/api/invoices');
    state.trash = await api('/api/trash');
    state.stats = await api('/api/stats');
    switchTab('invoices');
  } catch (err) {
    console.error('Delete invoice error:', err);
  }
}

// Products inventory view
function renderProductsTab() {
  return `
    <div class="space-y-6">
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900">Product & Inventory Catalog</h2>
          <p class="text-xs text-slate-500 mt-1">Pre-saved products can be quickly selected while creating invoices.</p>
        </div>
        ${can('products.create') ? `
          <button onclick="openAddProductModal()" 
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm shadow-sm transition flex items-center gap-1.5">
            <span>➕</span> Add Product
          </button>
        ` : ''}
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
            <tr>
              <th class="px-6 py-3.5">Product Name</th>
              <th class="px-6 py-3.5">Category</th>
              <th class="px-6 py-3.5">Default Warranty</th>
              <th class="px-6 py-3.5 text-right">Standard Price</th>
              <th class="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${state.products.map(p => `
              <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 font-bold text-slate-900">${p.name}</td>
                <td class="px-6 py-4"><span class="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">${p.category || 'General'}</span></td>
                <td class="px-6 py-4 font-medium text-slate-600">${p.warranty || '-'}</td>
                <td class="px-6 py-4 text-right font-bold text-blue-700">TK ${Number(p.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td class="px-6 py-4 text-right">
                  ${can('products.delete') ? `
                    <button onclick="deleteProduct('${p.id}')" class="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openAddProductModal() {
  const modalHtml = `
    <div id="product-modal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <h3 class="text-lg font-bold text-slate-900">Add New Product</h3>
        <form onsubmit="event.preventDefault(); submitAddProduct();" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Product Description / Name *</label>
            <input type="text" id="new-prod-name" required placeholder="e.g. DAHUA 2MP Bullet Camera" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
            <input type="text" id="new-prod-cat" placeholder="e.g. Camera, Storage, Accessories" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Warranty Term</label>
            <input type="text" id="new-prod-warranty" placeholder="e.g. 01 YEAR / 06 MONTHS" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Standard Unit Price (TK) *</label>
            <input type="number" id="new-prod-price" required step="any" min="0" placeholder="e.g. 1600" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="flex justify-end gap-3 pt-3">
            <button type="button" onclick="document.getElementById('product-modal').remove()" class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm">Save Product</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitAddProduct() {
  const name = document.getElementById('new-prod-name').value;
  const category = document.getElementById('new-prod-cat').value;
  const warranty = document.getElementById('new-prod-warranty').value;
  const unitPrice = document.getElementById('new-prod-price').value;

  try {
    await api('/api/products', 'POST', { name, category, warranty, unitPrice });
    showToast('Product added successfully!');
    document.getElementById('product-modal').remove();
    state.products = await api('/api/products');
    renderApp();
  } catch (err) {
    console.error('Add product error:', err);
  }
}

async function deleteProduct(id) {
  if (!confirm('Move this product to the Trash Box? You can restore it anytime from the Trash Box.')) return;
  try {
    const res = await api(`/api/products/${id}`, 'DELETE');
    showToast(res.message || 'Product moved to Trash Box');
    state.products = await api('/api/products');
    state.trash = await api('/api/trash');
    state.stats = await api('/api/stats');
    renderApp();
  } catch (err) {
    console.error('Delete product error:', err);
  }
}

// User and access management
function switchUserSubTab(subTab) {
  state.userSubTab = subTab;
  renderApp();
}

function renderUsersTab() {
  const isRolesTab = state.userSubTab === 'roles';
  const canManageUsers = can('users.manage');
  const canManageRoles = can('roles.manage');

  return `
    <div class="space-y-6">
      <!-- Top Sub-Navigation Tabs -->
      <div class="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center space-x-2">
          <button onclick="switchUserSubTab('users')" 
            class="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${!isRolesTab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
            <span>👥</span> User Accounts (${state.users.length})
          </button>
          <button onclick="switchUserSubTab('roles')" 
            class="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${isRolesTab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
            <span>🛡️</span> Roles & Permission Matrix (${state.roles.length})
          </button>
        </div>

        <div>
          ${!isRolesTab ? (canManageUsers ? `
            <button onclick="openAddUserModal()" 
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-sm transition flex items-center gap-1.5">
              <span>👤➕</span> Create New User
            </button>
          ` : '') : (canManageRoles ? `
            <button onclick="openCreateRoleModal()" 
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-sm transition flex items-center gap-1.5">
              <span>🛡️➕</span> Create Custom Role
            </button>
          ` : '')}
        </div>
      </div>

      ${!isRolesTab ? renderUsersListView() : renderRolesMatrixView()}
    </div>
  `;
}

function renderUsersListView() {
  const canManageUsers = can('users.manage');

  return `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div>
          <h3 class="font-bold text-slate-800 text-sm">System Users & Authentication</h3>
          <p class="text-[11px] text-slate-500">All registered system users, their current status, and assigned dynamic roles.</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
            <tr>
              <th class="px-6 py-3.5">User</th>
              <th class="px-6 py-3.5">Email</th>
              <th class="px-6 py-3.5">Assigned Role</th>
              <th class="px-6 py-3.5 text-center">Status</th>
              <th class="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${state.users.map(u => {
              const roleObj = state.roles.find(r => r.id === u.role || r.id === `role-${u.role}` || r.name.toLowerCase() === (u.role || '').toLowerCase());
              const roleName = roleObj ? roleObj.name : (u.roleName || u.role);
              const isRoleAdmin = u.role === 'admin' || u.role === 'role-admin';
              const roleBadge = isRoleAdmin 
                ? 'bg-amber-100 text-amber-800 border-amber-300' 
                : (u.role === 'sales' || u.role === 'role-sales' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-indigo-50 text-indigo-700 border-indigo-200');
              const statusBadge = u.status === 'active' 
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                : 'bg-red-100 text-red-800 border-red-300';

              return `
                <tr class="hover:bg-slate-50 transition">
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-900">${u.name}</div>
                    <div class="text-xs text-slate-500">@${u.username}</div>
                  </td>
                  <td class="px-6 py-4 text-xs font-medium text-slate-600">${u.email || '-'}</td>
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${roleBadge}">
                      ${isRoleAdmin ? '👑' : '🛡️'} ${roleName}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${statusBadge}">${u.status}</span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      ${canManageUsers ? `
                        <button onclick="openEditUserModal('${u.id}')" class="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition">
                          Edit
                        </button>
                      ` : ''}
                      ${canManageUsers && u.id !== state.user.id ? `
                        <button onclick="deleteUser('${u.id}')" class="px-2.5 py-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition">
                          Delete
                        </button>
                      ` : ''}
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

function renderRolesMatrixView() {
  const canManageRoles = can('roles.manage');
  const roles = state.roles || [];
  const perms = state.availablePermissions || [];

  // Group permissions by group
  const groups = {};
  perms.forEach(p => {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  });

  return `
    <div class="space-y-6">
      <!-- Role Cards Overview -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${roles.map(r => {
          const isSystem = r.isSystem || r.id === 'role-admin';
          const isFullAccess = Array.isArray(r.permissions) && r.permissions.includes('*');
          const permCount = isFullAccess ? perms.length : (Array.isArray(r.permissions) ? r.permissions.length : 0);
          const usersWithRole = state.users.filter(u => 
            u.role === r.id || u.role === r.id.replace('role-', '') || u.role.toLowerCase() === r.name.toLowerCase()
          );

          return `
            <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="inline-flex items-center gap-1 font-bold text-slate-900 text-sm">
                    <span>${isFullAccess ? '👑' : '🛡️'}</span>
                    <span>${r.name}</span>
                  </span>
                  <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${isSystem ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}">
                    ${isSystem ? 'System' : 'Custom'}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2">${r.description || 'No description provided.'}</p>
              </div>

              <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div class="font-bold ${isFullAccess ? 'text-amber-700' : 'text-blue-700'}">
                    ${isFullAccess ? '⭐ Full Privileges (*)' : `${permCount} / ${perms.length} Permissions`}
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    👥 ${usersWithRole.length} ${usersWithRole.length === 1 ? 'user' : 'users'} assigned
                  </div>
                </div>

                <div class="flex items-center gap-1.5">
                  ${canManageRoles && r.id !== 'role-admin' ? `
                    <button onclick="openEditRoleModal('${r.id}')" title="Edit Permissions"
                      class="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition">
                      ✏️ Edit
                    </button>
                  ` : ''}
                  ${canManageRoles && !isSystem ? `
                    <button onclick="deleteRole('${r.id}')" title="Delete Custom Role"
                      class="px-2 py-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition">
                      🗑️
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Permission Matrix Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>📋</span> Granular Permissions Access Matrix
            </h3>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Live permission matrix showing exact system capabilities granted to each role.
            </p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-700">
            <thead class="bg-slate-100/80 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th class="px-5 py-3 min-w-[240px]">Module & Permission Capability</th>
                ${roles.map(r => `
                  <th class="px-3 py-3 text-center whitespace-nowrap min-w-[110px]">
                    <div class="font-bold text-slate-800">${r.name}</div>
                    <div class="text-[9px] text-slate-400 font-normal lowercase">${r.isSystem ? 'system' : 'custom'}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${Object.keys(groups).map(groupName => {
                const groupPerms = groups[groupName];
                return `
                  <!-- Group Header -->
                  <tr class="bg-slate-50/90 font-bold text-slate-800 text-xs">
                    <td colspan="${roles.length + 1}" class="px-5 py-2.5 uppercase tracking-wider text-[11px] text-blue-900 bg-blue-50/50 border-y border-blue-100">
                      ${groupName}
                    </td>
                  </tr>
                  ${groupPerms.map(p => `
                    <tr class="hover:bg-slate-50/80 transition">
                      <td class="px-5 py-3">
                        <div class="font-semibold text-slate-900">${p.name}</div>
                        <div class="text-[11px] text-slate-400">${p.description}</div>
                        <code class="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block font-mono">${p.id}</code>
                      </td>
                      ${roles.map(r => {
                        const hasPerm = (Array.isArray(r.permissions) && (r.permissions.includes('*') || r.permissions.includes(p.id)));
                        return `
                          <td class="px-3 py-3 text-center align-middle">
                            ${hasPerm ? `
                              <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-xs shadow-xs" title="Granted to ${r.name}">
                                ✓
                              </span>
                            ` : `
                              <span class="text-slate-300 font-bold text-sm">—</span>
                            `}
                          </td>
                        `;
                      }).join('')}
                    </tr>
                  `).join('')}
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function openAddUserModal() {
  const roleOptions = state.roles.map(r => `
    <option value="${r.id}">${r.name}</option>
  `).join('');

  const modalHtml = `
    <div id="user-modal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <h3 class="text-lg font-bold text-slate-900">Create New User Account</h3>
        <form onsubmit="event.preventDefault(); submitAddUser();" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
            <input type="text" id="new-user-name" required placeholder="e.g. Mostofa Kamal" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Username (Login ID) *</label>
            <input type="text" id="new-user-username" required placeholder="e.g. mostofa" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
            <input type="email" id="new-user-email" placeholder="e.g. user@secgadgets.com" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Password *</label>
            <input type="password" id="new-user-pass" required placeholder="Enter password" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Role *</label>
              <select id="new-user-role" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                ${roleOptions}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Status *</label>
              <select id="new-user-status" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-3 pt-3">
            <button type="button" onclick="document.getElementById('user-modal').remove()" class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm">Create Account</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitAddUser() {
  const name = document.getElementById('new-user-name').value;
  const username = document.getElementById('new-user-username').value;
  const email = document.getElementById('new-user-email').value;
  const password = document.getElementById('new-user-pass').value;
  const role = document.getElementById('new-user-role').value;
  const status = document.getElementById('new-user-status').value;

  try {
    await api('/api/users', 'POST', { name, username, email, password, role, status });
    showToast('New user created successfully!');
    document.getElementById('user-modal').remove();
    state.users = await api('/api/users');
    renderApp();
  } catch (err) {
    console.error('Create user error:', err);
  }
}

function openEditUserModal(id) {
  const u = state.users.find(user => user.id === id);
  if (!u) return;

  const roleOptions = state.roles.map(r => {
    const isSelected = u.role === r.id || u.role === r.id.replace('role-', '') || (u.roleName && u.roleName.toLowerCase() === r.name.toLowerCase()) || u.role === r.name;
    return `<option value="${r.id}" ${isSelected ? 'selected' : ''}>${r.name}</option>`;
  }).join('');

  const modalHtml = `
    <div id="user-modal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <h3 class="text-lg font-bold text-slate-900">Edit User: @${u.username}</h3>
        <form onsubmit="event.preventDefault(); submitEditUser('${u.id}');" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
            <input type="text" id="edit-user-name" value="${u.name}" required 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
            <input type="email" id="edit-user-email" value="${u.email || ''}" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Change Password (leave empty to keep current)</label>
            <input type="password" id="edit-user-pass" placeholder="Enter new password (optional)" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Role</label>
              <select id="edit-user-role" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                ${roleOptions}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Status</label>
              <select id="edit-user-status" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="active" ${u.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="inactive" ${u.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-3 pt-3">
            <button type="button" onclick="document.getElementById('user-modal').remove()" class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitEditUser(id) {
  const name = document.getElementById('edit-user-name').value;
  const email = document.getElementById('edit-user-email').value;
  const password = document.getElementById('edit-user-pass').value;
  const role = document.getElementById('edit-user-role').value;
  const status = document.getElementById('edit-user-status').value;

  try {
    const payload = { name, email, role, status };
    if (password && password.trim().length > 0) payload.password = password;

    await api(`/api/users/${id}`, 'PUT', payload);
    showToast('User updated successfully!');
    document.getElementById('user-modal').remove();
    state.users = await api('/api/users');
    renderApp();
  } catch (err) {
    console.error('Update user error:', err);
  }
}

async function deleteUser(id) {
  if (!confirm('Are you sure you want to remove this user account?')) return;
  try {
    await api(`/api/users/${id}`, 'DELETE');
    showToast('User removed');
    state.users = await api('/api/users');
    renderApp();
  } catch (err) {
    console.error('Delete user error:', err);
  }
}

// Role configuration modals
function openCreateRoleModal() {
  const perms = state.availablePermissions || [];
  const groups = {};
  perms.forEach(p => {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  });

  const modalHtml = `
    <div id="role-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🛡️</span> Create New Dynamic Role
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Define a role name and select granular system permissions.</p>
          </div>
          <button type="button" onclick="document.getElementById('role-modal').remove()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); submitCreateRole();" class="space-y-4 flex-1 overflow-y-auto pr-1">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Role Name *</label>
            <input type="text" id="new-role-name" required placeholder="e.g. Accounts Supervisor, Cashier, Auditor" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
            <input type="text" id="new-role-desc" placeholder="Brief summary of duties and permitted actions" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-bold text-slate-700 uppercase">Assigned Permissions</label>
              <div class="flex items-center gap-2">
                <button type="button" onclick="toggleAllRolePerms(true)" class="text-[11px] font-bold text-blue-600 hover:underline">Select All</button>
                <span class="text-slate-300">|</span>
                <button type="button" onclick="toggleAllRolePerms(false)" class="text-[11px] font-bold text-slate-500 hover:underline">Clear All</button>
              </div>
            </div>

            <div class="space-y-4">
              ${Object.keys(groups).map((groupName, gIdx) => `
                <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
                    <span class="font-bold text-xs text-slate-800">${groupName}</span>
                    <button type="button" onclick="toggleGroupPerms('group-${gIdx}', true)" class="text-[10px] text-blue-600 font-semibold hover:underline">Select Section</button>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 group-${gIdx}">
                    ${groups[groupName].map(p => `
                      <label class="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-300 cursor-pointer transition">
                        <input type="checkbox" name="role-perm-cb" value="${p.id}" class="mt-0.5 rounded text-blue-600 focus:ring-blue-500">
                        <div class="text-xs">
                          <div class="font-bold text-slate-800 leading-tight">${p.name}</div>
                          <div class="text-[10px] text-slate-400 mt-0.5 leading-tight">${p.description}</div>
                        </div>
                      </label>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-3 border-t border-slate-200 sticky bottom-0 bg-white py-2">
            <button type="button" onclick="document.getElementById('role-modal').remove()" class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm">Save Role</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openEditRoleModal(roleId) {
  const role = state.roles.find(r => r.id === roleId);
  if (!role) return;

  const perms = state.availablePermissions || [];
  const groups = {};
  perms.forEach(p => {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  });

  const rolePerms = Array.isArray(role.permissions) ? role.permissions : [];

  const modalHtml = `
    <div id="role-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>✏️</span> Edit Role: ${role.name}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Update role details and adjust assigned permissions.</p>
          </div>
          <button type="button" onclick="document.getElementById('role-modal').remove()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); submitEditRole('${role.id}');" class="space-y-4 flex-1 overflow-y-auto pr-1">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Role Name *</label>
            <input type="text" id="edit-role-name" value="${role.name}" required 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
            <input type="text" id="edit-role-desc" value="${role.description || ''}" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-bold text-slate-700 uppercase">Assigned Permissions</label>
              <div class="flex items-center gap-2">
                <button type="button" onclick="toggleAllRolePerms(true)" class="text-[11px] font-bold text-blue-600 hover:underline">Select All</button>
                <span class="text-slate-300">|</span>
                <button type="button" onclick="toggleAllRolePerms(false)" class="text-[11px] font-bold text-slate-500 hover:underline">Clear All</button>
              </div>
            </div>

            <div class="space-y-4">
              ${Object.keys(groups).map((groupName, gIdx) => `
                <div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
                    <span class="font-bold text-xs text-slate-800">${groupName}</span>
                    <button type="button" onclick="toggleGroupPerms('group-${gIdx}', true)" class="text-[10px] text-blue-600 font-semibold hover:underline">Select Section</button>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 group-${gIdx}">
                    ${groups[groupName].map(p => {
                      const isChecked = rolePerms.includes('*') || rolePerms.includes(p.id);
                      return `
                        <label class="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-300 cursor-pointer transition">
                          <input type="checkbox" name="role-perm-cb" value="${p.id}" ${isChecked ? 'checked' : ''} class="mt-0.5 rounded text-blue-600 focus:ring-blue-500">
                          <div class="text-xs">
                            <div class="font-bold text-slate-800 leading-tight">${p.name}</div>
                            <div class="text-[10px] text-slate-400 mt-0.5 leading-tight">${p.description}</div>
                          </div>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-3 border-t border-slate-200 sticky bottom-0 bg-white py-2">
            <button type="button" onclick="document.getElementById('role-modal').remove()" class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm">Save Permissions</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function toggleAllRolePerms(checked) {
  document.querySelectorAll('input[name="role-perm-cb"]').forEach(cb => {
    cb.checked = checked;
  });
}

function toggleGroupPerms(groupClass, checked) {
  document.querySelectorAll(`.${groupClass} input[name="role-perm-cb"]`).forEach(cb => {
    cb.checked = checked;
  });
}

async function submitCreateRole() {
  const name = document.getElementById('new-role-name').value;
  const description = document.getElementById('new-role-desc').value;
  const checkboxes = document.querySelectorAll('input[name="role-perm-cb"]:checked');
  const permissions = Array.from(checkboxes).map(cb => cb.value);

  try {
    const newRole = await api('/api/roles', 'POST', { name, description, permissions });
    showToast(`Role '${newRole.name}' created successfully!`);
    document.getElementById('role-modal').remove();
    const rolesRes = await api('/api/roles');
    state.roles = rolesRes.roles || [];
    renderApp();
  } catch (err) {
    console.error('Create role error:', err);
  }
}

async function submitEditRole(roleId) {
  const name = document.getElementById('edit-role-name').value;
  const description = document.getElementById('edit-role-desc').value;
  const checkboxes = document.querySelectorAll('input[name="role-perm-cb"]:checked');
  const permissions = Array.from(checkboxes).map(cb => cb.value);

  try {
    const updated = await api(`/api/roles/${roleId}`, 'PUT', { name, description, permissions });
    showToast(`Role '${updated.name}' updated successfully!`);
    document.getElementById('role-modal').remove();
    const rolesRes = await api('/api/roles');
    state.roles = rolesRes.roles || [];
    renderApp();
  } catch (err) {
    console.error('Update role error:', err);
  }
}

async function deleteRole(roleId) {
  const role = state.roles.find(r => r.id === roleId);
  const roleName = role ? role.name : 'role';
  if (!confirm(`Are you sure you want to permanently delete the custom role '${roleName}'?`)) return;

  try {
    const res = await api(`/api/roles/${roleId}`, 'DELETE');
    showToast(res.message || `Role '${roleName}' deleted`);
    const rolesRes = await api('/api/roles');
    state.roles = rolesRes.roles || [];
    renderApp();
  } catch (err) {
    console.error('Delete role error:', err);
  }
}

// Settings and company branding
function renderSettingsTab() {
  const s = state.settings || {};
  const companies = state.companies || [];

  return `
    <div class="max-w-5xl mx-auto space-y-8">
      <!-- Section 1: Company Profiles & Multi-Brand Management -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>🏢</span> Company Profiles & Brand Logos
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              Add multiple companies with custom logos, invoice numbering prefixes, and addresses. Selected company information is automatically reflected on bills and PDFs.
            </p>
          </div>
          ${(can('companies.manage') || can('settings.edit')) ? `
            <button onclick="openAddCompanyModal()" 
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm text-xs transition flex items-center gap-1.5 shrink-0">
              <span>➕</span> Add New Company
            </button>
          ` : ''}
        </div>

        <!-- Companies List Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${companies.map(comp => {
            const isDefault = Boolean(comp.isDefault);
            const logoSrc = comp.logo || window.BRAND_LOGO || '/logo.png';
            return `
              <div class="border ${isDefault ? 'border-blue-400 bg-gradient-to-br from-blue-50/50 to-white ring-2 ring-blue-500/20' : 'border-slate-200 bg-white'} rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition hover:shadow-md">
                <div class="space-y-3">
                  <!-- Card Header: Logo & Status Badge -->
                  <div class="flex items-start justify-between gap-3">
                    <div class="h-14 w-40 bg-white border border-slate-200 rounded-lg p-1.5 flex items-center justify-center shadow-xs">
                      <img src="${logoSrc}" alt="${comp.name}" class="max-h-full max-w-full object-contain">
                    </div>
                    <div>
                      ${isDefault ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold">
                          <span>⭐</span> Default Company
                        </span>
                      ` : `
                        <span class="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[11px] font-semibold">
                          Secondary Brand
                        </span>
                      `}
                    </div>
                  </div>

                  <!-- Name and Details -->
                  <div>
                    <h3 class="text-base font-bold text-slate-900">${comp.name}</h3>
                    ${comp.tagline ? `<div class="text-xs text-blue-600 font-medium">${comp.tagline}</div>` : ''}
                  </div>

                  <div class="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div class="flex items-start gap-1">
                      <span class="font-semibold text-slate-700 min-w-14">Address:</span>
                      <span class="text-slate-600">${comp.address || 'Not specified'}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="font-semibold text-slate-700 min-w-14">Phone:</span>
                      <span class="text-slate-600">${comp.phone || 'Not specified'}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="font-semibold text-slate-700 min-w-14">Email:</span>
                      <span class="text-slate-600">${comp.email || 'Not specified'}</span>
                    </div>
                    <div class="flex items-center gap-2 pt-1 border-t border-slate-200/60 mt-1">
                      <span class="font-semibold text-slate-700">Prefixes:</span>
                      <span class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold">${comp.invoicePrefix || 'INV-'}</span>
                      <span class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold">${comp.salesOrderPrefix || 'SO-'}</span>
                    </div>
                  </div>
                </div>

                <!-- Card Actions -->
                <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    ${!isDefault && (can('companies.manage') || can('settings.edit')) ? `
                      <button onclick="setDefaultCompany('${comp.id}')" 
                        class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1">
                        <span>⭐</span> Set Default
                      </button>
                    ` : ''}
                  </div>
                  <div class="flex items-center gap-2">
                    ${(can('companies.manage') || can('settings.edit')) ? `
                      <button onclick="openEditCompanyModal('${comp.id}')" 
                        class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                        <span>✏️</span> Edit & Logo
                      </button>
                    ` : ''}
                    ${!isDefault && companies.length > 1 && (can('companies.manage') || can('settings.edit')) ? `
                      <button onclick="deleteCompany('${comp.id}')" 
                        class="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition" title="Delete Company">
                        🗑️
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Section 2: Global Fallback & Preferences -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900">General Billing Preferences</h2>
          <p class="text-xs text-slate-500 mt-1">Configure default terms notice and salesperson names for invoices.</p>
        </div>

        <form onsubmit="event.preventDefault(); submitSettings();" class="space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Default Salesperson Name</label>
              <input type="text" id="set-default-soldby" value="${s.defaultSoldBy || 'Tarek'}" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Standard Invoice Prefix</label>
              <input type="text" id="set-inv-prefix" value="${s.invoicePrefix || 'INV-ehs-'}" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Standard Terms & Non-Refundable Notice</label>
            <textarea id="set-terms" rows="3" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500">${s.termsNotice || 'Thank you for with us after 3 working days sold products are non exchangable and non refundable'}</textarea>
          </div>

          <div class="flex justify-end pt-4 border-t border-slate-200">
            <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm text-sm transition">
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Company profile actions
function handleLogoFileSelect(event, previewId, containerId) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file (PNG, JPG, SVG, WebP)', 'warning');
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    showToast('Logo file size must be less than 4MB', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    window._tempCompanyLogo = dataUrl;
    const previewEl = document.getElementById(previewId);
    const containerEl = document.getElementById(containerId);
    if (previewEl) {
      previewEl.src = dataUrl;
    }
    if (containerEl) {
      containerEl.classList.remove('hidden');
    }
    showToast('Logo loaded successfully! Click Save to apply.', 'info');
  };
  reader.readAsDataURL(file);
}

function clearLogoSelection(previewId, containerId, fileInputId) {
  window._tempCompanyLogo = '';
  const previewEl = document.getElementById(previewId);
  const containerEl = document.getElementById(containerId);
  const fileInput = document.getElementById(fileInputId);
  if (previewEl) previewEl.src = '';
  if (containerEl) containerEl.classList.add('hidden');
  if (fileInput) fileInput.value = '';
}

function openAddCompanyModal() {
  window._tempCompanyLogo = '';
  const modalHtml = `
    <div id="company-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🏢</span> Add New Company Profile
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Create a company brand with custom logo and billing information.</p>
          </div>
          <button type="button" onclick="document.getElementById('company-modal').remove()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); submitAddCompany();" class="space-y-4 flex-1 overflow-y-auto pr-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Company Name *</label>
              <input type="text" id="add-comp-name" required placeholder="e.g. Win Trade International" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Tagline / Slogan</label>
              <input type="text" id="add-comp-tagline" placeholder="e.g. Importer & Distributor" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Office / Store Address</label>
            <input type="text" id="add-comp-address" placeholder="e.g. 80, Laboratory Road, New Elephant Road, Dhaka" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number(s)</label>
              <input type="text" id="add-comp-phone" placeholder="e.g. 01958-444381, 01711-223344" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
              <input type="email" id="add-comp-email" placeholder="e.g. info@company.com" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Invoice Number Prefix</label>
              <input type="text" id="add-comp-inv-prefix" placeholder="e.g. WTI- or INV-" value="INV-" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Sales Order Prefix</label>
              <input type="text" id="add-comp-so-prefix" placeholder="e.g. SO-WTI_ or SO-" value="SO-" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <!-- Brand Logo Upload Section -->
          <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
            <label class="block text-xs font-bold text-slate-700 uppercase">
              Brand Logo (For Bills & PDF Header)
            </label>

            <!-- File Input & Dropzone -->
            <div class="flex flex-col sm:flex-row items-center gap-3">
              <label class="cursor-pointer px-4 py-2.5 bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-xs font-bold text-slate-700 hover:text-blue-600 transition shadow-xs flex items-center gap-2">
                <span>📁</span> Upload Brand Logo (Image File)
                <input type="file" id="add-comp-file-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" 
                  onchange="handleLogoFileSelect(event, 'add-comp-logo-preview', 'add-comp-logo-box')">
              </label>
              <span class="text-[11px] text-slate-400">PNG, JPG, WebP or SVG (High-res transparent PNG recommended)</span>
            </div>

            <!-- Live Logo Preview Box -->
            <div id="add-comp-logo-box" class="hidden p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <span class="text-xs text-slate-500 font-semibold">Logo Preview:</span>
                <div class="h-12 w-48 bg-slate-50 border border-slate-100 rounded flex items-center justify-center p-1">
                  <img id="add-comp-logo-preview" src="" alt="Uploaded Logo" class="max-h-full max-w-full object-contain">
                </div>
              </div>
              <button type="button" onclick="clearLogoSelection('add-comp-logo-preview', 'add-comp-logo-box', 'add-comp-file-input')" 
                class="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 bg-red-50 rounded">
                Remove Logo
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Terms Notice & Guarantee Policy</label>
            <textarea id="add-comp-terms" rows="2" placeholder="Non-exchangeable after 3 working days..." 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500">Thank you for with us after 3 working days sold products are non exchangable and non refundable</textarea>
          </div>

          <div class="pt-1">
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="add-comp-default" class="rounded text-blue-600 focus:ring-blue-500">
              <span class="text-xs font-bold text-slate-800">Set as Default Billing Company</span>
            </label>
          </div>

          <div class="flex justify-end gap-3 pt-3 border-t border-slate-200 sticky bottom-0 bg-white py-2">
            <button type="button" onclick="document.getElementById('company-modal').remove()" class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm">Save Company</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openEditCompanyModal(companyId) {
  const comp = state.companies.find(c => c.id === companyId);
  if (!comp) return;

  window._tempCompanyLogo = comp.logo || '';
  const modalHtml = `
    <div id="company-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>✏️</span> Edit Company: ${comp.name}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Update company branding, logo, and contact info.</p>
          </div>
          <button type="button" onclick="document.getElementById('company-modal').remove()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); submitEditCompany('${comp.id}');" class="space-y-4 flex-1 overflow-y-auto pr-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Company Name *</label>
              <input type="text" id="edit-comp-name" required value="${comp.name}" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Tagline / Slogan</label>
              <input type="text" id="edit-comp-tagline" value="${comp.tagline || ''}" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Office / Store Address</label>
            <input type="text" id="edit-comp-address" value="${comp.address || ''}" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number(s)</label>
              <input type="text" id="edit-comp-phone" value="${comp.phone || ''}" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
              <input type="email" id="edit-comp-email" value="${comp.email || ''}" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Invoice Number Prefix</label>
              <input type="text" id="edit-comp-inv-prefix" value="${comp.invoicePrefix || 'INV-'}" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Sales Order Prefix</label>
              <input type="text" id="edit-comp-so-prefix" value="${comp.salesOrderPrefix || 'SO-'}" 
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <!-- Brand Logo Upload Section -->
          <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
            <label class="block text-xs font-bold text-slate-700 uppercase">
              Brand Logo (Current Logo or Upload New Image)
            </label>

            <!-- File Input -->
            <div class="flex flex-col sm:flex-row items-center gap-3">
              <label class="cursor-pointer px-4 py-2.5 bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-xs font-bold text-slate-700 hover:text-blue-600 transition shadow-xs flex items-center gap-2">
                <span>📁</span> Upload New Brand Logo
                <input type="file" id="edit-comp-file-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" 
                  onchange="handleLogoFileSelect(event, 'edit-comp-logo-preview', 'edit-comp-logo-box')">
              </label>
              <span class="text-[11px] text-slate-400">Select file to replace current logo</span>
            </div>

            <!-- Live Logo Preview Box -->
            <div id="edit-comp-logo-box" class="${comp.logo ? '' : 'hidden'} p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <span class="text-xs text-slate-500 font-semibold">Active Logo:</span>
                <div class="h-12 w-48 bg-slate-50 border border-slate-100 rounded flex items-center justify-center p-1">
                  <img id="edit-comp-logo-preview" src="${comp.logo || ''}" alt="Logo" class="max-h-full max-w-full object-contain">
                </div>
              </div>
              <button type="button" onclick="clearLogoSelection('edit-comp-logo-preview', 'edit-comp-logo-box', 'edit-comp-file-input')" 
                class="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 bg-red-50 rounded">
                Clear Logo
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Terms Notice & Guarantee Policy</label>
            <textarea id="edit-comp-terms" rows="2" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500">${comp.termsNotice || ''}</textarea>
          </div>

          <div class="pt-1">
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="edit-comp-default" ${comp.isDefault ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500">
              <span class="text-xs font-bold text-slate-800">Set as Default Billing Company</span>
            </label>
          </div>

          <div class="flex justify-end gap-3 pt-3 border-t border-slate-200 sticky bottom-0 bg-white py-2">
            <button type="button" onclick="document.getElementById('company-modal').remove()" class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm">Update Profile</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitAddCompany() {
  const name = document.getElementById('add-comp-name').value;
  const tagline = document.getElementById('add-comp-tagline').value;
  const address = document.getElementById('add-comp-address').value;
  const phone = document.getElementById('add-comp-phone').value;
  const email = document.getElementById('add-comp-email').value;
  const invoicePrefix = document.getElementById('add-comp-inv-prefix').value;
  const salesOrderPrefix = document.getElementById('add-comp-so-prefix').value;
  const termsNotice = document.getElementById('add-comp-terms').value;
  const isDefault = document.getElementById('add-comp-default').checked;
  const logo = window._tempCompanyLogo || '';

  try {
    const created = await api('/api/companies', 'POST', {
      name, tagline, address, phone, email, invoicePrefix, salesOrderPrefix, termsNotice, logo, isDefault
    });
    showToast(`Company '${created.name}' created successfully!`);
    const modal = document.getElementById('company-modal');
    if (modal) modal.remove();
    state.companies = await api('/api/companies');
    state.settings = await api('/api/settings');
    renderApp();
  } catch (err) {
    console.error('Add company error:', err);
  }
}

async function submitEditCompany(companyId) {
  const name = document.getElementById('edit-comp-name').value;
  const tagline = document.getElementById('edit-comp-tagline').value;
  const address = document.getElementById('edit-comp-address').value;
  const phone = document.getElementById('edit-comp-phone').value;
  const email = document.getElementById('edit-comp-email').value;
  const invoicePrefix = document.getElementById('edit-comp-inv-prefix').value;
  const salesOrderPrefix = document.getElementById('edit-comp-so-prefix').value;
  const termsNotice = document.getElementById('edit-comp-terms').value;
  const isDefault = document.getElementById('edit-comp-default').checked;
  const logo = window._tempCompanyLogo !== undefined ? window._tempCompanyLogo : undefined;

  try {
    const updated = await api(`/api/companies/${companyId}`, 'PUT', {
      name, tagline, address, phone, email, invoicePrefix, salesOrderPrefix, termsNotice, logo, isDefault
    });
    showToast(`Company '${updated.name}' updated successfully!`);
    const modal = document.getElementById('company-modal');
    if (modal) modal.remove();
    state.companies = await api('/api/companies');
    state.settings = await api('/api/settings');
    renderApp();
  } catch (err) {
    console.error('Edit company error:', err);
  }
}

async function setDefaultCompany(companyId) {
  try {
    const res = await api(`/api/companies/${companyId}/set-default`, 'POST');
    showToast(res.message || 'Default company updated');
    state.companies = await api('/api/companies');
    state.settings = await api('/api/settings');
    renderApp();
  } catch (err) {
    console.error('Set default company error:', err);
  }
}

async function deleteCompany(companyId) {
  const comp = state.companies.find(c => c.id === companyId);
  const name = comp ? comp.name : 'Company';
  if (!confirm(`Are you sure you want to delete company profile '${name}'?`)) return;

  try {
    const res = await api(`/api/companies/${companyId}`, 'DELETE');
    showToast(res.message || `Company '${name}' deleted`);
    state.companies = await api('/api/companies');
    state.settings = await api('/api/settings');
    renderApp();
  } catch (err) {
    console.error('Delete company error:', err);
  }
}

async function submitSettings() {
  const defaultSoldBy = document.getElementById('set-default-soldby').value;
  const invoicePrefix = document.getElementById('set-inv-prefix').value;
  const termsNotice = document.getElementById('set-terms').value;

  try {
    state.settings = await api('/api/settings', 'PUT', {
      defaultSoldBy, invoicePrefix, termsNotice
    });
    showToast('Billing preferences saved successfully!');
    renderApp();
  } catch (err) {
    console.error('Settings save error:', err);
  }
}

// Trash / recycle bin
function renderTrashTab() {
  const trash = state.trash || [];
  const invoicesInTrash = trash.filter(t => t.type === 'invoice');
  const productsInTrash = trash.filter(t => t.type === 'product');

  return `
    <div class="space-y-6">
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🗑️</span> Trash Box & Recycle Bin
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            Deleted bills and products are kept here safely. You can restore them back or permanently remove them.
          </p>
        </div>
        ${trash.length > 0 && can('trash.empty') ? `
          <button onclick="emptyTrash()" 
            class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
            <span>🧹</span> Empty Entire Trash
          </button>
        ` : ''}
      </div>

      <!-- Trash Items Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div class="text-xs font-bold uppercase text-slate-600 tracking-wider">
            All Deleted Items (${trash.length}) • Bills: ${invoicesInTrash.length} • Products: ${productsInTrash.length}
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-700">
            <thead class="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3.5">Item Type</th>
                <th class="px-6 py-3.5">Details</th>
                <th class="px-6 py-3.5">Deleted By</th>
                <th class="px-6 py-3.5">Deleted Date & Time</th>
                <th class="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${trash.length > 0 ? trash.map(item => `
                <tr class="hover:bg-slate-50 transition">
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${item.type === 'invoice' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}">
                      <span>${item.type === 'invoice' ? '🧾 Bill' : '📦 Product'}</span>
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-900">${item.itemTitle || '-'}</div>
                    <div class="text-xs text-slate-500">${item.itemSubtitle || ''}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-xs font-bold text-slate-800">${item.deletedBy ? item.deletedBy.name : 'Unknown'}</div>
                    <div class="text-[10px] text-slate-400">@${item.deletedBy ? item.deletedBy.username : 'user'}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                    ${new Date(item.deletedAt).toLocaleString()}
                  </td>
                  <td class="px-6 py-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-2">
                      ${can('trash.restore') ? `
                        <button onclick="restoreTrashItem('${item.trashId}')" title="Restore back to active list"
                          class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1">
                          <span>♻️</span> Restore
                        </button>
                      ` : ''}
                      ${can('trash.delete_permanent') ? `
                        <button onclick="deleteTrashItemPermanently('${item.trashId}')" title="Delete permanently"
                          class="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition">
                          ❌ Delete Forever
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5" class="px-6 py-12 text-center text-slate-400">
                    <div class="text-3xl mb-2">🎉</div>
                    <div class="font-semibold text-slate-600">Trash Box is clean and empty!</div>
                    <div class="text-xs text-slate-400 mt-1">Deleted bills and products will be saved here so you can restore them anytime.</div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function restoreTrashItem(trashId) {
  try {
    const res = await api('/api/trash/restore', 'POST', { trashId });
    showToast(res.message || 'Item restored successfully!');
    state.invoices = await api('/api/invoices');
    state.products = await api('/api/products');
    state.trash = await api('/api/trash');
    state.stats = await api('/api/stats');
    renderApp();
  } catch (err) {
    console.error('Restore error:', err);
  }
}

async function deleteTrashItemPermanently(trashId) {
  if (!confirm('Are you sure you want to PERMANENTLY delete this item? This action CANNOT be undone!')) return;
  try {
    const res = await api(`/api/trash/${trashId}`, 'DELETE');
    showToast(res.message || 'Item permanently deleted');
    state.trash = await api('/api/trash');
    state.stats = await api('/api/stats');
    renderApp();
  } catch (err) {
    console.error('Delete trash error:', err);
  }
}

async function emptyTrash() {
  if (!confirm('Are you sure you want to permanently clear all items in the Trash Box?')) return;
  try {
    await api('/api/trash', 'DELETE');
    showToast('Trash Box emptied');
    state.trash = await api('/api/trash');
    state.stats = await api('/api/stats');
    renderApp();
  } catch (err) {
    console.error('Empty trash error:', err);
  }
}

// Theme customizer engine

function initThemeDraft() {
  if (!state.themeDraft) {
    state.themeDraft = JSON.parse(JSON.stringify(state.theme || {}));
  }
  if (!state.themeDraft.login) state.themeDraft.login = {};
  if (!state.themeDraft.app) state.themeDraft.app = {};
  if (!state.themeDraft.invoice) state.themeDraft.invoice = {};
}

function updateThemeDraft(section, field, value) {
  initThemeDraft();
  if (!state.themeDraft[section]) state.themeDraft[section] = {};
  state.themeDraft[section][field] = value;
  updateThemeLivePreview();
}

function selectThemePreset(presetKey) {
  initThemeDraft();
  const preset = THEME_PRESETS[presetKey];
  if (!preset) return;
  state.themeDraft.login.preset = presetKey;
  state.themeDraft.login.bgGradient = preset.bg;
  state.themeDraft.login.headerGradient = preset.header;
  state.themeDraft.login.primaryColor = preset.primaryColor;
  state.themeDraft.login.primaryHover = preset.primaryHover;

  const colorInput = document.getElementById('theme-btn-color-input');
  if (colorInput) colorInput.value = preset.primaryColor;

  updateThemeLivePreview();

  // Highlight active preset button visually
  document.querySelectorAll('.theme-preset-btn').forEach(btn => {
    const isCurrent = btn.getAttribute('data-preset') === presetKey;
    btn.className = `theme-preset-btn p-3 rounded-xl border text-left transition flex items-center justify-between ${
      isCurrent 
        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 font-bold text-blue-900' 
        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
    }`;
  });
}

function handleThemeLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file (PNG, JPG, SVG, WebP)', 'warning');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size exceeds 5MB limit', 'warning');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    initThemeDraft();
    state.themeDraft.login.customLogo = e.target.result;
    updateThemeLivePreview();
    const previewImg = document.getElementById('theme-logo-preview-img');
    const container = document.getElementById('theme-logo-preview-box');
    if (previewImg && container) {
      previewImg.src = e.target.result;
      container.classList.remove('hidden');
    }
    showToast('Custom logo loaded into preview!', 'info');
  };
  reader.readAsDataURL(file);
}

function clearThemeLogo() {
  initThemeDraft();
  state.themeDraft.login.customLogo = '';
  const fileInput = document.getElementById('theme-logo-file-input');
  if (fileInput) fileInput.value = '';
  const container = document.getElementById('theme-logo-preview-box');
  if (container) container.classList.add('hidden');
  updateThemeLivePreview();
  showToast('Custom logo removed. Default system logo will be used.', 'info');
}

function updateThemeLivePreview() {
  const container = document.getElementById('theme-live-preview-box');
  if (!container) return;
  initThemeDraft();
  const cfg = getThemeLoginConfig(state.themeDraft);

  const isDarkGlass = cfg.cardStyle === 'dark-glass';
  const isGlass = cfg.cardStyle === 'glassmorphism';

  let cardClasses = 'bg-white shadow-xl border border-slate-100 text-slate-800';
  if (isDarkGlass) {
    cardClasses = 'dark-glass-card shadow-xl border border-white/10 text-white';
  } else if (isGlass) {
    cardClasses = 'glassmorphism-card shadow-xl border border-white/40 text-slate-800';
  }

  container.style.background = cfg.bgStyle;
  container.innerHTML = `
    <!-- Floating status badge -->
    <div class="absolute top-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/20 rounded-full text-[10px] text-white font-bold flex items-center gap-1.5 z-10 shadow-sm">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Live Interactive Preview
    </div>

    <div class="${cardClasses} ${cfg.cardRadius} w-full max-w-xs sm:max-w-sm overflow-hidden relative shadow-2xl transition-all duration-200">
      <!-- Card Header -->
      <div class="bg-gradient-to-r ${cfg.headerGradient} p-5 text-center text-white relative">
        ${cfg.showLogo ? `
          <div class="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-md mb-2 p-1.5 mx-auto">
            <img src="${cfg.logoUrl}" alt="Brand Logo" class="w-full h-full object-contain">
          </div>
        ` : ''}
        <h3 class="text-base font-bold tracking-tight">${escapeHtml(cfg.title)}</h3>
        <p class="text-[10px] text-blue-200 mt-0.5 uppercase tracking-widest font-semibold">${escapeHtml(cfg.subtitle)}</p>
      </div>

      <!-- Card Body -->
      <div class="p-5 space-y-3.5">
        ${cfg.welcomeMessage ? `
          <p class="text-[11px] ${isDarkGlass ? 'text-slate-300' : 'text-slate-500'} text-center leading-relaxed">${escapeHtml(cfg.welcomeMessage)}</p>
        ` : ''}

        ${cfg.showNotice ? `
          <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 ${isDarkGlass ? 'text-amber-300' : 'text-amber-800'} text-[10px] flex items-center gap-1.5">
            <span>⚠️</span>
            <span class="line-clamp-2">${escapeHtml(cfg.noticeText)}</span>
          </div>
        ` : ''}

        <div class="space-y-2.5">
          <div>
            <label class="block text-[10px] font-semibold ${isDarkGlass ? 'text-slate-300' : 'text-slate-600'} uppercase tracking-wider mb-1">Username</label>
            <input type="text" disabled placeholder="admin" 
              class="w-full px-3 py-2 rounded-lg text-xs ${isDarkGlass ? 'bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border border-slate-200 text-slate-700'}">
          </div>
          <div>
            <label class="block text-[10px] font-semibold ${isDarkGlass ? 'text-slate-300' : 'text-slate-600'} uppercase tracking-wider mb-1">Password</label>
            <input type="password" disabled value="••••••••" 
              class="w-full px-3 py-2 rounded-lg text-xs ${isDarkGlass ? 'bg-slate-900/60 border border-slate-700 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}">
          </div>
          <button type="button" 
            style="background-color: ${cfg.primaryColor};"
            class="w-full py-2.5 text-white font-semibold rounded-lg shadow-sm text-xs flex items-center justify-center gap-2 transition hover:opacity-95">
            ${escapeHtml(cfg.buttonText)}
          </button>
        </div>

        ${cfg.footerText ? `
          <div class="pt-3 border-t ${isDarkGlass ? 'border-slate-800' : 'border-slate-100'} text-center">
            <p class="text-[10px] ${isDarkGlass ? 'text-slate-400' : 'text-slate-400'}">${escapeHtml(cfg.footerText)}</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

async function saveThemeCustomization() {
  initThemeDraft();
  try {
    const res = await api('/api/theme', 'PUT', state.themeDraft);
    state.theme = res;
    state.themeDraft = JSON.parse(JSON.stringify(res));
    applyTheme(state.theme);
    showToast('Theme & Login Page customizations saved and published successfully!');
    renderApp();
  } catch (err) {
    console.error('Save theme error:', err);
  }
}

async function resetThemeDefaults() {
  if (!confirm('Are you sure you want to reset all theme and login page customizations back to factory defaults?')) return;
  try {
    const res = await api('/api/theme/reset', 'POST');
    state.theme = res;
    state.themeDraft = JSON.parse(JSON.stringify(res));
    applyTheme(state.theme);
    showToast('Theme reset to factory defaults.');
    renderApp();
  } catch (err) {
    console.error('Reset theme error:', err);
  }
}

function openFullLoginPreviewModal() {
  initThemeDraft();
  const cfg = getThemeLoginConfig(state.themeDraft);

  const isDarkGlass = cfg.cardStyle === 'dark-glass';
  const isGlass = cfg.cardStyle === 'glassmorphism';

  let cardClasses = 'bg-white shadow-2xl border border-slate-100 text-slate-800';
  if (isDarkGlass) {
    cardClasses = 'dark-glass-card shadow-2xl border border-white/10 text-white';
  } else if (isGlass) {
    cardClasses = 'glassmorphism-card shadow-2xl border border-white/40 text-slate-800';
  }

  const labelClasses = isDarkGlass ? 'text-slate-300' : 'text-slate-600';
  const inputClasses = isDarkGlass 
    ? 'w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition'
    : 'w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition bg-white text-slate-900';

  const modalHtml = `
    <div id="full-login-preview-modal" class="fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between" style="background: ${cfg.bgStyle};">
      <!-- Top floating banner with Close button -->
      <div class="sticky top-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/10 px-6 py-3 flex items-center justify-between text-white">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-xs font-bold uppercase tracking-wider">Full-Screen Login Page Preview</span>
          <span class="text-[11px] text-slate-400 hidden sm:inline">(This is exactly what visitors see before logging in)</span>
        </div>
        <button onclick="document.getElementById('full-login-preview-modal').remove()" 
          class="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5">
          <span>✕</span> Close Fullscreen Preview
        </button>
      </div>

      <div class="flex-1 flex items-center justify-center p-4">
        <div class="${cardClasses} ${cfg.cardRadius} w-full max-w-md overflow-hidden relative shadow-2xl my-6">
          <!-- Brand Header -->
          <div class="bg-gradient-to-r ${cfg.headerGradient} p-8 text-center text-white relative">
            ${cfg.showLogo ? `
              <div class="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4 p-2">
                <img src="${cfg.logoUrl}" alt="Brand Logo" class="w-full h-full object-contain">
              </div>
            ` : ''}
            <h1 class="text-2xl font-bold tracking-tight">${escapeHtml(cfg.title)}</h1>
            <p class="text-xs text-blue-200 mt-1 uppercase tracking-widest font-semibold">${escapeHtml(cfg.subtitle)}</p>
          </div>

          <!-- Form Body -->
          <div class="p-8">
            ${cfg.welcomeMessage ? `
              <p class="text-xs ${isDarkGlass ? 'text-slate-300' : 'text-slate-500'} mb-5 text-center leading-relaxed">${escapeHtml(cfg.welcomeMessage)}</p>
            ` : ''}

            ${cfg.showNotice ? `
              <div class="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 ${isDarkGlass ? 'text-amber-300' : 'text-amber-800'} text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>${escapeHtml(cfg.noticeText)}</span>
              </div>
            ` : ''}

            <div class="space-y-5">
              <div>
                <label class="block text-xs font-semibold ${labelClasses} uppercase tracking-wider mb-2">Username</label>
                <div class="relative">
                  <input type="text" placeholder="Enter username" class="${inputClasses}">
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold ${labelClasses} uppercase tracking-wider mb-2">Password</label>
                <div class="relative">
                  <input type="password" placeholder="Enter password" class="${inputClasses}">
                </div>
              </div>

              <button type="button" 
                style="background-color: ${cfg.primaryColor};"
                class="w-full py-3.5 text-white font-semibold rounded-lg shadow-md transition duration-200 flex items-center justify-center gap-2">
                ${escapeHtml(cfg.buttonText)}
              </button>
            </div>

            ${cfg.footerText ? `
              <div class="mt-6 pt-4 border-t ${isDarkGlass ? 'border-slate-800' : 'border-slate-100'} text-center">
                <p class="text-[11px] ${isDarkGlass ? 'text-slate-400' : 'text-slate-400'}">${escapeHtml(cfg.footerText)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Theme customization studio
function renderThemeCustomizationTab() {
  initThemeDraft();
  const d = state.themeDraft;
  const l = d.login || {};
  const a = d.app || {};
  const currentPreset = l.preset || 'midnight';

  setTimeout(() => updateThemeLivePreview(), 50);

  return `
    <div class="space-y-8 max-w-7xl mx-auto">
      <!-- Page Header -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-2xl">🎨</span>
            <h1 class="text-2xl font-bold text-slate-900">Theme & Appearance Customization</h1>
          </div>
          <p class="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Customize your front login page branding, background gradients, typography, and card styles with real-time live preview. Changes publish immediately across the platform.
          </p>
        </div>
        <div class="flex items-center gap-3 shrink-0 flex-wrap">
          <button onclick="resetThemeDefaults()" 
            class="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs">
            <span>↺</span> Reset Defaults
          </button>
          <button onclick="openFullLoginPreviewModal()" 
            class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs">
            <span>👁️</span> Fullscreen Preview
          </button>
          <button onclick="saveThemeCustomization()" 
            class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md">
            <span>💾</span> Save & Publish Theme
          </button>
        </div>
      </div>

      <!-- Main Layout: Controls Left, Live Preview Right -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <!-- Controls Column (7 Cols) -->
        <div class="lg:col-span-7 space-y-6">

          <!-- Section 1: Front Login Branding & Messaging -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <span class="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm">🖥️</span>
                <h2 class="text-base font-bold text-slate-800">Login Page Branding & Text</h2>
              </div>
              <span class="text-[11px] text-slate-400">Updates live in preview</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Login Page Title</label>
                <input type="text" value="${escapeHtml(l.title || 'Master Technology')}" 
                  oninput="updateThemeDraft('login', 'title', this.value)"
                  placeholder="e.g. Master Technology"
                  class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Subtitle / Tagline</label>
                <input type="text" value="${escapeHtml(l.subtitle || 'Online Billing & Management System')}" 
                  oninput="updateThemeDraft('login', 'subtitle', this.value)"
                  placeholder="e.g. Online Billing & Management System"
                  class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Welcome Message Note</label>
              <textarea rows="2" 
                oninput="updateThemeDraft('login', 'welcomeMessage', this.value)"
                placeholder="Message displayed above the username input..."
                class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">${escapeHtml(l.welcomeMessage || '')}</textarea>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Sign-In Button Text</label>
                <input type="text" value="${escapeHtml(l.buttonText || 'Sign In to System')}" 
                  oninput="updateThemeDraft('login', 'buttonText', this.value)"
                  placeholder="e.g. Sign In to System"
                  class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Footer Copyright Text</label>
                <input type="text" value="${escapeHtml(l.footerText || '© 2026 Master Technology. All rights reserved.')}" 
                  oninput="updateThemeDraft('login', 'footerText', this.value)"
                  placeholder="e.g. © 2026 Master Technology. All rights reserved."
                  class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
              </div>
            </div>

            <!-- Security Notice Toggle & Input -->
            <div class="pt-3 border-t border-slate-100 space-y-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" ${l.showNotice ? 'checked' : ''} 
                  onchange="updateThemeDraft('login', 'showNotice', this.checked)"
                  class="rounded text-blue-600 focus:ring-blue-500">
                <span class="text-xs font-semibold text-slate-700">Display Security Notice / Announcement Banner on Login</span>
              </label>

              <input type="text" value="${escapeHtml(l.noticeText || 'Notice: Authorized personnel only. All access is logged.')}" 
                oninput="updateThemeDraft('login', 'noticeText', this.value)"
                placeholder="Banner message..."
                class="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${l.showNotice ? '' : 'opacity-50'}">
            </div>
          </div>

          <!-- Section 2: Visual Style & Background Presets -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <span class="p-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm">🌈</span>
                <h2 class="text-base font-bold text-slate-800">Background Themes & Color Presets</h2>
              </div>
              <span class="text-[11px] text-slate-400">Click to switch theme</span>
            </div>

            <!-- Preset Cards Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              ${Object.keys(THEME_PRESETS).map(key => {
                const p = THEME_PRESETS[key];
                const isSelected = currentPreset === key;
                return `
                  <button type="button" data-preset="${key}" onclick="selectThemePreset('${key}')" 
                    class="theme-preset-btn p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      isSelected 
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 font-bold text-blue-900' 
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }">
                    <div class="flex items-center gap-2.5">
                      <span class="w-4 h-4 rounded-full shadow-inner border border-white/50 shrink-0" style="background: ${p.bg};"></span>
                      <span class="text-xs truncate">${p.name}</span>
                    </div>
                    ${isSelected ? '<span class="text-blue-600 text-xs">✓</span>' : ''}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Card Style & Corners -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Login Card Style</label>
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" onclick="updateThemeDraft('login', 'cardStyle', 'solid')" 
                    class="p-2 border rounded-lg text-center text-xs font-semibold transition ${
                      l.cardStyle === 'solid' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }">
                    Solid White
                  </button>
                  <button type="button" onclick="updateThemeDraft('login', 'cardStyle', 'glassmorphism')" 
                    class="p-2 border rounded-lg text-center text-xs font-semibold transition ${
                      l.cardStyle === 'glassmorphism' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }">
                    Frosted Glass
                  </button>
                  <button type="button" onclick="updateThemeDraft('login', 'cardStyle', 'dark-glass')" 
                    class="p-2 border rounded-lg text-center text-xs font-semibold transition ${
                      l.cardStyle === 'dark-glass' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }">
                    Dark Glass
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Card Corner Radius</label>
                <div class="grid grid-cols-4 gap-1.5">
                  <button type="button" onclick="updateThemeDraft('login', 'cardRadius', 'rounded-lg')" 
                    class="p-2 border rounded-lg text-center text-xs font-semibold transition ${
                      l.cardRadius === 'rounded-lg' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }">
                    Small
                  </button>
                  <button type="button" onclick="updateThemeDraft('login', 'cardRadius', 'rounded-xl')" 
                    class="p-2 border rounded-lg text-center text-xs font-semibold transition ${
                      l.cardRadius === 'rounded-xl' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }">
                    Medium
                  </button>
                  <button type="button" onclick="updateThemeDraft('login', 'cardRadius', 'rounded-2xl')" 
                    class="p-2 border rounded-lg text-center text-xs font-semibold transition ${
                      l.cardRadius === 'rounded-2xl' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }">
                    Curved
                  </button>
                  <button type="button" onclick="updateThemeDraft('login', 'cardRadius', 'rounded-3xl')" 
                    class="p-2 border rounded-lg text-center text-xs font-semibold transition ${
                      l.cardRadius === 'rounded-3xl' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }">
                    Pill
                  </button>
                </div>
              </div>
            </div>

            <!-- Button Accent Color -->
            <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-0.5">Primary Button Color</label>
                <p class="text-[11px] text-slate-400">Custom accent color for sign-in and action buttons</p>
              </div>
              <div class="flex items-center gap-2">
                <input type="color" id="theme-btn-color-input" 
                  value="${l.primaryColor || '#2563eb'}"
                  oninput="updateThemeDraft('login', 'primaryColor', this.value); updateThemeDraft('app', 'primaryColor', this.value);"
                  class="w-10 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer">
                <div class="flex items-center gap-1">
                  ${['#2563eb', '#1d4ed8', '#059669', '#7c3aed', '#e11d48', '#d97706', '#0f172a'].map(c => `
                    <button type="button" onclick="updateThemeDraft('login', 'primaryColor', '${c}'); updateThemeDraft('app', 'primaryColor', '${c}'); document.getElementById('theme-btn-color-input').value = '${c}';" 
                      class="w-6 h-6 rounded-full border border-white shadow-xs transition hover:scale-110" style="background-color: ${c};" title="${c}"></button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Brand Logo & Display Options -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <span class="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm">🖼️</span>
                <h2 class="text-base font-bold text-slate-800">Brand Logo on Login</h2>
              </div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" ${l.showLogo !== false ? 'checked' : ''} 
                  onchange="updateThemeDraft('login', 'showLogo', this.checked)"
                  class="rounded text-blue-600 focus:ring-blue-500">
                <span class="text-xs font-semibold text-slate-700">Display Logo</span>
              </label>
            </div>

            <div class="space-y-3">
              <div class="flex items-center gap-4">
                <input type="file" id="theme-logo-file-input" accept="image/*" onchange="handleThemeLogoUpload(event)" class="hidden">
                <button type="button" onclick="document.getElementById('theme-logo-file-input').click()" 
                  class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs">
                  <span>📁</span> Upload Custom Login Logo
                </button>
                <button type="button" onclick="clearThemeLogo()" 
                  class="px-3 py-2 text-red-600 hover:text-red-800 text-xs font-semibold transition">
                  Use Default Logo
                </button>
              </div>

              <!-- Uploaded preview container -->
              <div id="theme-logo-preview-box" class="${l.customLogo ? '' : 'hidden'} flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <img id="theme-logo-preview-img" src="${l.customLogo || ''}" alt="Logo Preview" class="h-12 w-auto object-contain bg-white p-1 rounded border border-slate-200 shadow-xs">
                <div class="text-xs">
                  <div class="font-bold text-slate-800">Custom Logo Loaded</div>
                  <div class="text-[11px] text-slate-500">This logo will display specifically on the login page.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 4: System & Dashboard Header Branding -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <span class="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm">🏢</span>
                <h2 class="text-base font-bold text-slate-800">System Navigation & App Branding</h2>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Dashboard App Title</label>
                <input type="text" value="${escapeHtml(a.brandName || 'Master Technology')}" 
                  oninput="updateThemeDraft('app', 'brandName', this.value)"
                  placeholder="e.g. Master Technology"
                  class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Dashboard Subtitle</label>
                <input type="text" value="${escapeHtml(a.brandTagline || 'Billing Online System')}" 
                  oninput="updateThemeDraft('app', 'brandTagline', this.value)"
                  placeholder="e.g. Billing Online System"
                  class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
              </div>
            </div>
          </div>

        </div>

        <!-- Live Preview Column (5 Cols) - Sticky -->
        <div class="lg:col-span-5 sticky top-20 space-y-4">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-base">📱</span>
                <h3 class="text-sm font-bold text-slate-800">Live Login Screen Preview</h3>
              </div>
              <button onclick="openFullLoginPreviewModal()" class="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                <span>⤢</span> Fullscreen
              </button>
            </div>
            <p class="text-[11px] text-slate-500">
              Interactive preview updates automatically in real-time as you tweak colors, text, or presets.
            </p>

            <!-- Dynamic Live Preview Box Container -->
            <div id="theme-live-preview-box" class="w-full flex items-center justify-center p-6 rounded-2xl border border-slate-700/50 shadow-inner relative overflow-hidden transition-all duration-300 min-h-[500px]">
              <!-- Injected by updateThemeLivePreview() -->
            </div>

            <!-- Quick Action footer -->
            <div class="pt-2 flex justify-between items-center text-xs text-slate-500">
              <span>Ready to publish?</span>
              <button onclick="saveThemeCustomization()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-sm">
                Save & Publish
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

