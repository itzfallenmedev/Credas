const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = __dirname;
const BASE = path.join(ROOT, 'config.yml');
const LOCAL = path.join(ROOT, 'config.local.yml');

function read(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return yaml.load(fs.readFileSync(file, 'utf8')) || null;
  } catch (e) {
    throw new Error(`Failed to parse ${path.basename(file)}: ${e.message}`);
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// config.local.yml is deep-merged over config.yml so buyers can keep their
// secrets out of version control while the tracked file stays a clean template.
function merge(base, override) {
  const out = Object.assign({}, base);
  for (const key of Object.keys(override || {})) {
    if (isPlainObject(out[key]) && isPlainObject(override[key])) out[key] = merge(out[key], override[key]);
    else out[key] = override[key];
  }
  return out;
}

const base = read(BASE);
if (!base) throw new Error('config.yml is missing. Restore it from your purchase, or copy config.yml from a fresh download and edit it.');

const config = merge(base, read(LOCAL));

if (!Array.isArray(config.OwnerID) || !config.OwnerID.length) {
  console.warn('[config] OwnerID is empty — nobody will have staff access until you set it.');
}

const PLACEHOLDER_SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';
if (config.secretKey === PLACEHOLDER_SECRET) {
  console.warn('\n[config] secretKey is still the template placeholder.');
  console.warn('[config] Set a long random value in config.local.yml before going live.\n');
}

module.exports = config;
module.exports.load = () => config;
