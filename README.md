# Credas — Source

**v2.0.0** · A self-hosted digital storefront for bots, addons, source code and licence keys. Node.js + Express + MongoDB, with Discord OAuth login and hardware-bound licence keys.

Buy this source, run it on your own server, and it becomes your store. No monthly fee, no vendor lock-in, no telemetry — it talks to nothing except the payment providers and Discord you configure.

---

## What's in the box

- **Storefront** — product catalogue, categories, tags, search, sorting, product pages with version history and instant file delivery
- **Cart & checkout** — Stripe, PayPal, Coinbase Commerce, discount codes, wishlist
- **Licensing** — `CREDAS-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` keys, AES-256-GCM encrypted at rest, HWID device binding, session and IP limits, expiry, ban/unban
- **Licence API** — HTTP verify/activate/deactivate, with working snippets for Node, Python, PHP, C#, Go and cURL
- **Staff panel** — products, users, sales, discounts, licences, tickets, status page, audit log, full homepage customiser
- **Platform** — support tickets, public status page, order lookup, 10 languages with RTL, CSV audit export
- **Security** — Helmet CSP, rate limiting, CSRF, HMAC-signed order links, timing-safe key comparison, structured JSON logging
- **Zero-config database** — collections and default settings are created on first boot

---

## Requirements

| | Version |
| --- | --- |
| Node.js | **18 or newer** (the app exits below 18) |
| MongoDB | 5+ (local, Atlas, or Docker) |

---

## Install

```bash
# 1. Unzip, then install dependencies
npm install

# 2. Create your own config
cp config.yml config.local.yml
$EDITOR config.local.yml

# 3. Point MongoURI at your database, then run
npm start
```

Open `http://localhost:3000` and check it is alive:

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok","uptime":8,"database":"connected","version":"2.0.0","time":"..."}
```

### The two config files

| File | Contains | Safe to share? |
| --- | --- | --- |
| `config.yml` | Placeholders only | Yes |
| `config.local.yml` | **Your** credentials | **No** — gitignored |

`config.local.yml` is deep-merged over `config.yml` at startup, so you only write the keys you want to change. The shipped `config.yml` has no secrets in it, which is why it is safe to commit or share.

### It boots before you finish configuring

You do not need everything set at once. On a fresh install the store starts
immediately and tells you what is missing:

```
[payments] Stripe is disabled — /checkout/stripe is unavailable.
[auth] Discord OAuth is not configured — login is disabled.
```

The storefront browses, `/health` responds, and the database seeds its own
defaults. Payment buttons stay hidden and login returns a short setup message
until you fill in the corresponding config. Fix one section, restart, move on.

---

## Required configuration

The store will not be useful until these are set in `config.local.yml`:

| Key | What it is |
| --- | --- |
| `MongoURI` | Your MongoDB connection string |
| `OwnerID` | Your Discord user ID — this is who gets staff access |
| `clientID` / `clientSecret` / `callbackURL` | Discord OAuth2 app, for buyer login |
| `secretKey` | Long random string, 20+ characters |
| `baseURL` | Your public URL, no trailing slash |

Optional but commonly needed: `Token` + `GuildID` (Discord bot for logging and role grants), the `Payments` block, and `EmailSettings` for invoices and licence delivery.

**Getting your Discord user ID:** enable Developer Mode in Discord settings, then right-click your avatar → Copy User ID.

Full walkthrough, including Discord OAuth, payments and email: **[SETUP.md](SETUP.md)**.

---

## First five minutes after install

1. Log in at `/login` with Discord
2. **Staff → Settings** — store name, accent colour, fonts, logo
3. **Staff → Page customisation** — homepage copy, section visibility, feature cards, FAQ
4. **Staff → Products → Create** — add a product and upload a file
5. **Staff → Licenses → Issue a license** — mint a key and verify it with the snippet in [API.md](API.md)

---

## Project layout

```
app.js              Express app — middleware, storefront routes, staff panel
index.js            Entrypoint — Discord client + HTTP server
config.js           Config loader (template + local override)
config.yml          Config template (no credentials)
config.local.yml    Your credentials (gitignored)

models/             Mongoose schemas
routes/platform.js  Health, status, orders, licences, tickets, audit, i18n
utils/              security.js, licensing.js, audit.js, i18n.js
views/              EJS templates (partials/ and staff/ included)
public/             css/credas.css, js/credas.js, images/
uploads/            Product files and images
```

---

## How the licence keys work

Keys are never stored in plain text.

1. **Issued** from the staff panel, or automatically against a product at checkout.
2. **Encrypted** with AES-256-GCM into `keyEnc`; a SHA-256 digest in `keyHash` is the indexed lookup field.
3. **Bound** — the first successful verify that supplies an `hwid` locks the key to that device. A different HWID is rejected with `HWID_MISMATCH` unless the key allows more devices.
4. **Tracked** — every check records the timestamp, last IP, and total count; active `sessionId`s enforce the concurrent-session limit.

| Code | Meaning |
| --- | --- |
| `VALID` | Key is good |
| `INVALID_KEY` | No such key |
| `EXPIRED` | Past its expiry date |
| `BANNED` / `SUSPENDED` | Withdrawn by staff |
| `HWID_MISMATCH` | Active on a different device |
| `IP_LIMIT` / `SESSION_LIMIT` | Usage caps reached |
| `HWID_DISABLED` | Key is not device-bound |

Integrating it into your product takes one HTTP call:

```js
const res = await fetch('https://yourstore.example/api/license/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key, hwid, sessionId })
});
const { valid, code, data } = await res.json();
```

Full reference and snippets in five more languages: **[API.md](API.md)**.

---

## Before you go live

- [ ] Rotate `secretKey` to a long random value
- [ ] Set `OwnerID` to your Discord ID and remove the placeholder
- [ ] Set `Secure: true` and `trustProxy: true` if you are behind a reverse proxy
- [ ] Make `baseURL` and `callbackURL` both the real HTTPS domain
- [ ] Keep `config.local.yml` out of version control
- [ ] Require authentication on MongoDB and keep it off the public internet
- [ ] Back up MongoDB and the `uploads/` directory
- [ ] Run under a process manager (`pm2 start index.js --name credas`)

---

## Documentation

| File | Covers |
| --- | --- |
| **[SETUP.md](SETUP.md)** | Install, Discord OAuth, payments, email, production hardening, troubleshooting |
| **[API.md](API.md)** | Every endpoint, rate limits, error codes, licence verification snippets |

---

## Requirements & support

Node.js 18+, MongoDB 5+. Runs on any VPS or container host that can run Node.

You are responsible for your own hosting, backups and payment-provider accounts. Test payments in sandbox mode before going live.

---

## Licence

MIT — see [LICENSE](LICENSE). Use it commercially, modify it, resell it, host it for your own store. No attribution required.
