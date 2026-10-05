const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT ? (isNaN(process.env.PORT) ? process.env.PORT : parseInt(process.env.PORT, 10)) : 3000;
const HOST = process.env.HOST || null;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory active sessions
const sessions = new Map();

// Persistent JSON storage with atomic write guarantee
function readJson(filename, defaultValue = []) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return defaultValue;
  }
}

function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  const tempPath = path.join(DATA_DIR, `${filename}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error(`Fallback direct write failed for ${filename}:`, e);
      return false;
    }
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload too large: maximum size is 10MB'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Granular permissions catalog
const ALL_PERMISSIONS = [
  { id: 'invoices.view', name: 'View Invoices', group: 'Billing & Invoices', description: 'View invoice list, search and inspect invoice details' },
  { id: 'invoices.create', name: 'Create Invoices', group: 'Billing & Invoices', description: 'Create and issue new customer bills' },
  { id: 'invoices.edit', name: 'Edit Invoices', group: 'Billing & Invoices', description: 'Modify bill items, payments, customer info and dues' },
  { id: 'invoices.delete', name: 'Delete Invoices', group: 'Billing & Invoices', description: 'Move invoices to the Trash Box' },
  { id: 'invoices.print_pdf', name: 'Print & PDF Export', group: 'Billing & Invoices', description: 'Generate high-res PDF and print A4 invoice copies' },

  { id: 'products.view', name: 'View Catalog', group: 'Inventory & Products', description: 'Browse product catalog and view price information' },
  { id: 'products.create', name: 'Create Products', group: 'Inventory & Products', description: 'Add new products and set standard prices and warranties' },
  { id: 'products.edit', name: 'Edit Products', group: 'Inventory & Products', description: 'Update product prices, warranties, and categories' },
  { id: 'products.delete', name: 'Delete Products', group: 'Inventory & Products', description: 'Move products to the Trash Box' },

  { id: 'trash.view', name: 'View Trash', group: 'Trash & Recycle Bin', description: 'View deleted bills and products in Trash Box' },
  { id: 'trash.restore', name: 'Restore Trash', group: 'Trash & Recycle Bin', description: 'Recover deleted items back to active invoices and products' },
  { id: 'trash.delete_permanent', name: 'Permanent Delete', group: 'Trash & Recycle Bin', description: 'Permanently purge single items from Trash Box' },
  { id: 'trash.empty', name: 'Empty Trash', group: 'Trash & Recycle Bin', description: 'Empty and purge all items in Trash Box' },

  { id: 'users.view', name: 'View Users', group: 'User Accounts', description: 'View user accounts list and status' },
  { id: 'users.manage', name: 'Manage Users', group: 'User Accounts', description: 'Create, update, deactivate, and delete user accounts' },

  { id: 'roles.view', name: 'View Roles & Matrix', group: 'Roles & Permissions', description: 'View system roles and permission matrix' },
  { id: 'roles.manage', name: 'Manage Roles', group: 'Roles & Permissions', description: 'Create custom roles, edit permissions, and delete roles' },

  { id: 'settings.view', name: 'View Settings', group: 'Company Settings', description: 'View company profile, logo, invoice prefixes and terms' },
  { id: 'settings.edit', name: 'Edit Settings', group: 'Company Settings', description: 'Update company details, invoice prefixes, and terms notice' },
  { id: 'companies.view', name: 'View Companies', group: 'Company Settings', description: 'View company profiles and branding information' },
  { id: 'companies.manage', name: 'Manage Companies', group: 'Company Settings', description: 'Add, update, delete company profiles and upload brand logos' },

  { id: 'reports.view', name: 'View Financial Reports', group: 'Reports & Analytics', description: 'View dashboard sales, total received, and due balances' },
];

function getRoleForUser(userRole) {
  if (!userRole) return null;
  const roles = readJson('roles.json', []);
  const normalized = userRole.toLowerCase().trim();
  return roles.find(r => 
    r.id.toLowerCase() === normalized || 
    r.id.toLowerCase() === `role-${normalized}` || 
    r.name.toLowerCase() === normalized
  ) || null;
}

function getUserPermissions(user) {
  if (!user) return [];
  if (user.role === 'admin' || user.role === 'role-admin') {
    return ['*'];
  }
  const roleObj = getRoleForUser(user.role);
  if (!roleObj) {
    return ['invoices.view', 'products.view'];
  }
  if (Array.isArray(roleObj.permissions) && roleObj.permissions.includes('*')) {
    return ['*'];
  }
  return Array.isArray(roleObj.permissions) ? roleObj.permissions : [];
}

function userCan(user, permKey) {
  if (!user) return false;
  const perms = getUserPermissions(user);
  if (perms.includes('*')) return true;
  return perms.includes(permKey);
}

function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  // Check session expiration (12 hours)
  if (Date.now() - session.createdAt > 12 * 60 * 60 * 1000) {
    sessions.delete(token);
    return null;
  }
  const u = session.user;
  const roleObj = getRoleForUser(u.role);
  return {
    ...u,
    roleName: roleObj ? roleObj.name : u.role,
    permissions: getUserPermissions(u)
  };
}

// Generate unique invoice number
function generateNumbers(companyId = null) {
  const companies = readJson('companies.json', []);
  const settings = readJson('settings.json', {});

  let targetComp = null;
  if (companyId) {
    targetComp = companies.find(c => c.id === companyId);
  }
  if (!targetComp) {
    targetComp = companies.find(c => c.isDefault) || companies[0] || settings;
  }

  const invoices = readJson('invoices.json', []);
  const nextSeq = (invoices.length + 1).toString().padStart(4, '0');
  const randNum = Math.floor(10000000 + Math.random() * 90000000);
  const currentYear = new Date().getFullYear();

  const invPrefix = (targetComp && targetComp.invoicePrefix) || settings.invoicePrefix || 'INV-ehs-';
  const soPrefix = (targetComp && targetComp.salesOrderPrefix) || settings.salesOrderPrefix || 'SO-WTAM_';

  const invoiceNo = `${invPrefix}${randNum}-${nextSeq}`;
  const salesOrderNo = `${soPrefix}${currentYear}-${nextSeq}`;

  return { invoiceNo, salesOrderNo };
}

// Automatically register unlisted billed products into products.json
function autoRegisterProducts(items) {
  if (!Array.isArray(items)) return [];
  const products = readJson('products.json', []);
  let updated = false;
  const newlyAdded = [];

  for (const item of items) {
    if (!item || !item.description || !item.description.trim()) continue;
    const desc = item.description.trim();
    const existing = products.find(p => p.name.toLowerCase() === desc.toLowerCase());

    if (!existing) {
      const newProduct = {
        id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: desc,
        warranty: item.warranty ? item.warranty.trim() : '',
        unitPrice: Number(item.unitPrice || 0),
        category: 'General'
      };
      products.push(newProduct);
      newlyAdded.push(newProduct);
      updated = true;
    } else {
      // If existing product price is 0 and current bill specifies a price, update it
      if (Number(item.unitPrice) > 0 && Number(existing.unitPrice) === 0) {
        existing.unitPrice = Number(item.unitPrice);
        updated = true;
      }
      if (item.warranty && !existing.warranty) {
        existing.warranty = item.warranty.trim();
        updated = true;
      }
    }
  }

  if (updated) {
    writeJson('products.json', products);
  }
  return newlyAdded;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';

  // Universal Path Normalization:
  // If hosted behind a cPanel subfolder or reverse proxy (e.g. /billing/api/auth/login),
  // strip any leading folder path so it matches the standard /api/... routes.
  const apiIndex = pathname.indexOf('/api/');
  if (apiIndex > 0) {
    pathname = pathname.substring(apiIndex);
  } else if (pathname.endsWith('/api')) {
    pathname = '/api';
  } else if (pathname.includes('/health')) {
    pathname = '/health';
  }

  const method = req.method.toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Health check endpoint
  if ((pathname === '/health' || pathname === '/api/health') && method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: 'sec-gadgets-billing',
      version: '1.0.0'
    });
  }

  // Authentication endpoints
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const { username, password } = await parseBody(req);
      if (!username || !password) {
        return sendJson(res, 400, { error: 'Username and password are required' });
      }

      const users = readJson('users.json', []);
      const hashed = hashPassword(password);
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase().trim() && u.passwordHash === hashed);

      if (!user) {
        return sendJson(res, 401, { error: 'Invalid username or password' });
      }

      if (user.status !== 'active') {
        return sendJson(res, 403, { error: 'Your account is deactivated. Please contact administrator.' });
      }

      const roleObj = getRoleForUser(user.role);
      const perms = getUserPermissions(user);

      const token = crypto.randomBytes(32).toString('hex');
      const safeUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        roleName: roleObj ? roleObj.name : user.role,
        permissions: perms,
        status: user.status
      };

      sessions.set(token, { user: safeUser, createdAt: Date.now() });
      return sendJson(res, 200, { token, user: safeUser });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      sessions.delete(token);
    }
    return sendJson(res, 200, { success: true });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthenticated' });
    }
    return sendJson(res, 200, { user });
  }

  // User management
  if (pathname === '/api/users' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'users.view')) {
      return sendJson(res, 403, { error: 'Permission denied: users.view required' });
    }

    const users = readJson('users.json', []);
    const safeList = users.map(u => {
      const roleObj = getRoleForUser(u.role);
      return {
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
        role: u.role,
        roleName: roleObj ? roleObj.name : u.role,
        status: u.status,
        createdAt: u.createdAt
      };
    });
    return sendJson(res, 200, safeList);
  }

  if (pathname === '/api/users' && method === 'POST') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'users.manage')) {
      return sendJson(res, 403, { error: 'Permission denied: users.manage required' });
    }

    try {
      const { username, name, email, password, role, status } = await parseBody(req);
      if (!username || !password || !name) {
        return sendJson(res, 400, { error: 'Username, password and name are required' });
      }

      const users = readJson('users.json', []);
      if (users.some(u => u.username.toLowerCase() === username.toLowerCase().trim())) {
        return sendJson(res, 400, { error: 'Username already exists' });
      }

      const newUser = {
        id: `usr-${Date.now()}`,
        username: username.trim(),
        name: name.trim(),
        email: email ? email.trim() : '',
        passwordHash: hashPassword(password),
        role: role || 'sales',
        status: status || 'active',
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      writeJson('users.json', users);

      const roleObj = getRoleForUser(newUser.role);
      const { passwordHash, ...safeUser } = newUser;
      safeUser.roleName = roleObj ? roleObj.name : newUser.role;
      return sendJson(res, 201, safeUser);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/users/') && method === 'PUT') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'users.manage')) {
      return sendJson(res, 403, { error: 'Permission denied: users.manage required' });
    }

    const userId = pathname.replace('/api/users/', '');
    try {
      const { name, email, password, role, status } = await parseBody(req);
      const users = readJson('users.json', []);
      const index = users.findIndex(u => u.id === userId);

      if (index === -1) {
        return sendJson(res, 404, { error: 'User not found' });
      }

      if (name) users[index].name = name.trim();
      if (email !== undefined) users[index].email = email.trim();
      if (role) users[index].role = role;
      if (status) users[index].status = status;
      if (password && password.trim().length > 0) {
        users[index].passwordHash = hashPassword(password);
      }

      writeJson('users.json', users);
      const roleObj = getRoleForUser(users[index].role);
      const { passwordHash, ...safeUser } = users[index];
      safeUser.roleName = roleObj ? roleObj.name : users[index].role;
      return sendJson(res, 200, safeUser);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/users/') && method === 'DELETE') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'users.manage')) {
      return sendJson(res, 403, { error: 'Permission denied: users.manage required' });
    }

    const userId = pathname.replace('/api/users/', '');
    const users = readJson('users.json', []);

    if (userId === currentUser.id) {
      return sendJson(res, 400, { error: 'You cannot delete your own logged-in account' });
    }

    const filtered = users.filter(u => u.id !== userId);
    if (filtered.length === users.length) {
      return sendJson(res, 404, { error: 'User not found' });
    }

    writeJson('users.json', filtered);
    return sendJson(res, 200, { success: true });
  }

  // Role-based access control (RBAC)
  if (pathname === '/api/roles' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'roles.view') && !userCan(currentUser, 'users.view')) {
      return sendJson(res, 403, { error: 'Permission denied: roles.view required' });
    }

    const roles = readJson('roles.json', []);
    return sendJson(res, 200, { roles, availablePermissions: ALL_PERMISSIONS });
  }

  if (pathname === '/api/roles' && method === 'POST') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'roles.manage')) {
      return sendJson(res, 403, { error: 'Permission denied: roles.manage required' });
    }

    try {
      const { name, description, permissions } = await parseBody(req);
      if (!name || !name.trim()) {
        return sendJson(res, 400, { error: 'Role name is required' });
      }

      const roles = readJson('roles.json', []);
      if (roles.some(r => r.name.toLowerCase() === name.trim().toLowerCase())) {
        return sendJson(res, 400, { error: 'A role with this name already exists' });
      }

      const newRole = {
        id: `role-${Date.now()}`,
        name: name.trim(),
        description: description ? description.trim() : '',
        isSystem: false,
        permissions: Array.isArray(permissions) ? permissions : []
      };

      roles.push(newRole);
      writeJson('roles.json', roles);
      return sendJson(res, 201, newRole);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/roles/') && method === 'PUT') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'roles.manage')) {
      return sendJson(res, 403, { error: 'Permission denied: roles.manage required' });
    }

    const roleId = pathname.replace('/api/roles/', '');
    try {
      const { name, description, permissions } = await parseBody(req);
      const roles = readJson('roles.json', []);
      const index = roles.findIndex(r => r.id === roleId);

      if (index === -1) {
        return sendJson(res, 404, { error: 'Role not found' });
      }

      if (name) roles[index].name = name.trim();
      if (description !== undefined) roles[index].description = description.trim();
      if (Array.isArray(permissions)) {
        // Admin role must retain superuser permissions
        if (roles[index].isSystem && roles[index].id === 'role-admin') {
          roles[index].permissions = ['*'];
        } else {
          roles[index].permissions = permissions;
        }
      }

      writeJson('roles.json', roles);
      return sendJson(res, 200, roles[index]);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/roles/') && method === 'DELETE') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'roles.manage')) {
      return sendJson(res, 403, { error: 'Permission denied: roles.manage required' });
    }

    const roleId = pathname.replace('/api/roles/', '');
    const roles = readJson('roles.json', []);
    const role = roles.find(r => r.id === roleId);

    if (!role) {
      return sendJson(res, 404, { error: 'Role not found' });
    }

    if (role.isSystem) {
      return sendJson(res, 400, { error: 'System roles (e.g. Administrator) cannot be deleted' });
    }

    // Check if any user is currently assigned to this role
    const users = readJson('users.json', []);
    const assignedUser = users.find(u => 
      u.role === role.id || 
      u.role === role.id.replace(/^role-/, '') || 
      u.role.toLowerCase() === role.name.toLowerCase()
    );

    if (assignedUser) {
      return sendJson(res, 400, { 
        error: `Cannot delete role '${role.name}' because user '${assignedUser.name}' (@${assignedUser.username}) is currently assigned to it.` 
      });
    }

    const filtered = roles.filter(r => r.id !== roleId);
    writeJson('roles.json', filtered);
    return sendJson(res, 200, { success: true, message: `Role '${role.name}' deleted successfully` });
  }

  // Invoices
  if (pathname === '/api/invoices/next-numbers' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'invoices.create') && !userCan(currentUser, 'invoices.view')) {
      return sendJson(res, 403, { error: 'Permission denied' });
    }
    const companyId = parsedUrl.query.companyId;
    return sendJson(res, 200, generateNumbers(companyId));
  }

  if (pathname === '/api/invoices' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'invoices.view')) {
      return sendJson(res, 403, { error: 'Permission denied: invoices.view required' });
    }

    const invoices = readJson('invoices.json', []);
    const { search, status, date } = parsedUrl.query;

    let result = invoices;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(inv =>
        (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(q)) ||
        (inv.salesOrderNo && inv.salesOrderNo.toLowerCase().includes(q)) ||
        (inv.buyerName && inv.buyerName.toLowerCase().includes(q)) ||
        (inv.soldBy && inv.soldBy.toLowerCase().includes(q))
      );
    }

    if (status) {
      result = result.filter(inv => inv.status && inv.status.toLowerCase() === status.toLowerCase());
    }

    if (date) {
      result = result.filter(inv => inv.date === date);
    }

    return sendJson(res, 200, result);
  }

  if (pathname.startsWith('/api/invoices/') && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'invoices.view')) {
      return sendJson(res, 403, { error: 'Permission denied: invoices.view required' });
    }

    const id = pathname.replace('/api/invoices/', '');
    const invoices = readJson('invoices.json', []);
    const invoice = invoices.find(inv => inv.id === id || inv.invoiceNo === id);
    if (!invoice) return sendJson(res, 404, { error: 'Invoice not found' });
    return sendJson(res, 200, invoice);
  }

  if (pathname === '/api/invoices' && method === 'POST') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'invoices.create')) {
      return sendJson(res, 403, { error: 'Permission denied: invoices.create required' });
    }

    try {
      const invoiceData = await parseBody(req);
      const invoices = readJson('invoices.json', []);
      const companies = readJson('companies.json', []);

      const companyId = invoiceData.companyId || (companies.find(c => c.isDefault) || companies[0] || {}).id;
      const matchedCompany = companies.find(c => c.id === companyId) || companies[0] || null;

      const gen = generateNumbers(companyId);
      const newInvoice = {
        id: `inv-${Date.now()}`,
        companyId: matchedCompany ? matchedCompany.id : 'comp-master-tech',
        company: matchedCompany ? {
          id: matchedCompany.id,
          name: matchedCompany.name,
          tagline: matchedCompany.tagline || '',
          address: matchedCompany.address,
          phone: matchedCompany.phone,
          email: matchedCompany.email,
          logo: matchedCompany.logo,
          termsNotice: matchedCompany.termsNotice,
          invoicePrefix: matchedCompany.invoicePrefix,
          salesOrderPrefix: matchedCompany.salesOrderPrefix
        } : null,
        salesOrderNo: invoiceData.salesOrderNo || gen.salesOrderNo,
        invoiceNo: invoiceData.invoiceNo || gen.invoiceNo,
        date: invoiceData.date || new Date().toLocaleDateString('en-GB'),
        time: invoiceData.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        buyerName: invoiceData.buyerName || '',
        buyerAddress: invoiceData.buyerAddress || '',
        soldBy: invoiceData.soldBy || currentUser.name || 'Admin',
        zone: invoiceData.zone || '',
        items: Array.isArray(invoiceData.items) ? invoiceData.items : [],
        totalAmount: Number(invoiceData.totalAmount || 0),
        lessDiscount: Number(invoiceData.lessDiscount || 0),
        addVat: Number(invoiceData.addVat || 0),
        addAit: Number(invoiceData.addAit || 0),
        addExtraCharges: Number(invoiceData.addExtraCharges || 0),
        netPayableAmount: Number(invoiceData.netPayableAmount || 0),
        previousDueAmount: Number(invoiceData.previousDueAmount || 0),
        totalDueAmount: Number(invoiceData.totalDueAmount || 0),
        receivedAmount: Number(invoiceData.receivedAmount || 0),
        closingBalance: Number(invoiceData.closingBalance || 0),
        takaInWords: invoiceData.takaInWords || '',
        termsNotice: invoiceData.termsNotice || (matchedCompany ? matchedCompany.termsNotice : ''),
        status: Number(invoiceData.closingBalance || 0) <= 0 ? 'Paid' : (Number(invoiceData.receivedAmount || 0) > 0 ? 'Partial' : 'Due'),
        createdAt: new Date().toISOString(),
        createdBy: {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          role: currentUser.role
        }
      };

      invoices.unshift(newInvoice);
      writeJson('invoices.json', invoices);

      // Automatically add any billed products not in catalog
      autoRegisterProducts(newInvoice.items);

      return sendJson(res, 201, newInvoice);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/invoices/') && method === 'PUT') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'invoices.edit')) {
      return sendJson(res, 403, { error: 'Permission denied: invoices.edit required' });
    }

    const id = pathname.replace('/api/invoices/', '');
    try {
      const invoiceData = await parseBody(req);
      const invoices = readJson('invoices.json', []);
      const index = invoices.findIndex(inv => inv.id === id);

      if (index === -1) {
        return sendJson(res, 404, { error: 'Invoice not found' });
      }

      const targetCompId = invoiceData.companyId || invoices[index].companyId;
      const companies = readJson('companies.json', []);
      const matched = targetCompId ? companies.find(c => c.id === targetCompId) : null;
      const updatedCompany = matched ? {
        id: matched.id,
        name: matched.name,
        tagline: matched.tagline || '',
        address: matched.address,
        phone: matched.phone,
        email: matched.email,
        logo: matched.logo,
        termsNotice: matched.termsNotice,
        invoicePrefix: matched.invoicePrefix,
        salesOrderPrefix: matched.salesOrderPrefix
      } : invoices[index].company;

      invoices[index] = {
        ...invoices[index],
        ...invoiceData,
        company: updatedCompany,
        id: invoices[index].id,
        status: Number(invoiceData.closingBalance || invoices[index].closingBalance) <= 0 ? 'Paid' : (Number(invoiceData.receivedAmount || invoices[index].receivedAmount) > 0 ? 'Partial' : 'Due'),
        updatedAt: new Date().toISOString(),
        updatedBy: {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          role: currentUser.role
        }
      };

      writeJson('invoices.json', invoices);

      // Automatically add any billed products not in catalog
      autoRegisterProducts(invoices[index].items);

      return sendJson(res, 200, invoices[index]);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/invoices/') && method === 'DELETE') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'invoices.delete')) {
      return sendJson(res, 403, { error: 'Permission denied: invoices.delete required' });
    }

    const id = pathname.replace('/api/invoices/', '');
    const invoices = readJson('invoices.json', []);
    const index = invoices.findIndex(inv => inv.id === id);

    if (index === -1) {
      return sendJson(res, 404, { error: 'Invoice not found' });
    }

    const [deletedInvoice] = invoices.splice(index, 1);
    writeJson('invoices.json', invoices);

    // Save to Trash Box with deletion tracking
    const trash = readJson('trash.json', []);
    trash.unshift({
      trashId: `trash-inv-${Date.now()}`,
      type: 'invoice',
      itemTitle: deletedInvoice.invoiceNo || 'Invoice',
      itemSubtitle: `${deletedInvoice.buyerName || 'Customer'} • TK ${Number(deletedInvoice.netPayableAmount || 0).toLocaleString()}`,
      data: deletedInvoice,
      deletedAt: new Date().toISOString(),
      deletedBy: {
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name,
        role: currentUser.role
      }
    });
    writeJson('trash.json', trash);

    return sendJson(res, 200, { success: true, message: 'Invoice moved to Trash Box' });
  }

  // Products inventory
  if (pathname === '/api/products' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'products.view')) {
      return sendJson(res, 403, { error: 'Permission denied: products.view required' });
    }

    const products = readJson('products.json', []);
    return sendJson(res, 200, products);
  }

  if (pathname === '/api/products' && method === 'POST') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'products.create')) {
      return sendJson(res, 403, { error: 'Permission denied: products.create required' });
    }

    try {
      const { name, warranty, unitPrice, category } = await parseBody(req);
      if (!name) return sendJson(res, 400, { error: 'Product name is required' });

      const products = readJson('products.json', []);
      const newProduct = {
        id: `prod-${Date.now()}`,
        name: name.trim(),
        warranty: warranty || '',
        unitPrice: Number(unitPrice || 0),
        category: category || 'General',
        createdAt: new Date().toISOString(),
        createdBy: {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name
        }
      };

      products.push(newProduct);
      writeJson('products.json', products);
      return sendJson(res, 201, newProduct);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/products/') && method === 'DELETE') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'products.delete')) {
      return sendJson(res, 403, { error: 'Permission denied: products.delete required' });
    }

    const id = pathname.replace('/api/products/', '');
    const products = readJson('products.json', []);
    const index = products.findIndex(p => p.id === id);

    if (index === -1) {
      return sendJson(res, 404, { error: 'Product not found' });
    }

    const [deletedProduct] = products.splice(index, 1);
    writeJson('products.json', products);

    // Save to Trash Box with deletion tracking
    const trash = readJson('trash.json', []);
    trash.unshift({
      trashId: `trash-prod-${Date.now()}`,
      type: 'product',
      itemTitle: deletedProduct.name,
      itemSubtitle: `${deletedProduct.category || 'General'} • TK ${Number(deletedProduct.unitPrice || 0).toLocaleString()}`,
      data: deletedProduct,
      deletedAt: new Date().toISOString(),
      deletedBy: {
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name,
        role: currentUser.role
      }
    });
    writeJson('trash.json', trash);

    return sendJson(res, 200, { success: true, message: 'Product moved to Trash Box' });
  }

  // Trash box / soft delete
  if (pathname === '/api/trash' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'trash.view')) {
      return sendJson(res, 403, { error: 'Permission denied: trash.view required' });
    }

    const trash = readJson('trash.json', []);
    return sendJson(res, 200, trash);
  }

  if (pathname === '/api/trash/restore' && method === 'POST') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'trash.restore')) {
      return sendJson(res, 403, { error: 'Permission denied: trash.restore required' });
    }

    try {
      const { trashId } = await parseBody(req);
      const trash = readJson('trash.json', []);
      const index = trash.findIndex(t => t.trashId === trashId);

      if (index === -1) {
        return sendJson(res, 404, { error: 'Item not found in Trash Box' });
      }

      const [item] = trash.splice(index, 1);
      writeJson('trash.json', trash);

      if (item.type === 'invoice') {
        const invoices = readJson('invoices.json', []);
        invoices.unshift(item.data);
        writeJson('invoices.json', invoices);
      } else if (item.type === 'product') {
        const products = readJson('products.json', []);
        products.push(item.data);
        writeJson('products.json', products);
      }

      return sendJson(res, 200, { success: true, message: 'Item restored successfully!' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/trash/') && method === 'DELETE') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'trash.delete_permanent')) {
      return sendJson(res, 403, { error: 'Permission denied: trash.delete_permanent required' });
    }

    const trashId = pathname.replace('/api/trash/', '');
    const trash = readJson('trash.json', []);
    const filtered = trash.filter(t => t.trashId !== trashId);
    writeJson('trash.json', filtered);
    return sendJson(res, 200, { success: true, message: 'Item permanently deleted' });
  }

  if (pathname === '/api/trash' && method === 'DELETE') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'trash.empty')) {
      return sendJson(res, 403, { error: 'Permission denied: trash.empty required' });
    }

    writeJson('trash.json', []);
    return sendJson(res, 200, { success: true, message: 'Trash Box emptied' });
  }

  // System settings
  if (pathname === '/api/settings' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'settings.view')) {
      return sendJson(res, 403, { error: 'Permission denied: settings.view required' });
    }

    const settings = readJson('settings.json', {});
    return sendJson(res, 200, settings);
  }

  if (pathname === '/api/settings' && method === 'PUT') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'settings.edit')) {
      return sendJson(res, 403, { error: 'Permission denied: settings.edit required' });
    }

    try {
      const newSettings = await parseBody(req);
      const existing = readJson('settings.json', {});
      const merged = { ...existing, ...newSettings };
      writeJson('settings.json', merged);
      return sendJson(res, 200, merged);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Theme customization
  if (pathname === '/api/theme' && method === 'GET') {
    // Public endpoint: enables the login page to apply custom branding before login
    const defaultTheme = {
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
    };
    const theme = readJson('theme.json', defaultTheme);
    return sendJson(res, 200, theme);
  }

  if (pathname === '/api/theme' && method === 'PUT') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'settings.edit')) {
      return sendJson(res, 403, { error: 'Permission denied: settings.edit required' });
    }

    try {
      const updates = await parseBody(req);
      const existing = readJson('theme.json', {});
      const merged = {
        login: { ...(existing.login || {}), ...(updates.login || {}) },
        app: { ...(existing.app || {}), ...(updates.app || {}) },
        invoice: { ...(existing.invoice || {}), ...(updates.invoice || {}) }
      };
      writeJson('theme.json', merged);
      return sendJson(res, 200, merged);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/theme/reset' && method === 'POST') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'settings.edit')) {
      return sendJson(res, 403, { error: 'Permission denied: settings.edit required' });
    }

    const defaultTheme = {
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
    };
    writeJson('theme.json', defaultTheme);
    return sendJson(res, 200, defaultTheme);
  }

  // Company profiles
  if (pathname === '/api/companies' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    const companies = readJson('companies.json', []);
    return sendJson(res, 200, companies);
  }

  if (pathname.startsWith('/api/companies/') && pathname.endsWith('/set-default') && method === 'POST') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'companies.manage') && !userCan(currentUser, 'settings.edit')) {
      return sendJson(res, 403, { error: 'Permission denied: companies.manage required' });
    }

    const compId = pathname.replace('/api/companies/', '').replace('/set-default', '');
    const companies = readJson('companies.json', []);
    const comp = companies.find(c => c.id === compId);
    if (!comp) return sendJson(res, 404, { error: 'Company not found' });

    companies.forEach(c => {
      c.isDefault = (c.id === compId);
    });
    writeJson('companies.json', companies);

    // Sync with settings.json
    const settings = readJson('settings.json', {});
    const updatedSettings = {
      ...settings,
      companyName: comp.name,
      tagline: comp.tagline || '',
      address: comp.address || '',
      phone: comp.phone || '',
      email: comp.email || '',
      invoicePrefix: comp.invoicePrefix || 'INV-',
      salesOrderPrefix: comp.salesOrderPrefix || 'SO-',
      termsNotice: comp.termsNotice || '',
      logo: comp.logo || ''
    };
    writeJson('settings.json', updatedSettings);

    return sendJson(res, 200, { success: true, company: comp, message: `'${comp.name}' is now the default company` });
  }

  if (pathname.startsWith('/api/companies/') && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    const id = pathname.replace('/api/companies/', '');
    const companies = readJson('companies.json', []);
    const comp = companies.find(c => c.id === id);
    if (!comp) return sendJson(res, 404, { error: 'Company not found' });
    return sendJson(res, 200, comp);
  }

  if (pathname === '/api/companies' && method === 'POST') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'companies.manage') && !userCan(currentUser, 'settings.edit')) {
      return sendJson(res, 403, { error: 'Permission denied: companies.manage required' });
    }

    try {
      const data = await parseBody(req);
      if (!data.name || !data.name.trim()) {
        return sendJson(res, 400, { error: 'Company name is required' });
      }

      const companies = readJson('companies.json', []);
      const isDefault = Boolean(data.isDefault) || companies.length === 0;

      if (isDefault) {
        companies.forEach(c => { c.isDefault = false; });
      }

      const newCompany = {
        id: `comp-${Date.now()}`,
        name: data.name.trim(),
        tagline: data.tagline ? data.tagline.trim() : '',
        address: data.address ? data.address.trim() : '',
        phone: data.phone ? data.phone.trim() : '',
        email: data.email ? data.email.trim() : '',
        invoicePrefix: (data.invoicePrefix && data.invoicePrefix.trim()) || 'INV-',
        salesOrderPrefix: (data.salesOrderPrefix && data.salesOrderPrefix.trim()) || 'SO-',
        termsNotice: data.termsNotice !== undefined ? data.termsNotice.trim() : '',
        logo: data.logo || '', // Base64 data URL
        isDefault,
        createdAt: new Date().toISOString()
      };

      companies.push(newCompany);
      writeJson('companies.json', companies);

      if (isDefault) {
        const settings = readJson('settings.json', {});
        writeJson('settings.json', {
          ...settings,
          companyName: newCompany.name,
          tagline: newCompany.tagline,
          address: newCompany.address,
          phone: newCompany.phone,
          email: newCompany.email,
          invoicePrefix: newCompany.invoicePrefix,
          salesOrderPrefix: newCompany.salesOrderPrefix,
          termsNotice: newCompany.termsNotice,
          logo: newCompany.logo
        });
      }

      return sendJson(res, 201, newCompany);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/companies/') && method === 'PUT') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'companies.manage') && !userCan(currentUser, 'settings.edit')) {
      return sendJson(res, 403, { error: 'Permission denied: companies.manage required' });
    }

    const id = pathname.replace('/api/companies/', '');
    try {
      const data = await parseBody(req);
      const companies = readJson('companies.json', []);
      const index = companies.findIndex(c => c.id === id);

      if (index === -1) {
        return sendJson(res, 404, { error: 'Company not found' });
      }

      if (data.isDefault) {
        companies.forEach(c => { c.isDefault = false; });
      }

      companies[index] = {
        ...companies[index],
        name: data.name ? data.name.trim() : companies[index].name,
        tagline: data.tagline !== undefined ? data.tagline.trim() : companies[index].tagline,
        address: data.address !== undefined ? data.address.trim() : companies[index].address,
        phone: data.phone !== undefined ? data.phone.trim() : companies[index].phone,
        email: data.email !== undefined ? data.email.trim() : companies[index].email,
        invoicePrefix: data.invoicePrefix ? data.invoicePrefix.trim() : companies[index].invoicePrefix,
        salesOrderPrefix: data.salesOrderPrefix ? data.salesOrderPrefix.trim() : companies[index].salesOrderPrefix,
        termsNotice: data.termsNotice !== undefined ? data.termsNotice.trim() : companies[index].termsNotice,
        logo: data.logo !== undefined ? data.logo : companies[index].logo,
        isDefault: data.isDefault !== undefined ? Boolean(data.isDefault) : companies[index].isDefault,
        updatedAt: new Date().toISOString()
      };

      writeJson('companies.json', companies);

      // Automatically update any existing invoices referencing this company so they get the new logo & details
      const invoices = readJson('invoices.json', []);
      let invUpdated = false;
      invoices.forEach(inv => {
        if (inv.companyId === id || (inv.company && inv.company.id === id)) {
          inv.company = {
            id: companies[index].id,
            name: companies[index].name,
            tagline: companies[index].tagline || '',
            address: companies[index].address,
            phone: companies[index].phone,
            email: companies[index].email,
            logo: companies[index].logo,
            termsNotice: companies[index].termsNotice,
            invoicePrefix: companies[index].invoicePrefix,
            salesOrderPrefix: companies[index].salesOrderPrefix
          };
          invUpdated = true;
        }
      });
      if (invUpdated) {
        writeJson('invoices.json', invoices);
      }

      if (companies[index].isDefault) {
        const settings = readJson('settings.json', {});
        writeJson('settings.json', {
          ...settings,
          companyName: companies[index].name,
          tagline: companies[index].tagline,
          address: companies[index].address,
          phone: companies[index].phone,
          email: companies[index].email,
          invoicePrefix: companies[index].invoicePrefix,
          salesOrderPrefix: companies[index].salesOrderPrefix,
          termsNotice: companies[index].termsNotice,
          logo: companies[index].logo
        });
      }

      return sendJson(res, 200, companies[index]);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/companies/') && method === 'DELETE') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'companies.manage') && !userCan(currentUser, 'settings.edit')) {
      return sendJson(res, 403, { error: 'Permission denied: companies.manage required' });
    }

    const id = pathname.replace('/api/companies/', '');
    const companies = readJson('companies.json', []);
    const index = companies.findIndex(c => c.id === id);

    if (index === -1) {
      return sendJson(res, 404, { error: 'Company not found' });
    }

    if (companies.length <= 1) {
      return sendJson(res, 400, { error: 'Cannot delete the only remaining company profile' });
    }

    if (companies[index].isDefault) {
      return sendJson(res, 400, { error: 'Cannot delete default company. Set another company as default first.' });
    }

    const [deleted] = companies.splice(index, 1);
    writeJson('companies.json', companies);
    return sendJson(res, 200, { success: true, message: `Company '${deleted.name}' deleted successfully` });
  }

  // Dashboard statistics
  if (pathname === '/api/stats' && method === 'GET') {
    const currentUser = getAuthUser(req);
    if (!currentUser) return sendJson(res, 401, { error: 'Unauthenticated' });
    if (!userCan(currentUser, 'reports.view')) {
      return sendJson(res, 403, { error: 'Permission denied: reports.view required' });
    }
    const invoices = readJson('invoices.json', []);
    const users = readJson('users.json', []);
    const products = readJson('products.json', []);
    const trash = readJson('trash.json', []);

    const totalInvoices = invoices.length;
    let totalSales = 0;
    let totalDue = 0;
    let totalReceived = 0;

    invoices.forEach(inv => {
      totalSales += Number(inv.netPayableAmount || 0);
      totalDue += Number(inv.closingBalance || 0);
      totalReceived += Number(inv.receivedAmount || 0);
    });

    return sendJson(res, 200, {
      totalInvoices,
      totalSales,
      totalDue,
      totalReceived,
      totalUsers: users.length,
      totalProducts: products.length,
      totalTrash: trash.length
    });
  }

  // API Route Fallback (Never serve HTML for API requests!)
  if (pathname.startsWith('/api') || pathname.includes('/api/')) {
    return sendJson(res, 404, { error: `Endpoint not found: ${method} ${pathname}` });
  }

  // Static file serving
  let cleanStaticPath = pathname;
  if (cleanStaticPath === '/' || !path.extname(cleanStaticPath)) {
    cleanStaticPath = 'index.html';
  } else {
    cleanStaticPath = path.basename(cleanStaticPath);
  }

  let filePath = path.join(PUBLIC_DIR, cleanStaticPath);

  // Security: Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Server Error');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      res.end(content);
    });
  });
});

const startCallback = () => {
  console.log(`Server listening on ${HOST || '0.0.0.0'}:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
};

