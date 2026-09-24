const Translation = require('../models/translationModel');

const SUPPORTED = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
  { code: 'pl', label: 'Polish', native: 'Polski' },
  { code: 'tr', label: 'Turkish', native: 'Türkçe' },
  { code: 'ru', label: 'Russian', native: 'Русский' },
  { code: 'ar', label: 'Arabic', native: 'العربية', rtl: true },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia' }
];

const COOKIE = 'credas_lang';
let cache = { at: 0, data: {} };
const TTL = 30 * 1000;

function supported() { return SUPPORTED; }
function isSupported(code) { return SUPPORTED.some(function (l) { return l.code === code; }); }
function meta(code) { return SUPPORTED.find(function (l) { return l.code === code; }) || null; }

function detect(req) {
  const q = req.query && req.query.lang;
  if (q && isSupported(q)) return q;
  const cookie = req.cookies && req.cookies[COOKIE];
  if (cookie && isSupported(cookie)) return cookie;
  const header = String(req.headers['accept-language'] || '');
  const wanted = header.split(',').map(function (part) {
    const bits = part.trim().split(';q=');
    return { code: bits[0].toLowerCase(), q: bits[1] ? parseFloat(bits[1]) : 1 };
  }).filter(function (x) { return x.code && x.code.length >= 2; })
    .sort(function (a, b) { return b.q - a.q; });
  for (const w of wanted) {
    const base = w.code.split('-')[0];
    if (isSupported(w.code)) return w.code;
    if (isSupported(base)) return base;
  }
  return 'en';
}

async function load() {
  if (Date.now() - cache.at < TTL) return cache.data;
  try {
    const rows = await Translation.find({}).lean();
    const next = {};
    rows.forEach(function (r) {
      if (!next[r.locale]) next[r.locale] = {};
      next[r.locale][r.key] = r.value;
    });
    cache = { at: Date.now(), data: next };
  } catch (e) {
    cache = { at: Date.now(), data: cache.data };
  }
  return cache.data;
}

function invalidate() { cache.at = 0; }

function translate(locale, key, vars) {
  const table = cache.data[locale] || {};
  let value = table[key];
  if (value == null) value = (cache.data.en || {})[key];
  if (value == null) return key;
  if (!vars) return value;
  return String(value).replace(/\{(\w+)\}/g, function (m, name) {
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m;
  });
}

function middleware() {
  return async function (req, res, next) {
    const locale = detect(req);
    res.locals.locale = locale;
    res.locals.locales = SUPPORTED;
    res.locals.dir = (meta(locale) && meta(locale).rtl) ? 'rtl' : 'ltr';
    res.locals.t = function (key, vars) { return translate(locale, key, vars); };
    res.locals.hasTranslation = function (key) {
      return !!(cache.data[locale] && cache.data[locale][key] != null);
    };
    if (res.cookie) res.cookie(COOKIE, locale, { maxAge: 365 * 24 * 3600 * 1000, sameSite: 'lax' });
    await load();
    next();
  };
}

module.exports = { SUPPORTED, supported, isSupported, meta, detect, load, translate, middleware, invalidate, COOKIE };
