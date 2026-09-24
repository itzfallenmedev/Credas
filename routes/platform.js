module.exports = function register(ctx) {
  const app = ctx.app;
  const config = ctx.config;
  const m = ctx.models;
  const sec = ctx.security;
  const audit = ctx.audit;
  const licensing = ctx.licensing;
  const i18n = ctx.i18n;
  const csrf = ctx.csrfProtection;
  const checkAuth = ctx.checkAuthenticated;
  const checkStaff = ctx.checkStaffAccess;
  const checkApiKey = ctx.checkApiKey;

  const esc = sec.escapeHtml;
  const clean = sec.cleanText;
  const money = function (v) { return Number(v || 0).toFixed(2); };

  /* ── health ─────────────────────────────────────────────────────── */
  app.get('/health', async (req, res) => {
    const mongoose = require('mongoose');
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({
      status: db ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      database: db ? 'connected' : 'disconnected',
      version: require('../package.json').version,
      time: new Date().toISOString()
    });
  });

  /* ── language switch ────────────────────────────────────────────── */
  app.get('/lang/:code', (req, res) => {
    const code = String(req.params.code || '').toLowerCase();
    if (i18n.isSupported(code)) {
      res.cookie(i18n.COOKIE, code, { maxAge: 365 * 24 * 3600 * 1000, sameSite: 'lax' });
    }
    const back = req.get('referer') || '/';
    res.redirect(back.startsWith(config.baseURL) || back.startsWith('/') ? back : '/');
  });

  /* ── status page ────────────────────────────────────────────────── */
  app.get('/status', sec.limiters.read, async (req, res, next) => {
    try {
      let page = await m.StatusPage.findOne();
      if (!page) {
        page = await m.StatusPage.create({
          headline: 'All systems operational',
          components: [
            { key: 'storefront', name: 'Storefront', description: 'Browsing, cart and checkout' },
            { key: 'api', name: 'Public API', description: 'Product and order API' },
            { key: 'discord', name: 'Discord integration', description: 'Role grants and logging' },
            { key: 'payments', name: 'Payment processing', description: 'PayPal, Stripe and Coinbase' },
            { key: 'downloads', name: 'File delivery', description: 'Signed downloads' }
          ],
          incidents: []
        });
      }
      const open = (page.incidents || []).filter(function (i) { return i.status !== 'resolved'; });
      const worst = (page.components || []).reduce(function (acc, c) {
        const rank = { operational: 0, degraded: 1, partial: 2, down: 3 };
        return Math.max(acc, rank[c.state] || 0);
      }, 0);
      res.render('status', {
        user: req.user || null,
        existingUser: null,
        page: page,
        openIncidents: open,
        overall: ['All systems operational', 'Degraded performance', 'Partial outage', 'Major outage'][worst]
      });
    } catch (e) { next(e); }
  });

  app.get('/staff/status', checkAuth, checkStaff, async (req, res, next) => {
    try {
      const page = await m.StatusPage.findOne() || { components: [], incidents: [] };
      res.render('staff/status', { user: req.user, existingUser: req.user, page });
    } catch (e) { next(e); }
  });

  app.post('/staff/status/component', checkAuth, checkStaff, csrf, async (req, res, next) => {
    try {
      const { key, name, description, state } = req.body;
      const page = await m.StatusPage.findOne() || await m.StatusPage.create({ components: [], incidents: [] });
      const existing = (page.components || []).find(function (c) { return c.key === key; });
      const cleanState = ['operational', 'degraded', 'partial', 'down'].indexOf(state) > -1 ? state : 'operational';
      if (existing) { existing.state = cleanState; if (name) existing.name = name; if (description) existing.description = description; }
      else page.components.push({ key: cleanKey(key), name: name || key, description: description || '', state: cleanState });
      page.updatedAt = new Date();
      await page.save();
      audit.log(req, 'status.component.update', 'status', key, 'Updated component ' + key + ' to ' + cleanState);
      res.redirect('/staff/status');
    } catch (e) { next(e); }
  });

  app.post('/staff/status/incident', checkAuth, checkStaff, csrf, async (req, res, next) => {
    try {
      const { title, body, impact, status, updateBody } = req.body;
      const page = await m.StatusPage.findOne() || await m.StatusPage.create({ components: [], incidents: [] });
      const incident = {
        title: clean(title, 160) || 'Incident',
        body: clean(body, 2000),
        impact: ['none', 'minor', 'major', 'critical'].indexOf(impact) > -1 ? impact : 'minor',
        status: ['investigating', 'identified', 'monitoring', 'resolved'].indexOf(status) > -1 ? status : 'investigating',
        updates: [{ status: status || 'investigating', body: clean(updateBody || body, 2000), createdAt: new Date() }]
      };
      if (incident.status === 'resolved') incident.resolvedAt = new Date();
      page.incidents.unshift(incident);
      await page.save();
      audit.log(req, 'status.incident.create', 'status', incident.title, 'Opened incident: ' + incident.title, { impact: incident.impact });
      res.redirect('/staff/status');
    } catch (e) { next(e); }
  });

  app.post('/staff/status/incident/:id/update', checkAuth, checkStaff, csrf, async (req, res, next) => {
    try {
      const page = await m.StatusPage.findOne();
      if (!page) return res.redirect('/staff/status');
      const incident = (page.incidents || []).find(function (i) { return i._id.toString() === req.params.id; });
      if (!incident) return res.redirect('/staff/status');
      const status = ['investigating', 'identified', 'monitoring', 'resolved'].indexOf(req.body.status) > -1 ? req.body.status : incident.status;
      incident.status = status;
      incident.updates.push({ status: status, body: clean(req.body.body, 2000), createdAt: new Date() });
      if (status === 'resolved') incident.resolvedAt = new Date();
      await page.save();
      audit.log(req, 'status.incident.update', 'status', incident._id, 'Incident update: ' + status);
      res.redirect('/staff/status');
    } catch (e) { next(e); }
  });

  /* ── order lookup ───────────────────────────────────────────────── */
  app.get('/orders/lookup', sec.limiters.read, (req, res) => {
    res.render('order-lookup', { user: req.user || null, existingUser: null, result: null, error: null, reference: '' });
  });

  app.post('/orders/lookup', sec.limiters.search, csrf, async (req, res, next) => {
    try {
      const ref = String(req.body.reference || '').trim().toUpperCase();
      const email = String(req.body.email || '').trim().toLowerCase();
      if (!ref || !email) {
        return res.render('order-lookup', { user: req.user || null, existingUser: null, result: null, error: 'Enter both your order reference and the email used at checkout.', reference: ref });
      }
      const payment = await m.Payment.findOne({ publicId: ref }).lean();
      if (!payment || String(payment.email || '').toLowerCase() !== email) {
        audit.log(req, 'order.lookup.fail', 'payment', ref, 'Failed order lookup');
        return res.render('order-lookup', { user: req.user || null, existingUser: null, result: null, error: 'No order matches that reference and email address.', reference: ref });
      }
      res.render('order-lookup', { user: req.user || null, existingUser: null, result: payment, error: null, reference: ref });
    } catch (e) { next(e); }
  });

  app.get('/orders/:reference', sec.limiters.read, async (req, res, next) => {
    try {
      const ref = String(req.params.reference || '').toUpperCase();
      const token = String(req.query.token || '');
      const payment = await m.Payment.findOne({ publicId: ref }).lean();
      if (!payment) return res.status(404).render('error', { errorMessage: 'That order reference does not exist.' });
      const expected = ctx.orderToken(payment);
      if (!sec.timingSafeEqual(token, expected)) {
        return res.status(403).render('error', { errorMessage: 'This order link is missing or invalid. Use the order lookup page with your email address.' });
      }
      res.render('order-lookup', { user: req.user || null, existingUser: null, result: payment, error: null, reference: ref, token: token });
    } catch (e) { next(e); }
  });

  /* ── license verification API ───────────────────────────────────── */
  function licenseCtx(req) { return { ip: req.ip, hwid: req.body.hwid, sessionId: req.body.sessionId }; }

  app.post('/api/license/verify', sec.limiters.license, async (req, res) => {
    const result = await licensing.verify({ key: req.body.key, ip: req.ip, hwid: req.body.hwid, sessionId: req.body.sessionId });
    if (!result.valid) {
      audit.log(req, 'license.verify.fail', 'license', result.license ? result.license._id : null,
        'Rejected license check: ' + result.code, { code: result.code, hwid: req.body.hwid ? true : false });
    }
    res.status(result.valid ? 200 : 403).json({
      valid: result.valid,
      code: result.code,
      message: result.message,
      data: result.license ? { product: result.license.product, expiresAt: result.license.expiresAt, hwidLocked: result.license.hwidLocked, status: result.license.status } : null
    });
  });

  app.post('/api/license/activate', sec.limiters.license, async (req, res) => {
    const hwid = String(req.body.hwid || '').trim();
    if (!req.body.key || !hwid) return res.status(400).json({ valid: false, code: 'BAD_INPUT', message: 'key and hwid are required.' });
    const result = await licensing.verify({ key: req.body.key, ip: req.ip, hwid: hwid, sessionId: req.body.sessionId });
    res.status(result.valid ? 200 : 403).json({ valid: result.valid, code: result.code, message: result.message, data: result.license || null });
  });

  app.post('/api/license/deactivate', sec.limiters.license, async (req, res) => {
    const license = await licensing.findByKey(req.body.key);
    if (!license) return res.status(404).json({ ok: false, message: 'License not found.' });
    if (String(req.body.hwid || '') !== license.hwid) {
      return res.status(403).json({ ok: false, message: 'HWID does not match this license.' });
    }
    license.hwid = null;
    license.hwidLockedAt = null;
    await license.save();
    res.json({ ok: true, message: 'Device unbound. The next activation will bind a new device.' });
  });

  /* ── buyer license dashboard ────────────────────────────────────── */
  app.get('/licenses', checkAuth, sec.limiters.read, async (req, res, next) => {
    try {
      const licenses = await m.License.find({ ownerID: req.user.id }).sort({ createdAt: -1 }).lean();
      res.render('licenses', { user: req.user, existingUser: req.user, licenses });
    } catch (e) { next(e); }
  });

  app.post('/licenses/:id/reset-hwid', checkAuth, sec.limiters.write, csrf, async (req, res, next) => {
    try {
      const license = await m.License.findOne({ _id: req.params.id, ownerID: req.user.id });
      if (!license) return res.status(404).send('License not found.');
      license.hwid = null;
      license.hwidLockedAt = null;
      license.sessions = [];
      await license.save();
      audit.log(req, 'license.hwid.reset', 'license', license._id, 'Buyer reset HWID on ' + license.productName);
      res.redirect('/licenses');
    } catch (e) { next(e); }
  });

  /* ── staff license management ───────────────────────────────────── */
  app.get('/staff/licenses', checkAuth, checkStaff, sec.limiters.read, async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      const status = String(req.query.status || '');
      const filter = {};
      if (q) filter.$or = [{ keyHash: licensing.hashKey(licensing.normalizeKey(q)) }, { ownerUsername: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { productName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
      if (status && ['active', 'suspended', 'banned', 'expired'].indexOf(status) > -1) filter.status = status;
      const [licenses, products] = await Promise.all([
        m.License.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
        m.Product.find({}).sort({ position: 1 }).select('name').lean()
      ]);
      res.render('staff/licenses', {
        user: req.user,
        existingUser: req.user,
        licenses: licenses.map(function (l) { l.plainKey = licensing.decryptKey(l.keyEnc); return l; }),
        products: products,
        issued: req.query.issued ? String(req.query.issued) : null,
        q: q,
        status: status
      });
    } catch (e) { next(e); }
  });

  app.post('/staff/licenses/create', checkAuth, checkStaff, sec.limiters.write, csrf, async (req, res, next) => {
    try {
      const product = await m.Product.findById(req.body.product);
      if (!product) return res.status(400).send('Choose a product.');
      const expiresAt = req.body.days ? new Date(Date.now() + parseInt(req.body.days, 10) * 864e5) : null;
      const out = await licensing.createLicense({
        product: product._id,
        productName: product.name,
        ownerID: clean(req.body.ownerID, 64) || null,
        ownerUsername: clean(req.body.ownerUsername, 64) || null,
        orderID: req.body.orderID ? parseInt(req.body.orderID, 10) : null,
        maxHwid: req.body.maxHwid === '' ? 0 : parseInt(req.body.maxHwid || '1', 10),
        sessionLimit: parseInt(req.body.sessionLimit || '0', 10),
        ipLimit: parseInt(req.body.ipLimit || '0', 10),
        expiresAt: expiresAt,
        notes: clean(req.body.notes, 500)
      });
      audit.log(req, 'license.create', 'license', out.license._id, 'Issued license for ' + product.name, { ownerID: out.license.ownerID });
      res.redirect('/staff/licenses?issued=' + encodeURIComponent(out.key));
    } catch (e) { next(e); }
  });

  const licenseActions = {
    suspend: function (l) { l.status = 'suspended'; },
    ban: function (l, body) { l.status = 'banned'; l.banReason = clean(body.reason, 200) || 'Revoked by staff'; },
    unban: function (l) { l.status = 'active'; l.banReason = ''; },
    reset: function (l) { l.hwid = null; l.hwidLockedAt = null; l.sessions = []; },
    extend: function (l, body) {
      const days = parseInt(body.days || '30', 10);
      const base = l.expiresAt && l.expiresAt > new Date() ? new Date(l.expiresAt) : new Date();
      l.expiresAt = new Date(base.getTime() + days * 864e5);
    },
    note: function (l, body) { l.notes = clean(body.notes, 500); }
  };

  app.post('/staff/licenses/:id/:action', checkAuth, checkStaff, sec.limiters.write, csrf, async (req, res, next) => {
    try {
      const fn = licenseActions[req.params.action];
      if (!fn) return res.status(400).send('Unknown action.');
      const license = await m.License.findById(req.params.id);
      if (!license) return res.status(404).send('License not found.');
      fn(license, req.body);
      await license.save();
      audit.log(req, 'license.' + req.params.action, 'license', license._id, 'License ' + req.params.action + ' on ' + license.productName);
      res.redirect('/staff/licenses');
    } catch (e) { next(e); }
  });

  app.post('/staff/licenses/:id/delete', checkAuth, checkStaff, sec.limiters.write, csrf, async (req, res, next) => {
    try {
      const license = await m.License.findByIdAndDelete(req.params.id);
      if (license) audit.log(req, 'license.delete', 'license', req.params.id, 'Deleted license for ' + license.productName);
      res.redirect('/staff/licenses');
    } catch (e) { next(e); }
  });

  /* ── support tickets ────────────────────────────────────────────── */
  app.get('/tickets', checkAuth, sec.limiters.read, async (req, res, next) => {
    try {
      const tickets = await m.Ticket.find({ userID: req.user.id }).sort({ lastReplyAt: -1 }).limit(100).lean();
      res.render('tickets', { user: req.user, existingUser: req.user, tickets });
    } catch (e) { next(e); }
  });

  app.post('/tickets', checkAuth, sec.limiters.write, csrf, async (req, res, next) => {
    try {
      const subject = clean(req.body.subject, 200);
      const body = clean(req.body.body, 8000);
      if (!subject || !body) return res.redirect('/tickets?error=empty');
      const reference = 'TKT-' + sec.publicCode(8);
      const owned = await m.User.findOne({ discordID: req.user.id }).select('email').lean();
      const ticket = await m.Ticket.create({
        reference: reference,
        subject: subject,
        category: ['technical', 'billing', 'account', 'feature-request', 'other'].indexOf(req.body.category) > -1 ? req.body.category : 'technical',
        priority: ['low', 'normal', 'high', 'urgent'].indexOf(req.body.priority) > -1 ? req.body.priority : 'normal',
        status: 'open',
        userID: req.user.id,
        username: req.user.username,
        email: owned ? owned.email : null,
        product: req.body.product || null,
        productName: clean(req.body.productName, 120),
        orderID: req.body.orderID ? parseInt(req.body.orderID, 10) : null,
        messages: [{ authorID: req.user.id, authorName: req.user.username, authorRole: 'buyer', body: body, createdAt: new Date() }]
      });
      audit.log(req, 'ticket.create', 'ticket', ticket._id, 'Opened ticket ' + ticket.reference, { subject: subject });
      res.redirect('/tickets/' + ticket._id);
    } catch (e) { next(e); }
  });

  app.get('/tickets/:id', checkAuth, sec.limiters.read, async (req, res, next) => {
    try {
      const ticket = await m.Ticket.findById(req.params.id).lean();
      if (!ticket) return res.status(404).render('error', { errorMessage: 'That ticket does not exist.' });
      const isStaff = typeof req.isStaff === 'function' && req.isStaff();
      if (!isStaff && ticket.userID !== req.user.id) return res.status(403).render('error', { errorMessage: 'You do not have access to that ticket.' });
      res.render('ticket', { user: req.user, existingUser: req.user, ticket: ticket, isStaff: isStaff });
    } catch (e) { next(e); }
  });

  app.post('/tickets/:id/reply', checkAuth, sec.limiters.write, csrf, async (req, res, next) => {
    try {
      const ticket = await m.Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).send('Ticket not found.');
      const isStaff = typeof req.isStaff === 'function' && req.isStaff();
      if (!isStaff && ticket.userID !== req.user.id) return res.status(403).send('Access denied.');
      const body = clean(req.body.body, 8000);
      if (!body) return res.redirect('/tickets/' + ticket._id);
      ticket.messages.push({
        authorID: req.user.id,
        authorName: req.user.username,
        authorRole: isStaff ? 'staff' : 'buyer',
        body: body,
        createdAt: new Date()
      });
      ticket.status = isStaff ? 'awaiting-customer' : 'awaiting-staff';
      ticket.lastReplyAt = new Date();
      await ticket.save();
      audit.log(req, 'ticket.reply', 'ticket', ticket._id, 'Replied on ' + ticket.reference);
      res.redirect('/tickets/' + ticket._id);
    } catch (e) { next(e); }
  });

  app.post('/tickets/:id/status', checkAuth, sec.limiters.write, csrf, async (req, res, next) => {
    try {
      const ticket = await m.Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).send('Ticket not found.');
      const isStaff = typeof req.isStaff === 'function' && req.isStaff();
      if (!isStaff && ticket.userID !== req.user.id) return res.status(403).send('Access denied.');
      const allowed = isStaff
        ? ['open', 'awaiting-customer', 'awaiting-staff', 'resolved', 'closed']
        : ['open', 'closed'];
      const nextStatus = allowed.indexOf(req.body.status) > -1 ? req.body.status : ticket.status;
      ticket.status = nextStatus;
      if (nextStatus === 'resolved' || nextStatus === 'closed') ticket.resolvedAt = new Date();
      if (isStaff && req.body.assignedTo !== undefined) ticket.assignedTo = clean(req.body.assignedTo, 64) || null;
      await ticket.save();
      audit.log(req, 'ticket.status', 'ticket', ticket._id, 'Status set to ' + nextStatus);
      res.redirect('/tickets/' + ticket._id);
    } catch (e) { next(e); }
  });

  app.get('/staff/tickets', checkAuth, checkStaff, sec.limiters.read, async (req, res, next) => {
    try {
      const status = String(req.query.status || '');
      const filter = {};
      if (status) filter.status = status;
      const tickets = await m.Ticket.find(filter).sort({ lastReplyAt: -1 }).limit(200).lean();
      res.render('staff/tickets', { user: req.user, existingUser: req.user, tickets: tickets, status: status });
    } catch (e) { next(e); }
  });

  /* ── staff audit log ────────────────────────────────────────────── */
  app.get('/staff/audit', checkAuth, checkStaff, sec.limiters.read, async (req, res, next) => {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const perPage = 60;
      const action = String(req.query.action || '').trim();
      const entity = String(req.query.entity || '').trim();
      const filter = {};
      if (action) filter.action = new RegExp('^' + action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (entity) filter.entity = entity;
      const [entries, total, actions] = await Promise.all([
        m.AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
        m.AuditLog.countDocuments(filter),
        m.AuditLog.distinct('action')
      ]);
      res.render('staff/audit', {
        user: req.user,
        existingUser: req.user,
        entries: entries,
        total: total,
        page: page,
        pages: Math.max(Math.ceil(total / perPage), 1),
        action: action,
        entity: entity,
        actions: actions.sort()
      });
    } catch (e) { next(e); }
  });

  /* ── audit CSV export ───────────────────────────────────────────── */
  app.get('/staff/audit/export', checkAuth, checkStaff, sec.limiters.read, async (req, res, next) => {
    try {
      const entries = await m.AuditLog.find({}).sort({ createdAt: -1 }).limit(10000).lean();
      const header = 'time,actor,action,entity,entity_id,summary,ip';
      const lines = entries.map(function (e) {
        return [e.createdAt.toISOString(), e.actorUsername, e.action, e.entity || '', e.entityID || '', (e.summary || '').replace(/"/g, '""'), e.ip || ''].map(function (v) {
          return '"' + String(v == null ? '' : v) + '"';
        }).join(',');
      });
      audit.log(req, 'audit.export', 'audit', null, 'Exported audit log');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-' + Date.now() + '.csv"');
      res.send(header + '\n' + lines.join('\n'));
    } catch (e) { next(e); }
  });

  function cleanKey(v) { return clean(v, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-'); }
};
