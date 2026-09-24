const crypto = require('crypto');
const config = require('../config.js');
const License = require('../models/licenseModel');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'CREDAS';

let secret = null;
function getSecret() {
  if (secret) return secret;
  secret = (config && config.secretKey) || 'credas-license-fallback-secret';
  return secret;
}

function aesKey() {
  return crypto.createHash('sha256').update('credas-license:' + getSecret()).digest();
}

function group(str, size) {
  const out = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out.join('-');
}

function generateKey(prefix) {
  const bytes = crypto.randomBytes(25);
  let body = '';
  for (let i = 0; i < bytes.length; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  return (prefix || PREFIX) + '-' + group(body, 5);
}

function normalizeKey(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function hashKey(key) {
  return crypto.createHash('sha256').update(normalizeKey(key)).digest('hex');
}

function encryptKey(key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(), iv);
  const enc = Buffer.concat([cipher.update(normalizeKey(key), 'utf8'), cipher.final()]);
  return iv.toString('base64') + '.' + cipher.getAuthTag().toString('base64') + '.' + enc.toString('base64');
}

function decryptKey(payload) {
  try {
    const parts = String(payload || '').split('.');
    if (parts.length !== 3) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey(), Buffer.from(parts[0], 'base64'));
    decipher.setAuthTag(Buffer.from(parts[1], 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64')), decipher.final()]).toString('utf8');
  } catch (e) {
    return null;
  }
}

function blankKey() {
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return group(out, 4);
}

async function createLicense(opts) {
  const key = generateKey(opts.prefix);
  const doc = await License.create({
    keyHash: hashKey(key),
    keyEnc: encryptKey(key),
    product: opts.product,
    productName: opts.productName,
    ownerID: opts.ownerID || null,
    ownerUsername: opts.ownerUsername || null,
    orderID: opts.orderID || null,
    maxHwid: opts.maxHwid == null ? 1 : opts.maxHwid,
    sessionLimit: opts.sessionLimit || 0,
    ipLimit: opts.ipLimit || 0,
    expiresAt: opts.expiresAt || null,
    notes: opts.notes || ''
  });
  return { license: doc, key };
}

async function findByKey(key) {
  return License.findOne({ keyHash: hashKey(key) });
}

async function issueForProduct(product, user, orderID) {
  const existing = await License.findOne({ product: product._id, ownerID: user.discordID, orderID: orderID || null });
  if (existing) return { license: existing, key: decryptKey(existing.keyEnc) };
  return createLicense({
    product: product._id,
    productName: product.name,
    ownerID: user.discordID,
    ownerUsername: user.discordUsername,
    orderID: orderID || null,
    maxHwid: product.licenseMaxHwid == null ? 1 : product.licenseMaxHwid,
    sessionLimit: product.licenseSessionLimit || 0,
    ipLimit: product.licenseIpLimit || 0
  });
}

async function verify(input) {
  const key = input.key;
  if (!key) return { valid: false, code: 'NO_KEY', message: 'No license key supplied.' };

  const license = await findByKey(key);
  if (!license) return { valid: false, code: 'INVALID_KEY', message: 'That license key does not exist.' };

  const status = license.effectiveStatus();
  if (status === 'banned') return { valid: false, code: 'BANNED', message: license.banReason || 'This license has been revoked.', license };
  if (status === 'suspended') return { valid: false, code: 'SUSPENDED', message: 'This license is temporarily suspended.', license };
  if (status === 'expired') return { valid: false, code: 'EXPIRED', message: 'This license has expired.', license };

  const hwid = input.hwid ? String(input.hwid).trim().slice(0, 160) : null;
  const ip = input.ip ? String(input.ip).slice(0, 64) : null;

  if (hwid) {
    if (!license.hwid) {
      if (license.maxHwid === 0) {
        return { valid: false, code: 'HWID_DISABLED', message: 'This license is not bound to a device.', license };
      }
      license.hwid = hwid;
      license.hwidLockedAt = new Date();
    } else if (license.hwid !== hwid) {
      return { valid: false, code: 'HWID_MISMATCH', message: 'This license is already active on another device.', license };
    }
  }

  if (license.ipLimit > 0) {
    const seen = license.ipHistory || [];
    if (ip && seen.indexOf(ip) === -1) {
      if (seen.length >= license.ipLimit) {
        return { valid: false, code: 'IP_LIMIT', message: 'This license has reached its IP limit.', license };
      }
      seen.push(ip);
      license.ipHistory = seen.slice(-20);
    }
  }

  if (license.sessionLimit > 0 && input.sessionId) {
    const sessions = license.sessions || [];
    const idx = sessions.findIndex(function (s) { return s.sessionId === String(input.sessionId); });
    const now = Date.now();
    const live = sessions.filter(function (s) { return now - new Date(s.lastSeenAt).getTime() < 15 * 60 * 1000; });
    if (idx === -1 && live.length >= license.sessionLimit) {
      return { valid: false, code: 'SESSION_LIMIT', message: 'Too many active sessions for this license.', license };
    }
    if (idx > -1) live[idx].lastSeenAt = now;
    else live.push({ sessionId: String(input.sessionId).slice(0, 80), lastSeenAt: now });
    license.sessions = live.slice(-20);
  }

  license.lastSeenAt = new Date();
  license.lastIp = ip || license.lastIp;
  license.totalChecks = (license.totalChecks || 0) + 1;
  await license.save();

  return {
    valid: true,
    code: 'VALID',
    message: 'License is valid.',
    license: {
      product: license.productName,
      expiresAt: license.expiresAt,
      hwidLocked: !!license.hwid,
      status: status
    }
  };
}

module.exports = {
  generateKey, normalizeKey, hashKey, encryptKey, decryptKey, blankKey,
  createLicense, findByKey, issueForProduct, verify, PREFIX
};