// Automatic port / passenger binding
if (typeof PhusionPassenger !== 'undefined') {
  // cPanel CloudLinux Phusion Passenger Engine
  PhusionPassenger.configure({ autoInstall: false });
  server.listen('passenger', startCallback);
} else if (typeof PORT === 'string' && (PORT.startsWith('/') || PORT.startsWith('\\\\.\\pipe'))) {
  // Passenger Unix socket or Windows named pipe
  server.listen(PORT, startCallback);
} else if (HOST) {
  server.listen(PORT, HOST, startCallback);
} else {
  // Standard cPanel, cloud, or local auto-bound port
  server.listen(PORT, startCallback);
}

// Global Exception Logging for cPanel debugging
process.on('uncaughtException', (err) => {
  const msg = `[${new Date().toISOString()}] Uncaught Exception: ${err.stack || err}\n`;
  console.error(msg);
  try { fs.appendFileSync(path.join(__dirname, 'cpanel_error.log'), msg); } catch (e) {}
});

process.on('unhandledRejection', (reason) => {
  const msg = `[${new Date().toISOString()}] Unhandled Rejection: ${reason && reason.stack ? reason.stack : reason}\n`;
  console.error(msg);
  try { fs.appendFileSync(path.join(__dirname, 'cpanel_error.log'), msg); } catch (e) {}
});

// Graceful shutdown handling for Docker, PM2, and systemd
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed cleanly.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Force shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
