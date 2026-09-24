const AuditLog = require('../models/auditLogModel');
let debugMode = false;
try { debugMode = require('../config.js').DebugMode === true; } catch (e) {}

const FLUSH_AT = 25;
const FLUSH_EVERY_MS = 10 * 1000;
const MAX_BUFFER = 500;

let buffer = [];
let sinceFlush = 0;
let timer = null;

async function flush() {
  if (!buffer.length) return;
  const batch = buffer.splice(0, buffer.length);
  sinceFlush = 0;
  try {
    await AuditLog.insertMany(batch, { ordered: false });
  } catch (e) {
    if (debugMode) console.error('[audit] flush failed', e.message);
  }
}

function schedule() {
  if (timer) return;
  timer = setInterval(flush, FLUSH_EVERY_MS);
  if (timer.unref) timer.unref();
}

function log(req, action, entity, entityID, summary, meta) {
  try {
    const user = (req && req.user) || {};
    const entry = {
      actorID: user.id || null,
      actorUsername: user.username || user.global_name || 'system',
      action: String(action || '').slice(0, 80),
      entity: entity ? String(entity).slice(0, 40) : null,
      entityID: entityID ? String(entityID).slice(0, 64) : null,
      summary: summary ? String(summary).slice(0, 300) : '',
      meta: meta && typeof meta === 'object' ? meta : {},
      ip: (req && req.ip) || null,
      userAgent: req && req.get ? (req.get('user-agent') || '').slice(0, 200) : null
    };
    buffer.push(entry);
    sinceFlush += 1;
    if (buffer.length >= MAX_BUFFER || sinceFlush >= FLUSH_AT) {
      flush();
    }
    schedule();
    return entry;
  } catch (e) {
    return null;
  }
}

function record(actor, action, entity, entityID, summary, meta, req) {
  return log(
    req || { user: actor || null },
    action, entity, entityID, summary, meta
  );
}

process.on('exit', () => {
  if (!buffer.length) return;
  try {
    AuditLog.insertMany(buffer.splice(0, buffer.length), { ordered: false }).exec();
  } catch (e) {}
});

module.exports = { log, record, flush, FLUSH_EVERY_MS };
