(() => {
  'use strict';

  const CONFIG = window.AFTER_HOURS_CONFIG || {};
  const PUBLIC_SUPABASE_KEY = CONFIG.supabasePublishableKey || CONFIG.supabaseAnonKey || '';
  const SUPABASE_CONFIGURED = Boolean(CONFIG.supabaseUrl && PUBLIC_SUPABASE_KEY);
  const HAS_SUPABASE = Boolean(SUPABASE_CONFIGURED && window.supabase);
  const DEMO_MODE = CONFIG.demoMode === true || (CONFIG.demoMode !== false && !HAS_SUPABASE);
  const SUPABASE_SETUP_ERROR = !DEMO_MODE && !HAS_SUPABASE
    ? (!SUPABASE_CONFIGURED
        ? 'Supabase ist nicht vollständig konfiguriert. Bitte URL und Publishable Key in assets/js/config.js prüfen.'
        : 'Supabase konnte nicht geladen werden. Bitte Internetverbindung, CDN-Zugriff oder Browser-Konsole prüfen.')
    : '';
  const supabaseClient = HAS_SUPABASE
    ? window.supabase.createClient(CONFIG.supabaseUrl, PUBLIC_SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const PERMISSION = {
    ORDERS_CREATE: 'orders.create',
    ORDERS_VIEW: 'orders.view',
    ORDERS_CANCEL: 'orders.cancel',
    ORDERS_REFUND: 'orders.refund',
    MENUS_MANAGE: 'menus.manage',
    INGREDIENTS_MANAGE: 'ingredients.manage',
    STOCK_MANAGE: 'stock.manage',
    ORGANIZATIONS_MANAGE: 'organizations.manage',
    DISCOUNTS_USE: 'discounts.use',
    DISCOUNTS_MANAGE: 'discounts.manage',
    EMPLOYEES_MANAGE: 'employees.manage',
    SETTINGS_MANAGE: 'settings.manage',
    AUDIT_VIEW: 'audit.view',
    NOTICES_MANAGE: 'notices.manage'
  };

  const ROLE_LABELS = {
    owner: 'Inhaber',
    administrator: 'Administrator',
    shift_lead: 'Schichtleitung',
    cashier: 'Kassenmitarbeiter',
    inventory: 'Lagerverwaltung'
  };

  const ROLE_PERMISSIONS = {
    owner: Object.values(PERMISSION),
    administrator: Object.values(PERMISSION),
    shift_lead: [
      PERMISSION.ORDERS_CREATE, PERMISSION.ORDERS_VIEW, PERMISSION.ORDERS_CANCEL,
      PERMISSION.MENUS_MANAGE, PERMISSION.INGREDIENTS_MANAGE, PERMISSION.STOCK_MANAGE,
      PERMISSION.ORGANIZATIONS_MANAGE, PERMISSION.DISCOUNTS_USE,
      PERMISSION.AUDIT_VIEW, PERMISSION.NOTICES_MANAGE
    ],
    cashier: [PERMISSION.ORDERS_CREATE, PERMISSION.ORDERS_VIEW, PERMISSION.DISCOUNTS_USE],
    inventory: [PERMISSION.INGREDIENTS_MANAGE, PERMISSION.STOCK_MANAGE, PERMISSION.MENUS_MANAGE, PERMISSION.AUDIT_VIEW]
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clone = value => JSON.parse(JSON.stringify(value));
  const requireSupabaseClient = () => {
    if (!supabaseClient) throw new Error(SUPABASE_SETUP_ERROR || 'Supabase ist nicht verfügbar.');
    return supabaseClient;
  };
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nowIso = () => new Date().toISOString();
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const fmtCurrency = value => new Intl.NumberFormat(CONFIG.locale || 'de-DE', {
    style: 'currency', currency: state?.data?.settings?.currency || CONFIG.currency || 'USD'
  }).format(Number(value || 0));
  const fmtDate = value => new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const fmtNumber = value => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(Number(value || 0));
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials = name => String(name || 'M').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

  const initialDemoData = {
    currentUser: {
      id: 'demo-owner', username: 'inhaber', email: 'inhaber@afterhours.local',
      full_name: 'André Kasper', role: 'owner', permissions: [], active: true, must_change_password: false
    },
    settings: {
      company_name: 'THE AFTER HOURS', currency: 'USD', default_tax_rate: 10,
      address: 'Los Santos', contact_email: 'info@the-after-hours.local', phone: '',
      order_prefix: 'AH', next_order_number: 1048,
      payment_methods: ['cash', 'card'], sales_locations: ['Hauptkasse', 'Bar', 'Terrasse'],
      categories: ['Burger', 'Snacks', 'Getränke', 'Cocktails', 'Desserts'],
      tip_rules: 'Trinkgeld wird separat ausgewiesen und dem zuständigen Mitarbeiter zugeordnet.'
    },
    ingredients: [
      { id:'ing-1', name:'Burgerbrötchen', category:'Backwaren', purchase_price:0.45, sale_price:0, organization_discount:0, stock:32, min_stock:20, unit:'Stück', consumable:true, producible:false, active:true, updated_at:nowIso() },
      { id:'ing-2', name:'Fleisch-Patty', category:'Fleisch', purchase_price:1.80, sale_price:3.50, organization_discount:0, stock:18, min_stock:20, unit:'Stück', consumable:true, producible:false, active:true, updated_at:nowIso() },
      { id:'ing-3', name:'Cheddar', category:'Molkerei', purchase_price:0.30, sale_price:1.00, organization_discount:0, stock:42, min_stock:15, unit:'Scheibe', consumable:true, producible:false, active:true, updated_at:nowIso() },
      { id:'ing-4', name:'Salatportion', category:'Gemüse', purchase_price:0.35, sale_price:1.20, organization_discount:0, stock:12, min_stock:15, unit:'Portion', consumable:true, producible:true, active:true, updated_at:nowIso() },
      { id:'ing-5', name:'Haussauce', category:'Saucen', purchase_price:0.20, sale_price:0.80, organization_discount:0, stock:24, min_stock:10, unit:'Portion', consumable:true, producible:true, active:true, updated_at:nowIso() },
      { id:'ing-6', name:'Kartoffeln', category:'Gemüse', purchase_price:0.90, sale_price:2.50, organization_discount:0, stock:8, min_stock:12, unit:'kg', consumable:true, producible:false, active:true, updated_at:nowIso() },
      { id:'ing-7', name:'Cola Sirup', category:'Getränke', purchase_price:1.25, sale_price:3.50, organization_discount:0, stock:22, min_stock:8, unit:'Liter', consumable:true, producible:false, active:true, updated_at:nowIso() }
    ],
    menus: [
      { id:'menu-1', name:'After Hours Burger', description:'Rindfleisch, Cheddar, Salat und Haussauce', category:'Burger', image_url:'', purchase_price:3.10, sale_price:12.90, tax_rate:10, organization_discount:0, available_quantity:18, active:true, producible:true, recipe:[{ingredient_id:'ing-1',quantity:1},{ingredient_id:'ing-2',quantity:1},{ingredient_id:'ing-3',quantity:1},{ingredient_id:'ing-4',quantity:1},{ingredient_id:'ing-5',quantity:1}] },
      { id:'menu-2', name:'Midnight Fries', description:'Knusprige Pommes mit Meersalz', category:'Snacks', image_url:'', purchase_price:1.10, sale_price:5.50, tax_rate:10, organization_discount:0, available_quantity:16, active:true, producible:true, recipe:[{ingredient_id:'ing-6',quantity:0.5}] },
      { id:'menu-3', name:'Cola', description:'Eisgekühlt, 0,4 l', category:'Getränke', image_url:'', purchase_price:0.55, sale_price:3.50, tax_rate:10, organization_discount:0, available_quantity:55, active:true, producible:true, recipe:[{ingredient_id:'ing-7',quantity:0.08}] },
      { id:'menu-4', name:'Night Shift Combo', description:'Burger, Pommes und Softdrink', category:'Menüangebote', image_url:'', purchase_price:4.75, sale_price:18.90, tax_rate:10, organization_discount:0, available_quantity:16, active:true, producible:true, recipe:[{ingredient_id:'ing-1',quantity:1},{ingredient_id:'ing-2',quantity:1},{ingredient_id:'ing-3',quantity:1},{ingredient_id:'ing-4',quantity:1},{ingredient_id:'ing-5',quantity:1},{ingredient_id:'ing-6',quantity:0.5},{ingredient_id:'ing-7',quantity:0.08}] }
    ],
    organizations: [
      { id:'org-1', name:'Los Santos Police Department', contact_person:'Chief Johnson', phone:'555-0101', email:'kontakt@lspd.local', discount_type:'percent', discount_value:15, active:true, notes:'Rabatt nur mit Dienstausweis.' },
      { id:'org-2', name:'Emergency Medical Services', contact_person:'Leitung EMS', phone:'555-0102', email:'kontakt@ems.local', discount_type:'percent', discount_value:10, active:true, notes:'' },
      { id:'org-3', name:'Downtown Cab Co.', contact_person:'Disposition', phone:'555-0103', email:'cab@ls.local', discount_type:'fixed', discount_value:2, active:true, notes:'Maximal ein Rabatt pro Bestellung.' }
    ],
    employees: [
      { id:'demo-owner', username:'inhaber', email:'inhaber@afterhours.local', full_name:'André Kasper', role:'owner', permissions:[], active:true, must_change_password:false, created_at:nowIso() },
      { id:'emp-2', username:'mia', email:'mia@afterhours.local', full_name:'Mia Schneider', role:'shift_lead', permissions:[], active:true, must_change_password:false, created_at:nowIso() },
      { id:'emp-3', username:'lukas', email:'lukas@afterhours.local', full_name:'Lukas Weber', role:'cashier', permissions:[], active:true, must_change_password:false, created_at:nowIso() }
    ],
    orders: [
      { id:'ord-1', order_number:'AH-1047', sales_location:'Hauptkasse', organization_id:null, organization_name:'', discount_amount:0, subtotal:18.90, tax_amount:1.72, total:18.90, received_amount:20, change_amount:1.10, payment_method:'cash', tip:0, employee_id:'emp-2', employee_name:'Mia Schneider', status:'completed', created_at:new Date(Date.now()-1000*60*22).toISOString(), items:[{type:'menu',reference_id:'menu-4',name:'Night Shift Combo',quantity:1,unit_price:18.90,tax_rate:10}] },
      { id:'ord-2', order_number:'AH-1046', sales_location:'Bar', organization_id:'org-1', organization_name:'Los Santos Police Department', discount_amount:1.94, subtotal:12.90, tax_amount:1.00, total:10.96, received_amount:10.96, change_amount:0, payment_method:'card', tip:2, employee_id:'demo-owner', employee_name:'André Kasper', status:'completed', created_at:new Date(Date.now()-1000*60*48).toISOString(), items:[{type:'menu',reference_id:'menu-1',name:'After Hours Burger',quantity:1,unit_price:12.90,tax_rate:10}] },
      { id:'ord-3', order_number:'AH-1045', sales_location:'Terrasse', organization_id:null, organization_name:'', discount_amount:0, subtotal:7, tax_amount:.64, total:7, received_amount:10, change_amount:3, payment_method:'cash', tip:1, employee_id:'emp-3', employee_name:'Lukas Weber', status:'open', created_at:new Date(Date.now()-1000*60*83).toISOString(), items:[{type:'menu',reference_id:'menu-3',name:'Cola',quantity:2,unit_price:3.50,tax_rate:10}] }
    ],
    stockMovements: [],
    notices: [
      { id:'notice-1', title:'Wochenend-Schichtplan', body:'Bitte prüft eure eingetragenen Schichten bis Freitagabend.', author_name:'André Kasper', created_at:new Date(Date.now()-86400000).toISOString() },
      { id:'notice-2', title:'Lagerkontrolle', body:'Fleisch-Pattys und Salat werden heute nachbestellt.', author_name:'Mia Schneider', created_at:new Date(Date.now()-3600000*5).toISOString() }
    ],
    audit: [
      { id:'audit-1', employee_name:'André Kasper', action:'settings.updated', entity_type:'settings', entity_name:'Standardsteuersatz', details:'Standardsteuersatz auf 10 % gesetzt.', created_at:new Date(Date.now()-86400000*2).toISOString() }
    ]
  };

  class DemoRepository {
    constructor() {
      const stored = localStorage.getItem('after-hours-demo-data-v1');
      this.data = stored ? JSON.parse(stored) : clone(initialDemoData);
      this.session = localStorage.getItem('after-hours-demo-session') === 'true';
    }
    save() { localStorage.setItem('after-hours-demo-data-v1', JSON.stringify(this.data)); }
    async signIn(identifier, password) {
      if (!identifier || !password) throw new Error('Bitte Benutzername und Passwort eingeben.');
      const employee = this.data.employees.find(e => e.active && (e.username.toLowerCase() === identifier.toLowerCase() || e.email.toLowerCase() === identifier.toLowerCase()));
      if (!employee) throw new Error('Benutzerkonto wurde nicht gefunden oder ist deaktiviert.');
      if (password !== 'afterhours' && password !== 'demo') throw new Error('Im Demo-Modus lautet das Passwort „afterhours“.');
      this.data.currentUser = clone(employee);
      this.session = true;
      localStorage.setItem('after-hours-demo-session', 'true');
      this.save();
      return employee;
    }
    async signOut() { this.session = false; localStorage.removeItem('after-hours-demo-session'); }
    async getSession() { return this.session ? { user: this.data.currentUser } : null; }
    async getCurrentUser() { return clone(this.data.currentUser); }
    async updatePassword() { this.data.currentUser.must_change_password = false; this.save(); }
    async loadAll() { return clone(this.data); }
    async saveEntity(entity, record) {
      const list = this.data[entity];
      const timestamp = nowIso();
      if (record.id) {
        const index = list.findIndex(item => item.id === record.id);
        if (index < 0) throw new Error('Datensatz nicht gefunden.');
        list[index] = { ...list[index], ...record, updated_at: timestamp };
        this.audit(`${entity}.updated`, entity, list[index].name || list[index].full_name || list[index].order_number, `Datensatz wurde bearbeitet.`);
        this.save();
        return clone(list[index]);
      }
      const created = { ...record, id: uid(), created_at: timestamp, updated_at: timestamp };
      list.unshift(created);
      this.audit(`${entity}.created`, entity, created.name || created.full_name || '', 'Datensatz wurde erstellt.');
      this.save();
      return clone(created);
    }
    async createOrder(payload) {
      const number = `${this.data.settings.order_prefix}-${this.data.settings.next_order_number++}`;
      const normalizedItems = payload.items.map(item => {
        if (item.type !== 'menu') return { ...item, stock_usage:[{ ingredient_id:item.reference_id, name:item.name, quantity:item.quantity }] };
        const menu = this.data.menus.find(m => m.id === item.reference_id);
        return { ...item, stock_usage:(menu?.recipe || []).map(recipe => ({ ingredient_id:recipe.ingredient_id, name:this.data.ingredients.find(i=>i.id===recipe.ingredient_id)?.name || '', quantity:recipe.quantity * item.quantity })) };
      });
      const order = {
        ...payload, items:normalizedItems, id: uid(), order_number: number, employee_id: this.data.currentUser.id,
        employee_name: this.data.currentUser.full_name, status: 'completed', created_at: nowIso()
      };
      this.applyStock(order.items, -1, order.id, `Verkauf ${number}`);
      this.data.orders.unshift(order);
      this.audit('order.created', 'order', number, `Bestellung über ${fmtCurrency(order.total)} aufgenommen.`);
      this.save();
      return clone(order);
    }
    applyStock(items, direction, orderId, reason) {
      items.forEach(item => {
        if (Array.isArray(item.stock_usage) && item.stock_usage.length) {
          item.stock_usage.forEach(usage => this.adjustIngredientStock(usage.ingredient_id, direction * usage.quantity, reason, orderId));
        } else if (item.type === 'menu') {
          const menu = this.data.menus.find(m => m.id === item.reference_id);
          (menu?.recipe || []).forEach(recipe => this.adjustIngredientStock(recipe.ingredient_id, direction * recipe.quantity * item.quantity, reason, orderId));
        } else {
          this.adjustIngredientStock(item.reference_id, direction * item.quantity, reason, orderId);
        }
      });
    }
    adjustIngredientStock(id, quantity, reason, orderId = null) {
      const ingredient = this.data.ingredients.find(i => i.id === id);
      if (!ingredient) return;
      ingredient.stock = Number((Number(ingredient.stock) + Number(quantity)).toFixed(3));
      ingredient.updated_at = nowIso();
      this.data.stockMovements.unshift({ id:uid(), ingredient_id:id, ingredient_name:ingredient.name, quantity, reason, order_id:orderId, employee_name:this.data.currentUser.full_name, created_at:nowIso() });
    }
    async changeStock(ingredientId, quantity, reason) {
      this.adjustIngredientStock(ingredientId, Number(quantity), reason);
      const ingredient = this.data.ingredients.find(i => i.id === ingredientId);
      this.audit('stock.changed', 'ingredient', ingredient?.name, `${quantity > 0 ? '+' : ''}${quantity} – ${reason}`);
      this.save();
    }
    async cancelOrder(orderId, status, reason) {
      const order = this.data.orders.find(o => o.id === orderId);
      if (!order) throw new Error('Bestellung nicht gefunden.');
      if (!['open', 'completed'].includes(order.status)) throw new Error('Diese Bestellung kann nicht erneut storniert werden.');
      this.applyStock(order.items, 1, order.id, `${status === 'refunded' ? 'Rückerstattung' : 'Stornierung'} ${order.order_number}`);
      order.status = status;
      order.cancellation_reason = reason;
      order.updated_at = nowIso();
      this.audit(`order.${status}`, 'order', order.order_number, reason || 'Keine Begründung angegeben.');
      this.save();
    }
    async createEmployee(payload) {
      const email = payload.email || `${payload.username}@afterhours.local`;
      return this.saveEntity('employees', { ...payload, email, must_change_password:true, permissions:payload.permissions || [] });
    }
    async updateSettings(settings) {
      this.data.settings = { ...this.data.settings, ...settings };
      this.audit('settings.updated', 'settings', 'Systemeinstellungen', 'Einstellungen wurden gespeichert.');
      this.save();
    }
    audit(action, entityType, entityName, details) {
      this.data.audit.unshift({ id:uid(), employee_name:this.data.currentUser.full_name, action, entity_type:entityType, entity_name:entityName || '', details, created_at:nowIso() });
    }
    reset() { localStorage.removeItem('after-hours-demo-data-v1'); location.reload(); }
  }

  class SupabaseRepository {
    async signIn(identifier, password) {
      const supabaseClient = requireSupabaseClient();
      const email = identifier.includes('@') ? identifier : `${identifier}@afterhours.local`;
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.user;
    }
    async signOut() { const supabaseClient = requireSupabaseClient(); const { error } = await supabaseClient.auth.signOut(); if (error) throw error; }
    async getSession() { const supabaseClient = requireSupabaseClient(); const { data } = await supabaseClient.auth.getSession(); return data.session; }
    async getCurrentUser() {
      const supabaseClient = requireSupabaseClient();
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !userData.user) throw userError || new Error('Nicht angemeldet.');
      const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userData.user.id).single();
      if (error) throw error;
      return data;
    }
    async updatePassword(password) {
      const supabaseClient = requireSupabaseClient();
      const { error: passwordError } = await supabaseClient.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      const { error: profileError } = await supabaseClient.rpc('complete_first_login');
      if (profileError) throw profileError;
    }
    async loadAll() {
      const supabaseClient = requireSupabaseClient();
      const tables = ['profiles','settings','ingredients','menus','organizations','orders','notices','audit_logs','stock_movements'];
      const results = await Promise.all(tables.map(async table => {
        let query = supabaseClient.from(table).select('*');
        if (['orders','notices','audit_logs','stock_movements'].includes(table)) query = query.order('created_at', { ascending:false }).limit(table === 'audit_logs' ? 250 : 100);
        const { data, error } = await query;
        if (error) throw error;
        return [table, data];
      }));
      const map = Object.fromEntries(results);
      const { data: userData } = await supabaseClient.auth.getUser();
      const currentUser = map.profiles.find(p => p.id === userData.user.id);
      const menuIds = map.menus.map(m => m.id);
      let recipes = [];
      if (menuIds.length) {
        const { data, error } = await supabaseClient.from('menu_ingredients').select('*').in('menu_id', menuIds);
        if (error) throw error;
        recipes = data;
      }
      return {
        currentUser,
        settings: map.settings.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {}),
        ingredients: map.ingredients,
        menus: map.menus.map(menu => ({ ...menu, recipe: recipes.filter(r => r.menu_id === menu.id) })),
        organizations: map.organizations,
        employees: map.profiles,
        orders: map.orders,
        notices: map.notices,
        audit: map.audit_logs,
        stockMovements: map.stock_movements
      };
    }
    async saveEntity(entity, record) {
      const tableMap = { menus:'menus', ingredients:'ingredients', organizations:'organizations', notices:'notices' };
      const table = tableMap[entity];
      if (!table) throw new Error('Nicht unterstützter Datensatz.');
      const recipe = entity === 'menus' ? record.recipe : null;
      const payload = { ...record };
      delete payload.recipe;
      delete payload.created_at;
      delete payload.updated_at;
      let result;
      if (payload.id) {
        const id = payload.id; delete payload.id;
        if (entity === 'ingredients') delete payload.stock;
        result = await supabaseClient.from(table).update(payload).eq('id', id).select().single();
        payload.id = id;
      } else {
        delete payload.id;
        result = await supabaseClient.from(table).insert(payload).select().single();
      }
      if (result.error) throw result.error;
      if (entity === 'menus' && recipe) {
        const { error: delError } = await supabaseClient.from('menu_ingredients').delete().eq('menu_id', result.data.id);
        if (delError) throw delError;
        if (recipe.length) {
          const rows = recipe.map(r => ({ menu_id:result.data.id, ingredient_id:r.ingredient_id, quantity:Number(r.quantity) }));
          const { error: recipeError } = await supabaseClient.from('menu_ingredients').insert(rows);
          if (recipeError) throw recipeError;
        }
      }
      return result.data;
    }
    async createOrder(payload) {
      const { data, error } = await supabaseClient.rpc('create_order', { p_payload:payload });
      if (error) throw error;
      return data;
    }
    async changeStock(ingredientId, quantity, reason) {
      const { error } = await supabaseClient.rpc('change_stock', { p_ingredient_id:ingredientId, p_quantity:Number(quantity), p_reason:reason });
      if (error) throw error;
    }
    async cancelOrder(orderId, status, reason) {
      const { error } = await supabaseClient.rpc('cancel_order', { p_order_id:orderId, p_new_status:status, p_reason:reason });
      if (error) throw error;
    }
    async createEmployee(payload) {
      const { data, error } = await supabaseClient.functions.invoke('create-employee', { body:payload });
      if (error) throw new Error(`${error.message || 'Edge Function konnte nicht erreicht werden.'} Bitte create-employee in Supabase Edge Functions deployen.`);
      if (data?.error) throw new Error(data.error);
      return data;
    }
    async updateEmployee(payload) {
      const { data, error } = await supabaseClient.functions.invoke('update-employee', { body:payload });
      if (error) throw new Error(`${error.message || 'Edge Function konnte nicht erreicht werden.'} Bitte update-employee in Supabase Edge Functions deployen.`);
      if (data?.error) throw new Error(data.error);
      return data;
    }
    async uploadProductImage(file) {
      const extension = (file.name.split('.').pop() || 'webp').toLowerCase();
      const path = `menus/${uid()}.${extension}`;
      const { error } = await supabaseClient.storage.from('product-images').upload(path, file, { cacheControl:'3600', upsert:false });
      if (error) throw error;
      const { data } = supabaseClient.storage.from('product-images').getPublicUrl(path);
      return data.publicUrl;
    }
    async updateSettings(settings) {
      const rows = Object.entries(settings).map(([key,value]) => ({ key, value }));
      const { error } = await supabaseClient.from('settings').upsert(rows, { onConflict:'key' });
      if (error) throw error;
    }
  }

  const repository = DEMO_MODE ? new DemoRepository() : new SupabaseRepository();
  const state = {
    data: null,
    page: 'dashboard',
    filters: {},
    cart: [],
    currentOrderOrganization: null,
    currentPaymentMethod: 'cash'
  };

  function hasPermission(permission) {
    const user = state.data?.currentUser;
    if (!user) return false;
    return (ROLE_PERMISSIONS[user.role] || []).includes(permission) || (user.permissions || []).includes(permission);
  }

  function toast(message, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    $('#toastHost').appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function showLogin() {
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    $('#passwordView').classList.add('hidden');
    if (DEMO_MODE) $('#loginHint').innerHTML = 'Demo-Zugang: <strong>inhaber</strong> / <strong>afterhours</strong><br>Keine öffentliche Registrierung.';
    else $('#loginHint').textContent = SUPABASE_SETUP_ERROR || 'Keine öffentliche Registrierung. Konten werden durch die Inhaber angelegt.';
  }

  async function enterApp() {
    const currentUser = await repository.getCurrentUser();
    if (!currentUser || currentUser.active === false) {
      await repository.signOut();
      throw new Error('Dieses Mitarbeiterkonto ist deaktiviert.');
    }
    state.data = {
      currentUser, settings: {}, ingredients: [], menus: [], organizations: [],
      employees: [], orders: [], notices: [], audit: [], stockMovements: []
    };
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    updateEmployeeUi();
    applyPermissionVisibility();
    navigate('dashboard');
    if (currentUser.must_change_password) {
      $('#passwordView').classList.remove('hidden');
      return;
    }
    await reloadData();
    navigate('dashboard');
  }

  function updateEmployeeUi() {
    const user = state.data.currentUser;
    $('#employeeName').textContent = user.full_name || user.username;
    $('#employeeRole').textContent = ROLE_LABELS[user.role] || user.role;
    $('#employeeAvatar').textContent = initials(user.full_name || user.username);
  }

  function applyPermissionVisibility() {
    $$('.permission-admin').forEach(el => el.classList.toggle('hidden', !hasPermission(PERMISSION.EMPLOYEES_MANAGE)));
    $$('.permission-audit').forEach(el => el.classList.toggle('hidden', !hasPermission(PERMISSION.AUDIT_VIEW)));
    $$('.permission-settings').forEach(el => el.classList.toggle('hidden', !hasPermission(PERMISSION.SETTINGS_MANAGE)));
    $('#quickOrderButton').classList.toggle('hidden', !hasPermission(PERMISSION.ORDERS_CREATE));
  }

  const pageMeta = {
    dashboard:['ÜBERSICHT','Dashboard'], orders:['VERKAUF','Bestellungen'], menus:['SORTIMENT','Menüs'],
    ingredients:['LAGER','Zutaten'], organizations:['KUNDENGRUPPEN','Organisationen'], employees:['ZUGRIFF','Mitarbeiter'],
    audit:['SICHERHEIT','Protokoll'], settings:['KONFIGURATION','Einstellungen']
  };

  function navigate(page) {
    state.page = page;
    $$('.nav-item[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    const [eyebrow,title] = pageMeta[page];
    $('#pageEyebrow').textContent = eyebrow;
    $('#pageTitle').textContent = title;
    $('#sidebar').classList.remove('open');
    renderPage();
  }

  function renderPage() {
    const content = $('#pageContent');
    const renderers = {
      dashboard: renderDashboard, orders: renderOrders, menus: renderMenus,
      ingredients: renderIngredients, organizations: renderOrganizations,
      employees: renderEmployees, audit: renderAudit, settings: renderSettings
    };
    content.innerHTML = '';
    renderers[state.page]?.(content);
    updateBadges();
  }

  function updateBadges() {
    const open = state.data.orders.filter(o => o.status === 'open').length;
    const low = state.data.ingredients.filter(i => i.active && Number(i.stock) <= Number(i.min_stock)).length;
    $('#openOrdersBadge').textContent = open;
    $('#lowStockBadge').textContent = low;
  }

  function renderDashboard(content) {
    content.appendChild($('#dashboardTemplate').content.cloneNode(true));
    const userFirst = (state.data.currentUser.full_name || state.data.currentUser.username).split(' ')[0];
    $('[data-bind="firstName"]', content).textContent = userFirst;
    const orders = state.data.orders.filter(o => o.created_at.slice(0,10) === todayKey());
    const completed = orders.filter(o => o.status === 'completed');
    const revenue = completed.reduce((sum,o) => sum + Number(o.total), 0);
    const tips = completed.reduce((sum,o) => sum + Number(o.tip || 0), 0);
    const cashOrders = completed.filter(o => o.payment_method === 'cash');
    const cardOrders = completed.filter(o => o.payment_method === 'card');
    const cashRevenue = cashOrders.reduce((sum,o) => sum + Number(o.total), 0);
    const cardRevenue = cardOrders.reduce((sum,o) => sum + Number(o.total), 0);
    $('#statRevenue').textContent = fmtCurrency(revenue);
    $('#statOrders').textContent = orders.length;
    $('#statOpenOrders').textContent = `${orders.filter(o=>o.status==='open').length} offen · ${orders.filter(o=>['cancelled','refunded'].includes(o.status)).length} storniert`;
    $('#statPaymentSplit').textContent = `${cashOrders.length} / ${cardOrders.length}`;
    $('#statTips').textContent = fmtCurrency(tips);
    $('#cashRevenue').textContent = fmtCurrency(cashRevenue);
    $('#cardRevenue').textContent = fmtCurrency(cardRevenue);
    const totalPayment = Math.max(cashRevenue + cardRevenue, 1);
    $('#cashProgress').style.width = `${cashRevenue / totalPayment * 100}%`;
    $('#cardProgress').style.width = `${cardRevenue / totalPayment * 100}%`;

    const recent = state.data.orders.slice(0,5);
    $('#recentOrders').innerHTML = recent.length ? orderTable(recent, true) : emptyState('Noch keine Bestellungen','Sobald eine Bestellung aufgenommen wurde, erscheint sie hier.');
    const low = state.data.ingredients.filter(i => i.active && Number(i.stock) <= Number(i.min_stock)).sort((a,b) => a.stock-a.stock).slice(0,5);
    $('#lowStockCount').textContent = `${low.length} Artikel`;
    $('#lowStockList').innerHTML = low.length ? low.map(item => {
      const pct = Math.min(100, Math.max(4, Number(item.stock) / Math.max(Number(item.min_stock),1) * 100));
      return `<div class="stock-item"><div><strong>${escapeHtml(item.name)}</strong><small>${fmtNumber(item.stock)} / Min. ${fmtNumber(item.min_stock)} ${escapeHtml(item.unit)}</small></div><div class="meter"><i style="width:${pct}%"></i></div></div>`;
    }).join('') : `<div class="empty-state"><strong>Alles aufgefüllt</strong>Keine niedrigen Lagerbestände.</div>`;
    $('#noticeList').innerHTML = state.data.notices.slice(0,4).map(n => `<div class="notice-item"><div><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.author_name || '')} · ${fmtDate(n.created_at)}</small></div><p>${escapeHtml(n.body)}</p></div>`).join('') || emptyState('Keine Mitteilungen','Das schwarze Brett ist derzeit leer.');
    const addNotice = $('#addNoticeButton');
    addNotice?.classList.toggle('hidden', !hasPermission(PERMISSION.NOTICES_MANAGE));
    addNotice?.addEventListener('click', () => openNoticeModal());
    $$('[data-navigate]', content).forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.navigate)));
    startClock();
  }

  function startClock() {
    clearInterval(window.__ahClock);
    const tick = () => {
      const now = new Date();
      if ($('#liveClock')) $('#liveClock').textContent = now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      if ($('#liveDate')) $('#liveDate').textContent = now.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
    };
    tick(); window.__ahClock = setInterval(tick, 1000);
  }

  function renderOrders(content) {
    content.innerHTML = `
      <section class="page-stack">
        <div class="page-toolbar">
          <div class="search-row"><input id="orderSearch" placeholder="Bestellnummer, Mitarbeiter oder Verkaufsort suchen"><select id="orderStatus" class="filter-select"><option value="">Alle Status</option><option value="open">Offen</option><option value="completed">Abgeschlossen</option><option value="cancelled">Storniert</option><option value="refunded">Zurückerstattet</option></select></div>
          ${hasPermission(PERMISSION.ORDERS_CREATE) ? '<button id="newOrderButton" class="button button--primary">＋ Neue Bestellung</button>' : ''}
        </div>
        <div class="data-panel"><div class="data-panel-header"><h3>Bestellverlauf</h3><span class="muted">${state.data.orders.length} Einträge</span></div><div id="ordersTable" class="table-wrap"></div></div>
      </section>`;
    const rerender = () => {
      const search = $('#orderSearch').value.toLowerCase();
      const status = $('#orderStatus').value;
      const filtered = state.data.orders.filter(o => (!status || o.status === status) && [o.order_number,o.employee_name,o.sales_location,o.organization_name].some(v => String(v||'').toLowerCase().includes(search)));
      $('#ordersTable').innerHTML = filtered.length ? orderTable(filtered, false) : emptyState('Keine Bestellungen gefunden','Passe die Suche oder den Statusfilter an.');
      bindOrderActions();
    };
    $('#orderSearch').addEventListener('input', rerender);
    $('#orderStatus').addEventListener('change', rerender);
    $('#newOrderButton')?.addEventListener('click', openOrderModal);
    rerender();
  }

  function orderTable(orders, compact) {
    return `<table><thead><tr><th>Bestellung</th><th>Verkaufsort</th><th>Gesamt</th><th>Zahlung</th>${compact?'':'<th>Rabatt</th><th>Erhalten</th><th>Rückgeld</th><th>Trinkgeld</th><th>Mitarbeiter</th><th>Datum</th><th>Status</th><th></th>'}</tr></thead><tbody>${orders.map(o => `
      <tr><td><strong>${escapeHtml(o.order_number)}</strong>${o.organization_name?`<br><small class="muted">${escapeHtml(o.organization_name)}</small>`:''}</td><td>${escapeHtml(o.sales_location)}</td><td><strong>${fmtCurrency(o.total)}</strong></td><td>${o.payment_method==='cash'?'Bar':'Karte'}</td>${compact?'':`<td>${fmtCurrency(o.discount_amount)}</td><td>${fmtCurrency(o.received_amount)}</td><td>${fmtCurrency(o.change_amount)}</td><td>${fmtCurrency(o.tip)}</td><td>${escapeHtml(o.employee_name||'')}</td><td>${fmtDate(o.created_at)}</td><td>${statusPill(o.status)}</td><td><div class="table-actions"><button class="icon-button" data-view-order="${o.id}" title="Details">⌕</button>${['open','completed'].includes(o.status)&&hasPermission(PERMISSION.ORDERS_CANCEL)?`<button class="icon-button" data-cancel-order="${o.id}" title="Stornieren">×</button>`:''}</div></td>`}</tr>`).join('')}</tbody></table>`;
  }

  function statusPill(status) {
    const map = { open:['warning','Offen'], completed:['success','Abgeschlossen'], cancelled:['danger','Storniert'], refunded:['neutral','Zurückerstattet'] };
    const [type,label] = map[status] || ['neutral',status];
    return `<span class="status-pill status-pill--${type}">${label}</span>`;
  }

  function bindOrderActions() {
    $$('[data-view-order]').forEach(btn => btn.addEventListener('click', () => openOrderDetails(btn.dataset.viewOrder)));
    $$('[data-cancel-order]').forEach(btn => btn.addEventListener('click', () => openCancelOrder(btn.dataset.cancelOrder)));
  }

  function renderMenus(content) {
    renderEntityPage(content, {
      entity:'menus', title:'Menüs, Speisen und Getränke', searchPlaceholder:'Menü oder Kategorie suchen', permission:PERMISSION.MENUS_MANAGE,
      columns:['Menü','Kategorie','Einkauf','Verkauf','Steuer','Verfügbar','Herstellbar','Status',''],
      row: item => `<td><div class="product-cell"><div class="product-thumb">${item.image_url?`<img src="${escapeHtml(item.image_url)}" alt="">`:escapeHtml(item.name.slice(0,2).toUpperCase())}</div><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description||'')}</small></div></div></td><td>${escapeHtml(item.category)}</td><td>${fmtCurrency(item.purchase_price)}</td><td><strong>${fmtCurrency(item.sale_price)}</strong></td><td>${fmtNumber(item.tax_rate)} %</td><td>${fmtNumber(calculateMenuAvailability(item))}</td><td>${item.producible?statusPill('completed'):statusPill('cancelled')}</td><td>${item.active?statusPill('completed'):statusPill('cancelled')}</td><td>${entityActions('menu',item.id,PERMISSION.MENUS_MANAGE)}</td>`,
      search: item => `${item.name} ${item.category} ${item.description}`,
      onNew: () => openMenuModal(), onEdit: id => openMenuModal(state.data.menus.find(x=>x.id===id))
    });
  }

  function calculateMenuAvailability(menu) {
    if (!menu.active || !menu.producible) return 0;
    if (!menu.recipe?.length) return Number(menu.available_quantity || 0);
    return Math.max(0, Math.floor(Math.min(...menu.recipe.map(r => {
      const ing = state.data.ingredients.find(i => i.id === r.ingredient_id);
      return ing ? Number(ing.stock) / Math.max(Number(r.quantity),.0001) : 0;
    }))));
  }

  function renderIngredients(content) {
    renderEntityPage(content, {
      entity:'ingredients', title:'Zutaten und Lagerbestände', searchPlaceholder:'Zutat oder Kategorie suchen', permission:PERMISSION.INGREDIENTS_MANAGE,
      columns:['Zutat','Kategorie','Einkauf','Verkauf','Bestand','Mindestbestand','Einheit','Eigenschaften','Zuletzt geändert',''],
      row: item => `<td><div class="product-cell"><div class="product-thumb">${escapeHtml(item.name.slice(0,2).toUpperCase())}</div><div><strong>${escapeHtml(item.name)}</strong><small>${Number(item.stock)<=Number(item.min_stock)?'Niedriger Bestand':'Bestand ausreichend'}</small></div></div></td><td>${escapeHtml(item.category)}</td><td>${fmtCurrency(item.purchase_price)}</td><td>${fmtCurrency(item.sale_price)}</td><td><strong>${fmtNumber(item.stock)}</strong></td><td>${fmtNumber(item.min_stock)}</td><td>${escapeHtml(item.unit)}</td><td>${item.consumable?'Verzehrbar':''}${item.consumable&&item.producible?' · ':''}${item.producible?'Herstellbar':''}</td><td>${fmtDate(item.updated_at||item.created_at)}</td><td><div class="table-actions">${(hasPermission(PERMISSION.STOCK_MANAGE)||hasPermission(PERMISSION.AUDIT_VIEW))?`<button class="icon-button" data-stock-history="${item.id}" title="Bestandsverlauf">◷</button>`:''}${hasPermission(PERMISSION.STOCK_MANAGE)?`<button class="icon-button" data-stock="${item.id}" title="Lager ändern">±</button>`:''}${hasPermission(PERMISSION.INGREDIENTS_MANAGE)?`<button class="icon-button" data-edit-ingredient="${item.id}" title="Bearbeiten">✎</button>`:''}</div></td>`,
      search: item => `${item.name} ${item.category}`,
      onNew: () => openIngredientModal(), onEdit: id => openIngredientModal(state.data.ingredients.find(x=>x.id===id)), afterBind: () => { $$('[data-stock]').forEach(btn=>btn.addEventListener('click',()=>openStockModal(btn.dataset.stock))); $$('[data-stock-history]').forEach(btn=>btn.addEventListener('click',()=>openStockHistory(btn.dataset.stockHistory))); }
    });
  }

  function renderOrganizations(content) {
    renderEntityPage(content, {
      entity:'organizations', title:'Organisationen und Sonderkonditionen', searchPlaceholder:'Organisation oder Ansprechpartner suchen', permission:PERMISSION.ORGANIZATIONS_MANAGE,
      columns:['Organisation','Ansprechpartner','Kontakt','Rabatt','Status','Notizen',''],
      row: item => `<td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.contact_person||'—')}</td><td>${escapeHtml(item.phone||'—')}<br><small class="muted">${escapeHtml(item.email||'')}</small></td><td><strong>${item.discount_type==='percent'?`${fmtNumber(item.discount_value)} %`:fmtCurrency(item.discount_value)}</strong></td><td>${item.active?statusPill('completed'):statusPill('cancelled')}</td><td>${escapeHtml(item.notes||'—')}</td><td>${entityActions('organization',item.id,PERMISSION.ORGANIZATIONS_MANAGE)}</td>`,
      search:item=>`${item.name} ${item.contact_person} ${item.email}`,
      onNew:()=>openOrganizationModal(), onEdit:id=>openOrganizationModal(state.data.organizations.find(x=>x.id===id))
    });
  }

  function renderEmployees(content) {
    if (!hasPermission(PERMISSION.EMPLOYEES_MANAGE)) return renderDenied(content);
    renderEntityPage(content, {
      entity:'employees', title:'Mitarbeiter und Benutzerkonten', searchPlaceholder:'Name, Benutzername oder Rolle suchen', permission:PERMISSION.EMPLOYEES_MANAGE,
      columns:['Mitarbeiter','Benutzername','E-Mail','Rolle','Passwortwechsel','Status','Erstellt',''],
      row:item=>`<td><div class="product-cell"><div class="avatar">${initials(item.full_name)}</div><div><strong>${escapeHtml(item.full_name)}</strong><small>${escapeHtml(item.id)}</small></div></div></td><td>${escapeHtml(item.username)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(ROLE_LABELS[item.role]||item.role)}</td><td>${item.must_change_password?statusPill('open'):statusPill('completed')}</td><td>${item.active?statusPill('completed'):statusPill('cancelled')}</td><td>${fmtDate(item.created_at)}</td><td><div class="table-actions"><button class="icon-button" data-edit-employee="${item.id}">✎</button></div></td>`,
      search:item=>`${item.full_name} ${item.username} ${item.email} ${ROLE_LABELS[item.role]}`,
      onNew:()=>openEmployeeModal(), onEdit:id=>openEmployeeModal(state.data.employees.find(x=>x.id===id))
    });
  }

  function renderAudit(content) {
    if (!hasPermission(PERMISSION.AUDIT_VIEW)) return renderDenied(content);
    content.innerHTML = `<section class="page-stack"><div class="page-toolbar"><div class="search-row"><input id="auditSearch" placeholder="Aktion, Mitarbeiter oder Datensatz suchen"></div></div><div class="data-panel"><div class="data-panel-header"><h3>Dauerhafte Aktivitäten</h3><span class="muted">${state.data.audit.length} Einträge</span></div><div id="auditTable" class="table-wrap"></div></div></section>`;
    const render = () => {
      const q = $('#auditSearch').value.toLowerCase();
      const rows = state.data.audit.filter(a => `${a.employee_name} ${a.action} ${a.entity_name} ${a.details}`.toLowerCase().includes(q));
      $('#auditTable').innerHTML = rows.length ? `<table><thead><tr><th>Datum</th><th>Mitarbeiter</th><th>Aktion</th><th>Bereich</th><th>Datensatz</th><th>Details</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${fmtDate(a.created_at)}</td><td>${escapeHtml(a.employee_name||'System')}</td><td><strong>${escapeHtml(a.action)}</strong></td><td>${escapeHtml(a.entity_type)}</td><td>${escapeHtml(a.entity_name||'—')}</td><td>${escapeHtml(a.details||'—')}</td></tr>`).join('')}</tbody></table>` : emptyState('Keine Einträge','Es wurden keine passenden Protokolle gefunden.');
    };
    $('#auditSearch').addEventListener('input',render); render();
  }

  function renderSettings(content) {
    if (!hasPermission(PERMISSION.SETTINGS_MANAGE)) return renderDenied(content);
    const s = state.data.settings;
    content.innerHTML = `<section class="page-stack"><form id="settingsForm" class="panel"><div class="panel-heading"><div><p class="eyebrow">UNTERNEHMEN</p><h3>Allgemeine Einstellungen</h3></div></div><div class="form-grid">
      <label class="field"><span>Firmenname</span><input name="company_name" value="${escapeHtml(s.company_name||'THE AFTER HOURS')}"></label>
      <label class="field"><span>Währung</span><select name="currency"><option value="USD" ${s.currency==='USD'?'selected':''}>USD ($)</option><option value="EUR" ${s.currency==='EUR'?'selected':''}>EUR (€)</option></select></label>
      <label class="field span-2"><span>Adresse</span><input name="address" value="${escapeHtml(s.address||'')}"></label>
      <label class="field"><span>Kontakt-E-Mail</span><input type="email" name="contact_email" value="${escapeHtml(s.contact_email||'')}"></label>
      <label class="field"><span>Telefon</span><input name="phone" value="${escapeHtml(s.phone||'')}"></label>
      <label class="field"><span>Standardsteuersatz (%)</span><input type="number" min="0" max="100" step="0.01" name="default_tax_rate" value="${Number(s.default_tax_rate??10)}"></label>
      <label class="field"><span>Bestellnummer-Präfix</span><input name="order_prefix" value="${escapeHtml(s.order_prefix||'AH')}"></label>
      <label class="field span-2"><span>Verkaufsorte (mit Komma trennen)</span><input name="sales_locations" value="${escapeHtml((s.sales_locations||[]).join(', '))}"></label>
      <label class="field span-2"><span>Kategorien (mit Komma trennen)</span><input name="categories" value="${escapeHtml((s.categories||[]).join(', '))}"></label>
      <label class="field span-2"><span>Trinkgeldregeln</span><textarea name="tip_rules">${escapeHtml(s.tip_rules||'')}</textarea></label>
      </div><div class="dialog-footer"><button type="submit" class="button button--primary">Einstellungen speichern</button>${DEMO_MODE?'<button type="button" id="resetDemo" class="button button--danger">Demo zurücksetzen</button>':''}</div></form></section>`;
    $('#settingsForm').addEventListener('submit', async event => {
      event.preventDefault(); const fd = new FormData(event.currentTarget);
      const settings = Object.fromEntries(fd.entries());
      settings.default_tax_rate = Number(settings.default_tax_rate);
      settings.sales_locations = settings.sales_locations.split(',').map(v=>v.trim()).filter(Boolean);
      settings.categories = settings.categories.split(',').map(v=>v.trim()).filter(Boolean);
      await withLoading(event.submitter, async()=>{ await repository.updateSettings(settings); await reloadData(); toast('Einstellungen wurden gespeichert.','success'); });
    });
    $('#resetDemo')?.addEventListener('click',()=>repository.reset());
  }

  function renderEntityPage(content, cfg) {
    const canManage = hasPermission(cfg.permission);
    content.innerHTML = `<section class="page-stack"><div class="page-toolbar"><div class="search-row"><input id="entitySearch" placeholder="${escapeHtml(cfg.searchPlaceholder)}"></div>${canManage?'<button id="entityNew" class="button button--primary">＋ Neu anlegen</button>':''}</div><div class="data-panel"><div class="data-panel-header"><h3>${escapeHtml(cfg.title)}</h3><span class="muted">${state.data[cfg.entity].length} Einträge</span></div><div id="entityTable" class="table-wrap"></div></div></section>`;
    const render = () => {
      const q = $('#entitySearch').value.toLowerCase();
      const rows = state.data[cfg.entity].filter(item => cfg.search(item).toLowerCase().includes(q));
      $('#entityTable').innerHTML = rows.length ? `<table><thead><tr>${cfg.columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(item=>`<tr>${cfg.row(item)}</tr>`).join('')}</tbody></table>` : emptyState('Keine Einträge gefunden','Lege einen neuen Datensatz an oder ändere die Suche.');
      $$(`[data-edit-${cfg.entity.slice(0,-1)}]`).forEach(btn=>btn.addEventListener('click',()=>cfg.onEdit(btn.dataset[`edit${capitalize(cfg.entity.slice(0,-1))}`])));
      cfg.afterBind?.();
    };
    $('#entitySearch').addEventListener('input',render);
    $('#entityNew')?.addEventListener('click',cfg.onNew);
    render();
  }

  function entityActions(entity,id,permission) {
    return hasPermission(permission) ? `<div class="table-actions"><button class="icon-button" data-edit-${entity}="${id}" title="Bearbeiten">✎</button></div>` : '';
  }
  function capitalize(value) { return value.charAt(0).toUpperCase()+value.slice(1); }
  function permissionLabel(permission) {
    return ({
      'orders.create':'Bestellungen aufnehmen','orders.view':'Bestellungen ansehen','orders.cancel':'Bestellungen stornieren','orders.refund':'Rückerstattungen durchführen',
      'menus.manage':'Menüs verwalten','ingredients.manage':'Zutaten verwalten','stock.manage':'Lagerbestand ändern','organizations.manage':'Organisationen verwalten',
      'discounts.use':'Rabatte verwenden','discounts.manage':'Rabatte verändern','employees.manage':'Mitarbeiter verwalten','settings.manage':'Einstellungen verwalten',
      'audit.view':'Protokoll ansehen','notices.manage':'Mitteilungen verwalten'
    })[permission] || permission;
  }
  function renderDenied(content) { content.innerHTML = `<div class="panel empty-state"><strong>Kein Zugriff</strong>Dein Benutzerkonto besitzt nicht die erforderliche Berechtigung.</div>`; }
  function emptyState(title,text) { return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`; }

  function openModal(html, { onOpen } = {}) {
    $('#modalHost').innerHTML = `<div class="dialog-backdrop"><div class="dialog-card">${html}</div></div>`;
    const backdrop = $('.dialog-backdrop', $('#modalHost'));
    backdrop.addEventListener('mousedown',event=>{ if(event.target===backdrop) closeModal(); });
    $$('[data-close-modal]', backdrop).forEach(btn=>btn.addEventListener('click',closeModal));
    onOpen?.(backdrop);
  }
  function closeModal() { $('#modalHost').innerHTML=''; }

  function openOrderModal() {
    if (!hasPermission(PERMISSION.ORDERS_CREATE)) return toast('Keine Berechtigung für neue Bestellungen.','error');
    state.cart = [];
    state.currentOrderOrganization = null;
    state.currentPaymentMethod = 'cash';
    const products = [
      ...state.data.menus.filter(m=>m.active).map(m=>({type:'menu',reference_id:m.id,name:m.name,category:m.category,unit_price:Number(m.sale_price),tax_rate:Number(m.tax_rate),available:calculateMenuAvailability(m)})),
      ...state.data.ingredients.filter(i=>i.active && Number(i.sale_price)>0).map(i=>({type:'ingredient',reference_id:i.id,name:i.name,category:i.category,unit_price:Number(i.sale_price),tax_rate:Number(i.tax_rate||state.data.settings.default_tax_rate||10),available:Number(i.stock)}))
    ];
    const html = `<div class="dialog-heading"><div><p class="eyebrow">KASSE</p><h2>Neue Bestellung</h2></div><button class="icon-button" data-close-modal>×</button></div>
      <div class="form-grid" style="margin-bottom:20px"><label class="field"><span>Verkaufsort</span><select id="orderLocation">${(state.data.settings.sales_locations||['Hauptkasse']).map(v=>`<option>${escapeHtml(v)}</option>`).join('')}</select></label><label class="field"><span>Organisation / Rabatt</span><select id="orderOrganization"><option value="">Kein Organisationsrabatt</option>${state.data.organizations.filter(o=>o.active).map(o=>`<option value="${o.id}">${escapeHtml(o.name)} – ${o.discount_type==='percent'?`${o.discount_value} %`:fmtCurrency(o.discount_value)}</option>`).join('')}</select></label></div>
      <div class="order-layout"><div><div class="search-row" style="margin-bottom:12px"><input id="productSearch" placeholder="Produkt suchen"><select id="productCategory" class="filter-select"><option value="">Alle Kategorien</option>${[...new Set(products.map(p=>p.category))].map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select></div><div id="orderProducts" class="order-products"></div></div><aside class="cart"><div class="panel-heading"><div><p class="eyebrow">WARENKORB</p><h3>Bestellpositionen</h3></div><span id="cartCount" class="status-pill status-pill--neutral">0 Artikel</span></div><div id="cartItems" class="cart-items"></div><div class="cart-totals"><div><span>Zwischensumme</span><strong id="cartSubtotal">${fmtCurrency(0)}</strong></div><div><span>Rabatt</span><strong id="cartDiscount">− ${fmtCurrency(0)}</strong></div><div><span>Steuer enthalten</span><strong id="cartTax">${fmtCurrency(0)}</strong></div><div class="grand-total"><span>Gesamt</span><strong id="cartTotal">${fmtCurrency(0)}</strong></div></div></aside></div>
      <div class="form-grid" style="margin-top:18px"><label class="field"><span>Zahlungsart</span><select id="paymentMethod"><option value="cash">Barzahlung</option><option value="card">Kartenzahlung</option></select></label><label class="field"><span>Trinkgeld</span><input id="orderTip" type="number" min="0" step="0.01" value="0"></label><label id="receivedField" class="field"><span>Erhaltener Geldbetrag</span><input id="receivedAmount" type="number" min="0" step="0.01" value="0"></label><label class="field"><span>Rückgeld</span><input id="changeAmount" value="${fmtCurrency(0)}" readonly></label></div>
      <div class="dialog-footer"><button class="button button--secondary" data-close-modal>Abbrechen</button><button id="completeOrder" class="button button--primary" disabled>Bestellung abschließen</button></div>`;
    openModal(html,{onOpen:()=>{
      const renderProducts = () => {
        const q=$('#productSearch').value.toLowerCase(), cat=$('#productCategory').value;
        $('#orderProducts').innerHTML = products.filter(p=>(!cat||p.category===cat)&&`${p.name} ${p.category}`.toLowerCase().includes(q)).map(p=>`<article class="order-product ${p.available<=0?'disabled':''}" data-add-product="${p.type}:${p.reference_id}"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category)} · ${fmtNumber(p.available)} verfügbar</small><strong class="price">${fmtCurrency(p.unit_price)}</strong></article>`).join('');
        $$('[data-add-product]').forEach(card=>card.addEventListener('click',()=>{
          const [type,id]=card.dataset.addProduct.split(':'); const p=products.find(x=>x.type===type&&x.reference_id===id);
          if(p.available<=0) return toast('Produkt ist nicht verfügbar.','error');
          const existing=state.cart.find(x=>x.type===type&&x.reference_id===id);
          if(existing) existing.quantity++; else state.cart.push({...p,quantity:1}); renderCart();
        }));
      };
      $('#productSearch').addEventListener('input',renderProducts); $('#productCategory').addEventListener('change',renderProducts);
      $('#orderOrganization').addEventListener('change',event=>{ state.currentOrderOrganization=state.data.organizations.find(o=>o.id===event.target.value)||null; renderCart(); });
      $('#paymentMethod').addEventListener('change',event=>{ state.currentPaymentMethod=event.target.value; $('#receivedField').classList.toggle('hidden',event.target.value==='card'); renderCart(); });
      $('#receivedAmount').addEventListener('input',renderCart); $('#orderTip').addEventListener('input',renderCart);
      $('#completeOrder').addEventListener('click',completeOrder);
      renderProducts(); renderCart();
    }});
  }

  function cartTotals() {
    const subtotal = state.cart.reduce((sum,i)=>sum+i.unit_price*i.quantity,0);
    let discount = 0;
    if (state.currentOrderOrganization && hasPermission(PERMISSION.DISCOUNTS_USE)) {
      discount = state.currentOrderOrganization.discount_type==='percent' ? subtotal * Number(state.currentOrderOrganization.discount_value)/100 : Math.min(subtotal,Number(state.currentOrderOrganization.discount_value));
    }
    const discountedSubtotal = Math.max(0,subtotal-discount);
    const tax = state.cart.reduce((sum,item)=>{
      const line=item.unit_price*item.quantity; const share=subtotal?line/subtotal:0; const lineAfter=line-discount*share;
      return sum + lineAfter - lineAfter/(1+Number(item.tax_rate||0)/100);
    },0);
    const tip = Number($('#orderTip')?.value||0);
    const total = discountedSubtotal;
    const received = state.currentPaymentMethod==='cash' ? Number($('#receivedAmount')?.value||0) : total+tip;
    const change = state.currentPaymentMethod==='cash' ? Math.max(0,received-total) : 0;
    return {subtotal,discount,tax,total,tip,received,change};
  }

  function renderCart() {
    if (!$('#cartItems')) return;
    $('#cartItems').innerHTML = state.cart.length ? state.cart.map((item,index)=>`<div class="cart-item"><div><strong>${escapeHtml(item.name)}</strong><small>${fmtCurrency(item.unit_price)} × ${item.quantity}</small></div><div class="qty-controls"><button data-cart-minus="${index}">−</button><span>${item.quantity}</span><button data-cart-plus="${index}">＋</button></div></div>`).join('') : emptyState('Warenkorb ist leer','Wähle links ein Produkt aus.');
    $$('[data-cart-minus]').forEach(btn=>btn.addEventListener('click',()=>{ const i=Number(btn.dataset.cartMinus); state.cart[i].quantity--; if(state.cart[i].quantity<=0)state.cart.splice(i,1); renderCart(); }));
    $$('[data-cart-plus]').forEach(btn=>btn.addEventListener('click',()=>{ state.cart[Number(btn.dataset.cartPlus)].quantity++; renderCart(); }));
    const t=cartTotals();
    $('#cartCount').textContent=`${state.cart.reduce((s,i)=>s+i.quantity,0)} Artikel`;
    $('#cartSubtotal').textContent=fmtCurrency(t.subtotal); $('#cartDiscount').textContent=`− ${fmtCurrency(t.discount)}`; $('#cartTax').textContent=fmtCurrency(t.tax); $('#cartTotal').textContent=fmtCurrency(t.total); $('#changeAmount').value=fmtCurrency(t.change);
    $('#completeOrder').disabled=!state.cart.length || (state.currentPaymentMethod==='cash' && t.received<t.total);
  }

  async function completeOrder(event) {
    const t=cartTotals();
    const payload = {
      sales_location:$('#orderLocation').value,
      organization_id:state.currentOrderOrganization?.id||null,
      organization_name:state.currentOrderOrganization?.name||'',
      discount_amount:Number(t.discount.toFixed(2)), subtotal:Number(t.subtotal.toFixed(2)), tax_amount:Number(t.tax.toFixed(2)), total:Number(t.total.toFixed(2)),
      received_amount:Number(t.received.toFixed(2)), change_amount:Number(t.change.toFixed(2)), payment_method:state.currentPaymentMethod, tip:Number(t.tip.toFixed(2)),
      items:state.cart.map(i=>({type:i.type,reference_id:i.reference_id,name:i.name,quantity:i.quantity,unit_price:i.unit_price,tax_rate:i.tax_rate}))
    };
    await withLoading(event.currentTarget,async()=>{
      await repository.createOrder(payload); await reloadData(); closeModal(); navigate('orders'); toast('Bestellung wurde abgeschlossen und der Lagerbestand aktualisiert.','success');
    });
  }

  function openOrderDetails(id) {
    const o=state.data.orders.find(x=>x.id===id); if(!o)return;
    openModal(`<div class="dialog-heading"><div><p class="eyebrow">BESTELLDETAILS</p><h2>${escapeHtml(o.order_number)}</h2></div><button class="icon-button" data-close-modal>×</button></div><div class="form-grid"><div class="panel"><small class="muted">Verkaufsort</small><h3>${escapeHtml(o.sales_location)}</h3></div><div class="panel"><small class="muted">Mitarbeiter</small><h3>${escapeHtml(o.employee_name)}</h3></div><div class="panel"><small class="muted">Zahlungsart</small><h3>${o.payment_method==='cash'?'Barzahlung':'Kartenzahlung'}</h3></div><div class="panel"><small class="muted">Status</small><h3>${statusPill(o.status)}</h3></div></div><div class="data-panel" style="margin-top:18px"><div class="data-panel-header"><h3>Positionen</h3></div><div class="table-wrap"><table><thead><tr><th>Artikel</th><th>Menge</th><th>Einzelpreis</th><th>Gesamt</th></tr></thead><tbody>${(o.items||[]).map(i=>`<tr><td>${escapeHtml(i.name)}</td><td>${fmtNumber(i.quantity)}</td><td>${fmtCurrency(i.unit_price)}</td><td>${fmtCurrency(i.unit_price*i.quantity)}</td></tr>`).join('')}</tbody></table></div></div><div class="cart-totals" style="margin-top:18px"><div><span>Zwischensumme</span><strong>${fmtCurrency(o.subtotal)}</strong></div><div><span>Rabatt</span><strong>− ${fmtCurrency(o.discount_amount)}</strong></div><div><span>Trinkgeld</span><strong>${fmtCurrency(o.tip)}</strong></div><div class="grand-total"><span>Gesamt</span><strong>${fmtCurrency(o.total)}</strong></div></div>`);
  }

  function openCancelOrder(id) {
    const o=state.data.orders.find(x=>x.id===id); if(!o)return;
    openModal(`<div class="dialog-heading"><div><p class="eyebrow">BESTELLUNG ÄNDERN</p><h2>${escapeHtml(o.order_number)} stornieren</h2></div><button class="icon-button" data-close-modal>×</button></div><p class="muted">Die verbrauchten Zutaten werden automatisch wieder dem Lager hinzugefügt.</p><label class="field"><span>Vorgang</span><select id="cancelStatus"><option value="cancelled">Stornieren</option>${hasPermission(PERMISSION.ORDERS_REFUND)?'<option value="refunded">Zurückerstatten</option>':''}</select></label><label class="field"><span>Begründung</span><textarea id="cancelReason" required placeholder="Warum wird die Bestellung storniert?"></textarea></label><div class="dialog-footer"><button class="button button--secondary" data-close-modal>Abbrechen</button><button id="confirmCancel" class="button button--danger">Bestätigen</button></div>`,{onOpen:()=>$('#confirmCancel').addEventListener('click',async event=>{
      const reason=$('#cancelReason').value.trim(); if(!reason)return toast('Bitte eine Begründung eintragen.','error');
      await withLoading(event.currentTarget,async()=>{await repository.cancelOrder(id,$('#cancelStatus').value,reason);await reloadData();closeModal();renderPage();toast('Bestellung wurde geändert und der Lagerbestand korrigiert.','success');});
    })});
  }

  function openMenuModal(item={}) {
    const recipeMap=new Map((item.recipe||[]).map(r=>[r.ingredient_id,Number(r.quantity)]));
    openModal(`<form id="menuForm"><div class="dialog-heading"><div><p class="eyebrow">SORTIMENT</p><h2>${item.id?'Menü bearbeiten':'Neues Menü'}</h2></div><button type="button" class="icon-button" data-close-modal>×</button></div><div class="form-grid">
      <label class="field"><span>Name</span><input name="name" value="${escapeHtml(item.name||'')}" required></label><label class="field"><span>Kategorie</span><input name="category" list="categoryList" value="${escapeHtml(item.category||'')}" required><datalist id="categoryList">${(state.data.settings.categories||[]).map(c=>`<option value="${escapeHtml(c)}">`).join('')}</datalist></label>
      <label class="field span-2"><span>Beschreibung</span><textarea name="description">${escapeHtml(item.description||'')}</textarea></label><label class="field"><span>Produktbild hochladen</span><input type="file" name="image_file" accept="image/png,image/jpeg,image/webp"></label><label class="field"><span>Oder Produktbild-URL</span><input name="image_url" value="${escapeHtml(item.image_url||'')}" placeholder="https://…"></label>
      <label class="field"><span>Einkaufspreis</span><input type="number" min="0" step="0.01" name="purchase_price" value="${Number(item.purchase_price||0)}"></label><label class="field"><span>Verkaufspreis</span><input type="number" min="0" step="0.01" name="sale_price" value="${Number(item.sale_price||0)}" required></label>
      <label class="field"><span>Steuersatz (%)</span><input type="number" min="0" max="100" step="0.01" name="tax_rate" value="${Number(item.tax_rate??state.data.settings.default_tax_rate??10)}"></label><label class="field"><span>Organisationsrabatt (%)</span><input type="number" min="0" max="100" step="0.01" name="organization_discount" ${hasPermission(PERMISSION.DISCOUNTS_MANAGE)?'':'disabled'} value="${Number(item.organization_discount||0)}"></label>
      <label class="checkbox-field"><input type="checkbox" name="active" ${item.active!==false?'checked':''}> Verfügbar / aktiv</label><label class="checkbox-field"><input type="checkbox" name="producible" ${item.producible!==false?'checked':''}> Herstellbar</label>
      </div><div class="panel" style="margin-top:20px"><div class="panel-heading"><div><p class="eyebrow">REZEPTUR</p><h3>Enthaltene Zutaten</h3></div></div><div class="table-wrap"><table><thead><tr><th>Zutat</th><th>Benötigte Menge</th><th>Einheit</th></tr></thead><tbody>${state.data.ingredients.filter(i=>i.active).map(i=>`<tr><td>${escapeHtml(i.name)}</td><td><input class="recipe-qty" data-ingredient-id="${i.id}" type="number" min="0" step="0.001" value="${recipeMap.get(i.id)||0}"></td><td>${escapeHtml(i.unit)}</td></tr>`).join('')}</tbody></table></div></div><div class="dialog-footer"><button type="button" class="button button--secondary" data-close-modal>Abbrechen</button><button class="button button--primary" type="submit">Speichern</button></div></form>`,{onOpen:()=>$('#menuForm').addEventListener('submit',async event=>{
      event.preventDefault(); const fd=new FormData(event.currentTarget); const record=Object.fromEntries(fd.entries());
      const imageFile = fd.get('image_file'); delete record.image_file;
      record.id=item.id; ['purchase_price','sale_price','tax_rate'].forEach(k=>record[k]=Number(record[k]||0)); record.organization_discount = record.organization_discount !== undefined ? Number(record.organization_discount) : Number(item.organization_discount||0); record.active=fd.has('active'); record.producible=fd.has('producible'); record.recipe=$$('.recipe-qty').map(input=>({ingredient_id:input.dataset.ingredientId,quantity:Number(input.value)})).filter(r=>r.quantity>0);
      await withLoading(event.submitter,async()=>{
        if (imageFile && imageFile.size) {
          if (DEMO_MODE) record.image_url = await fileToDataUrl(imageFile);
          else record.image_url = await repository.uploadProductImage(imageFile);
        }
        await repository.saveEntity('menus',record);await reloadData();closeModal();renderPage();toast('Menü wurde gespeichert.','success');
      });
    })});
  }

  function openIngredientModal(item={}) {
    openModal(`<form id="ingredientForm"><div class="dialog-heading"><div><p class="eyebrow">LAGER</p><h2>${item.id?'Zutat bearbeiten':'Neue Zutat'}</h2></div><button type="button" class="icon-button" data-close-modal>×</button></div><div class="form-grid">
      <label class="field"><span>Name</span><input name="name" value="${escapeHtml(item.name||'')}" required></label><label class="field"><span>Kategorie</span><input name="category" value="${escapeHtml(item.category||'')}" required></label>
      <label class="field"><span>Einkaufspreis</span><input type="number" min="0" step="0.01" name="purchase_price" value="${Number(item.purchase_price||0)}"></label><label class="field"><span>Verkaufspreis</span><input type="number" min="0" step="0.01" name="sale_price" value="${Number(item.sale_price||0)}"></label>
      <label class="field"><span>Aktueller Bestand</span><input type="number" step="0.001" name="stock" value="${Number(item.stock||0)}" ${item.id?'readonly':''}></label><label class="field"><span>Mindestbestand</span><input type="number" min="0" step="0.001" name="min_stock" value="${Number(item.min_stock||0)}"></label>
      <label class="field"><span>Einheit</span><input name="unit" value="${escapeHtml(item.unit||'Stück')}" required></label><label class="field"><span>Steuersatz (%)</span><input type="number" min="0" max="100" step="0.01" name="tax_rate" value="${Number(item.tax_rate??state.data.settings.default_tax_rate??10)}"></label><label class="field"><span>Organisationsrabatt (%)</span><input type="number" min="0" max="100" step="0.01" name="organization_discount" ${hasPermission(PERMISSION.DISCOUNTS_MANAGE)?'':'disabled'} value="${Number(item.organization_discount||0)}"></label>
      <label class="checkbox-field"><input type="checkbox" name="consumable" ${item.consumable!==false?'checked':''}> Verzehrbar</label><label class="checkbox-field"><input type="checkbox" name="producible" ${item.producible?'checked':''}> Herstellbar</label><label class="checkbox-field"><input type="checkbox" name="active" ${item.active!==false?'checked':''}> Aktiv</label>
      </div><div class="dialog-footer"><button type="button" class="button button--secondary" data-close-modal>Abbrechen</button><button class="button button--primary" type="submit">Speichern</button></div></form>`,{onOpen:()=>$('#ingredientForm').addEventListener('submit',async event=>{
      event.preventDefault(); const fd=new FormData(event.currentTarget); const record=Object.fromEntries(fd.entries()); record.id=item.id; ['purchase_price','sale_price','stock','min_stock','tax_rate'].forEach(k=>record[k]=Number(record[k]||0)); record.organization_discount = record.organization_discount !== undefined ? Number(record.organization_discount) : Number(item.organization_discount||0); ['consumable','producible','active'].forEach(k=>record[k]=fd.has(k));
      await withLoading(event.submitter,async()=>{await repository.saveEntity('ingredients',record);await reloadData();closeModal();renderPage();toast('Zutat wurde gespeichert.','success');});
    })});
  }

  function openStockModal(id) {
    const item=state.data.ingredients.find(i=>i.id===id); if(!item)return;
    openModal(`<div class="dialog-heading"><div><p class="eyebrow">BESTANDSBEWEGUNG</p><h2>${escapeHtml(item.name)}</h2></div><button class="icon-button" data-close-modal>×</button></div><p class="muted">Aktueller Bestand: <strong>${fmtNumber(item.stock)} ${escapeHtml(item.unit)}</strong></p><label class="field"><span>Mengenänderung</span><input id="stockQuantity" type="number" step="0.001" placeholder="z. B. 15 oder -15"></label><label class="field"><span>Grund</span><select id="stockReason"><option>Wareneinkauf / Lieferung</option><option>Verkauf an Großhändler</option><option>Verderb / Verlust</option><option>Inventurkorrektur</option><option>Sonstige Korrektur</option></select></label><label class="field"><span>Zusätzliche Notiz</span><input id="stockNote" placeholder="Optional"></label><div class="dialog-footer"><button class="button button--secondary" data-close-modal>Abbrechen</button><button id="saveStock" class="button button--primary">Bestand buchen</button></div>`,{onOpen:()=>$('#saveStock').addEventListener('click',async event=>{
      const qty=Number($('#stockQuantity').value); if(!qty)return toast('Bitte eine positive oder negative Menge eingeben.','error'); const reason=`${$('#stockReason').value}${$('#stockNote').value.trim()?`: ${$('#stockNote').value.trim()}`:''}`;
      await withLoading(event.currentTarget,async()=>{await repository.changeStock(id,qty,reason);await reloadData();closeModal();renderPage();toast('Bestandsänderung wurde protokolliert.','success');});
    })});
  }

  function openStockHistory(id) {
    const item=state.data.ingredients.find(i=>i.id===id); if(!item)return;
    const rows=(state.data.stockMovements||[]).filter(m=>m.ingredient_id===id);
    openModal(`<div class="dialog-heading"><div><p class="eyebrow">BESTANDSVERLAUF</p><h2>${escapeHtml(item.name)}</h2></div><button class="icon-button" data-close-modal>×</button></div><div class="data-panel"><div class="table-wrap">${rows.length?`<table><thead><tr><th>Datum</th><th>Menge</th><th>Grund</th><th>Mitarbeiter</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${fmtDate(m.created_at)}</td><td><strong>${Number(m.quantity)>0?'+':''}${fmtNumber(m.quantity)} ${escapeHtml(item.unit)}</strong></td><td>${escapeHtml(m.reason)}</td><td>${escapeHtml(m.employee_name||'System')}</td></tr>`).join('')}</tbody></table>`:emptyState('Kein Bestandsverlauf','Für diese Zutat wurden noch keine Bewegungen protokolliert.')}</div></div>`);
  }

  function openOrganizationModal(item={}) {
    openModal(`<form id="organizationForm"><div class="dialog-heading"><div><p class="eyebrow">KUNDENGRUPPE</p><h2>${item.id?'Organisation bearbeiten':'Neue Organisation'}</h2></div><button type="button" class="icon-button" data-close-modal>×</button></div><div class="form-grid">
      <label class="field span-2"><span>Name der Organisation</span><input name="name" value="${escapeHtml(item.name||'')}" required></label><label class="field"><span>Ansprechpartner</span><input name="contact_person" value="${escapeHtml(item.contact_person||'')}"></label><label class="field"><span>Telefonnummer</span><input name="phone" value="${escapeHtml(item.phone||'')}"></label>
      <label class="field"><span>E-Mail-Adresse</span><input type="email" name="email" value="${escapeHtml(item.email||'')}"></label><label class="field"><span>Rabattart</span><select name="discount_type" ${hasPermission(PERMISSION.DISCOUNTS_MANAGE)?'':'disabled'}><option value="percent" ${item.discount_type!=='fixed'?'selected':''}>Prozent</option><option value="fixed" ${item.discount_type==='fixed'?'selected':''}>Fester Betrag</option></select></label><label class="field"><span>Rabattwert</span><input type="number" min="0" step="0.01" name="discount_value" ${hasPermission(PERMISSION.DISCOUNTS_MANAGE)?'':'disabled'} value="${Number(item.discount_value||0)}"></label>
      <label class="field span-2"><span>Notizen</span><textarea name="notes">${escapeHtml(item.notes||'')}</textarea></label><label class="checkbox-field"><input type="checkbox" name="active" ${item.active!==false?'checked':''}> Organisation ist aktiv</label></div><div class="dialog-footer"><button type="button" class="button button--secondary" data-close-modal>Abbrechen</button><button class="button button--primary" type="submit">Speichern</button></div></form>`,{onOpen:()=>$('#organizationForm').addEventListener('submit',async event=>{
      event.preventDefault(); const fd=new FormData(event.currentTarget); const record=Object.fromEntries(fd.entries()); record.id=item.id; record.discount_type = record.discount_type || item.discount_type || 'percent'; record.discount_value = record.discount_value !== undefined ? Number(record.discount_value) : Number(item.discount_value||0); record.active=fd.has('active');
      await withLoading(event.submitter,async()=>{await repository.saveEntity('organizations',record);await reloadData();closeModal();renderPage();toast('Organisation wurde gespeichert.','success');});
    })});
  }

  function openEmployeeModal(item={}) {
    const creating=!item.id;
    openModal(`<form id="employeeForm"><div class="dialog-heading"><div><p class="eyebrow">BENUTZERKONTO</p><h2>${creating?'Mitarbeiter anlegen':'Mitarbeiter bearbeiten'}</h2></div><button type="button" class="icon-button" data-close-modal>×</button></div><div class="form-grid">
      <label class="field"><span>Vollständiger Name</span><input name="full_name" value="${escapeHtml(item.full_name||'')}" required></label><label class="field"><span>Benutzername</span><input name="username" value="${escapeHtml(item.username||'')}" ${creating?'':'readonly'} required></label>
      <label class="field"><span>E-Mail</span><input type="email" name="email" value="${escapeHtml(item.email||'')}"></label><label class="field"><span>Rolle</span><select name="role">${Object.entries(ROLE_LABELS).map(([value,label])=>`<option value="${value}" ${item.role===value?'selected':''}>${label}</option>`).join('')}</select></label>
      ${creating?'<label class="field span-2"><span>Einmaliges Startpasswort</span><input type="password" name="start_password" minlength="10" required><small class="muted">Beim ersten Login muss ein neues Passwort gesetzt werden.</small></label>':''}
      <label class="checkbox-field"><input type="checkbox" name="active" ${item.active!==false?'checked':''}> Account ist aktiv</label></div>
      <div class="panel" style="margin-top:20px"><div class="panel-heading"><div><p class="eyebrow">ZUSATZRECHTE</p><h3>Individuelle Berechtigungen</h3></div></div><div class="form-grid">${Object.values(PERMISSION).map(permission=>`<label class="checkbox-field"><input class="employee-permission" type="checkbox" value="${permission}" ${(item.permissions||[]).includes(permission)?'checked':''}> ${permissionLabel(permission)}</label>`).join('')}</div><p class="muted" style="font-size:11px">Diese Rechte ergänzen die ausgewählte Rolle. Inhaber und Administratoren besitzen automatisch alle Rechte.</p></div><div class="dialog-footer"><button type="button" class="button button--secondary" data-close-modal>Abbrechen</button><button class="button button--primary" type="submit">${creating?'Konto erstellen':'Änderungen speichern'}</button></div></form>`,{onOpen:()=>$('#employeeForm').addEventListener('submit',async event=>{
      event.preventDefault(); const fd=new FormData(event.currentTarget); const payload=Object.fromEntries(fd.entries()); payload.active=fd.has('active'); payload.permissions=$$('.employee-permission').filter(input=>input.checked).map(input=>input.value);
      await withLoading(event.submitter,async()=>{
        if(creating) await repository.createEmployee(payload);
        else if(DEMO_MODE) await repository.saveEntity('employees',{...payload,id:item.id});
        else await repository.updateEmployee({...payload,id:item.id});
        await reloadData(); closeModal(); renderPage(); toast('Mitarbeiterkonto wurde gespeichert.','success');
      });
    })});
  }

  function openNoticeModal() {
    openModal(`<form id="noticeForm"><div class="dialog-heading"><div><p class="eyebrow">SCHWARZES BRETT</p><h2>Neue Mitteilung</h2></div><button type="button" class="icon-button" data-close-modal>×</button></div><label class="field"><span>Titel</span><input name="title" required></label><label class="field"><span>Mitteilung</span><textarea name="body" required></textarea></label><div class="dialog-footer"><button type="button" class="button button--secondary" data-close-modal>Abbrechen</button><button class="button button--primary" type="submit">Veröffentlichen</button></div></form>`,{onOpen:()=>$('#noticeForm').addEventListener('submit',async event=>{
      event.preventDefault(); const fd=new FormData(event.currentTarget); await withLoading(event.submitter,async()=>{await repository.saveEntity('notices',{...Object.fromEntries(fd.entries()),author_name:state.data.currentUser.full_name,author_id:state.data.currentUser.id});await reloadData();closeModal();renderPage();toast('Mitteilung wurde veröffentlicht.','success');});
    })});
  }

  function fileToDataUrl(file) {
    return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); });
  }
  async function reloadData() { state.data = await repository.loadAll(); updateEmployeeUi(); applyPermissionVisibility(); updateBadges(); }
  async function withLoading(button, task) {
    const text=button?.textContent; if(button){button.disabled=true;button.textContent='Wird gespeichert …';}
    try { await task(); } catch(error) { console.error(error); toast(error.message||'Die Aktion konnte nicht ausgeführt werden.','error'); }
    finally { if(button){button.disabled=false;button.textContent=text;} }
  }

  function bindGlobalEvents() {
    $('#loginForm').addEventListener('submit',async event=>{
      event.preventDefault(); await withLoading(event.submitter,async()=>{await repository.signIn($('#loginEmail').value.trim(),$('#loginPassword').value);await enterApp();toast('Erfolgreich angemeldet.','success');});
    });
    $('#logoutButton').addEventListener('click',async()=>{await repository.signOut();state.data=null;showLogin();});
    $('#passwordForm').addEventListener('submit',async event=>{
      event.preventDefault(); const p=$('#newPassword').value,c=$('#newPasswordConfirm').value;
      if(p!==c)return toast('Die Passwörter stimmen nicht überein.','error');
      if(p.length<10)return toast('Das Passwort muss mindestens 10 Zeichen enthalten.','error');
      await withLoading(event.submitter,async()=>{await repository.updatePassword(p);$('#passwordView').classList.add('hidden');await reloadData();renderPage();toast('Das neue Passwort wurde gespeichert.','success');});
    });
    $$('.nav-item[data-page]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.page)));
    $('#quickOrderButton').addEventListener('click',openOrderModal);
    $('#mobileMenuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
    $$('[data-toggle-password]').forEach(btn=>btn.addEventListener('click',()=>{const input=$(`#${btn.dataset.togglePassword}`);input.type=input.type==='password'?'text':'password';}));
  }

  async function init() {
    bindGlobalEvents();
    try {
      const session=await repository.getSession();
      if(session) await enterApp(); else showLogin();
    } catch(error) { console.error(error); showLogin(); toast('Verbindung konnte nicht hergestellt werden. Demo-Modus prüfen.','error'); }
  }

  init();
})();
