const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const TRUST_PROXY = process.env.TRUST_PROXY || 1;

function requestId() {
  return crypto.randomBytes(8).toString('hex');
}

function securityHeaders(app) {
  app.set('trust proxy', TRUST_PROXY);

  app.use((req, res, next) => {
    const id = requestId();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      process.stdout.write(JSON.stringify({
        level,
        msg: 'request',
        id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Math.round(ms * 100) / 100,
        ip: req.ip
      }) + '\n');
    });
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://cdnjs.cloudflare.com'],
        // Helmet's defaults set script-src-attr 'none', which blocks every inline
        // event handler (onclick, onsubmit, ...) independently of script-src.
        // The views rely on inline handlers throughout, so this must be allowed.
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://cdn.discordapp.com', 'https://discordapp.com'],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: configUpgrade()
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 15552000, includeSubDomains: true, preload: false }
  }));

  function configUpgrade() {
    return process.env.NODE_ENV === 'production' ? [] : null;
  }
}

function makeLimiter(opts) {
  return rateLimit(Object.assign({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' });
    }
  }, opts));
}

const limiters = {
  auth: makeLimiter({ windowMs: 15 * 60 * 1000, max: 20, skipSuccessfulRequests: true }),
  login: makeLimiter({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true }),
  write: makeLimiter({ windowMs: 10 * 60 * 1000, max: 40 }),
  checkout: makeLimiter({ windowMs: 10 * 60 * 1000, max: 25 }),
  read: makeLimiter({ windowMs: 60 * 1000, max: 180 }),
  search: makeLimiter({ windowMs: 60 * 1000, max: 60 }),
  api: makeLimiter({ windowMs: 60 * 1000, max: 120 }),
  license: makeLimiter({ windowMs: 60 * 1000, max: 30 })
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(value) {
  return String(value == null ? '' : value).replace(/<[^>]*>/g, '');
}

function cleanText(value, maxLength) {
  return stripTags(value).trim().slice(0, maxLength || 2000);
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyHmacSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(expected, signature);
}

function publicCode(len) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(len || 10);
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '')) && String(value).length <= 160;
}

function isSafeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw)) return true;
  if (/^\/(?!\/)/.test(raw)) return true;
  if (/^mailto:/i.test(raw)) return true;
  return false;
}

module.exports = {
  securityHeaders,
  limiters,
  requestId,
  escapeHtml,
  stripTags,
  cleanText,
  timingSafeEqual,
  verifyHmacSignature,
  publicCode,
  isEmail,
  isSafeUrl
};
