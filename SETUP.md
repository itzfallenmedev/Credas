# Setup

Installation and configuration for Credas 2.0.0.

**Contents:** [Requirements](#requirements) · [Install](#1-install) · [MongoDB](#2-mongodb) · [config.yml](#3-configyml) · [Discord](#4-discord) · [Payments](#5-payments) · [Email](#6-email) · [First run](#7-first-run) · [Production](#8-production-hardening) · [Troubleshooting](#9-troubleshooting)

---

## Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | **18+** | The app exits below 18 |
| MongoDB | 5+ | Local, Atlas, or container |
| Discord app | — | For OAuth2 login and the bot |
| `sharp` | — | Needs prebuilt binaries; falls back to source build |

> `sharp` is a native module. On Debian/Ubuntu you may need `build-essential` and `python3` if no prebuilt binary matches your platform.

---

## 1. Install

```bash
git clone <your-repo-url> credas
cd credas
npm install
```

Verify:

```bash
node -v     # must be >= 18
```

---

## 2. MongoDB

Any of these work.

**Local install**

```bash
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod
```

**Docker (what this workspace uses)**

```bash
docker run -d --name credas-mongo \
  -p 27017:27017 \
  -v credas-mongo-data:/data/db \
  mongo:7
```

**MongoDB Atlas**

1. Create a free M0 cluster.
2. Database Access → add a database user.
3. Network Access → allow your host (or `0.0.0.0/0` for testing only).
4. Copy the connection string into `MongoURI`.

Point `MongoURI` at it:

```yaml
MongoURI: "mongodb://127.0.0.1:27017/credas"
```

Collections and default settings are created automatically on first boot — there is no migration step.

---

## 3. Configuration

Credas uses two files, merged at startup by `config.js`:

| File | Purpose | Tracked? |
| --- | --- | --- |
| `config.yml` | Safe template with placeholders — **never put credentials here** | Yes |
| `config.local.yml` | Your values, deep-merged over the template | No — gitignored |

Create yours once:

```bash
cp config.yml config.local.yml
```

`config.local.yml` wins on any key it defines; everything else falls back to `config.yml`. You only write what you want to change. Both are read from the **repository root**, so always start the app from that directory.


### Core

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `MongoURI` | string | `mongodb://127.0.0.1:27017/credas` | Mongo connection string |
| `DebugMode` | bool | `false` | Verbose logging |
| `OwnerID` | string[] | `["YOUR_DISCORD_USER_ID"]` | Discord user IDs with full staff access |
| `Port` | number | `3000` | HTTP port |
| `baseURL` | string | `http://localhost:3000` | Exact public URL, **no trailing slash** |
| `SessionExpires` | duration | `7d` | Session lifetime |
| `Secure` | bool | `false` | Set `true` when serving over HTTPS — makes the session cookie secure-only |
| `trustProxy` | bool | `false` | Set `true` behind a reverse proxy (Cloudflare, Nginx) so rate limiting sees real IPs |

### Discord

| Key | Notes |
| --- | --- |
| `Token` | Bot token. Needed for logging, role grants, auto-join |
| `GuildID` | Your server ID (right-click server → Copy ID) |
| `autoJoinUsers` | Add users to the server on first login |
| `clientID` / `clientSecret` | From the Developer Portal |
| `callbackURL` | Must match a Redirect URL in the Portal exactly |

### Sessions

```yaml
secretKey: "<long random string>"   # >= 20 chars; a password manager is ideal
```

Rotating `secretKey` invalidates every session.

### Payments

Each provider has an `Enabled` flag. Turn off what you do not use.

```yaml
Payments:
  PayPal:    { Enabled: false, clientID: "", clientSecret: "" }
  Stripe:    { Enabled: false, secretKey: "" }
  Coinbase:  { Enabled: false, ApiKey: "", WebhookSecret: "" }
```

### Email

```yaml
EmailSettings:
  Enabled: true
  fromEmail: "store@yourdomain.com"
  provider: "sendgrid"        # or "smtp"
  sendGrid:
    token: "SG.xxxxx"
  smtp:
    host: "smtp.example.com"
    port: 587
    secure: false             # true for SSL (465)
    user: "you@example.com"
    password: "xxxx"
```

Order invoices and licence keys are unusable without this.

### Product versions

```yaml
productVersions:
  autoDeleteOldFiles: false
  maxVersionsToKeep: 5
```

### Redirects

Optional catch-all rules, applied in order.

```yaml
Redirects:
  - path: "/old-path/*"
    target: "https://example.com/:wildcard"
    method: "GET"        # optional, default GET
    statusCode: 301      # optional, default 301
```

---

## 4. Discord

Credas boots even when Discord OAuth is not configured yet — the storefront
browses normally, `/login` explains what is missing, and payment buttons stay
hidden until a provider is enabled. You will see this on startup:

```
[auth] Discord OAuth is not configured — login is disabled.
[auth] Set clientID, clientSecret and callbackURL in config.local.yml
```

The same applies to payments: each provider that is `Enabled: false` logs a
line and its checkout route returns `503` instead of crashing the store.


### Create the application

1. <https://discord.com/developers/applications> → **New Application**.
2. **OAuth2 → URL Generator**: select `identify` and `email`, copy the **Client ID** and **Client Secret**.
3. **OAuth2 → Redirects** → add your exact callback:
   - Local: `http://localhost:3000/auth/discord/callback`
   - Production: `https://yourdomain.com/auth/discord/callback`
4. Copy both into `clientID` and `clientSecret` in `config.local.yml`, and set `callbackURL` to the same value you registered.

> The redirect URL must match character-for-character, including scheme, port and trailing path.

### Create the bot

1. **Bot** → **Reset Token** → copy into `Token`.
2. Enable **Server Members Intent** and **Presence Intent** under **Privileged Gateway Intents**.
3. Invite it with `bot` + `applications.commands` scopes to the server whose ID is in `GuildID`.

### Grant yourself staff

Put your own Discord user ID in `config.local.yml`:

```yaml
OwnerID: ["123456789012345678"]
```

Enable Developer Mode in Discord (User Settings → Advanced), then right-click yourself → **Copy User ID**.

Restart after changing this. Anyone not in `OwnerID` is redirected away from `/staff/*`.

---

## 5. Payments

### Stripe

Dashboard → **Developers → API keys** → copy the **Secret key** into `Payments.Stripe.secretKey`.

### PayPal

Requires a **business** account. Developer dashboard → **Apps & Credentials** → Live → copy the client ID and secret. Personal accounts cannot process these payments.

### Coinbase Commerce

1. Coinbase Commerce dashboard → **API keys** → copy into `ApiKey`.
2. Copy the webhook secret into `WebhookSecret`.
3. **Add an endpoint**: `https://yourdomain.com/webhooks/coinbase`

### Local testing

Stripe publishes test cards (`4242 4242 4242 4242`, any future expiry, any CVC). Coinbase and PayPal have their own sandbox modes.

---

## 6. Email

Pick one provider:

- **SendGrid** — `provider: "sendgrid"`, set `sendGrid.token`
- **SMTP** — `provider: "smtp"`, fill in the `smtp` block

`fromEmail` should be a domain you can send from (SPF/DKIM configured), or messages will land in spam.

---

## 7. First run

```bash
npm start
```

Expected output:

```
Starting product, this can take a while..
Credas v2.0.0 is now Online!
```

Then:

```bash
curl http://127.0.0.1:3000/health
```

```json
{"status":"ok","uptime":8,"database":"connected","version":"2.0.0","time":"..."}
```

Now, in order:

1. **Log in** with Discord at `/login`.
2. **Staff → Settings** — set store name, accent colour, fonts, logo.
3. **Staff → Page customisation** — homepage copy, section visibility, features, FAQ.
4. **Staff → Products → Create** — add your first product and upload a file.
5. **Staff → Licenses → Issue a license** — mint a test key and verify it (see [API.md](API.md)).
6. Place a test order and confirm the file appears on the buyer's profile.

> **Maintenance mode:** if the site shows "The store is closed for maintenance", someone submitted the staff settings form with maintenance enabled. It lives at `Settings → maintenanceMode` in Mongo:
>
> ```js
> db.settings.updateOne({}, { $set: { maintenanceMode: false } });
> ```

---

## 8. Production hardening

**Run under a process manager**

```bash
npm install -g pm2
pm2 start index.js --name credas
pm2 save
pm2 startup
```

**Environment**

```bash
NODE_ENV=production   # enables CSP upgrade-insecure-requests
TRUST_PROXY=true      # if behind a reverse proxy
```

**Reverse proxy**

Set in `config.yml`:

```yaml
Secure: true
trustProxy: true
```

**Checklist**

- [ ] Rotate `Token`, `clientSecret`, and `secretKey`
- [ ] Remove the `USER_ID` placeholder from `OwnerID`
- [ ] Set `Secure: true` and `trustProxy: true`
- [ ] `baseURL` and `callbackURL` both use the real HTTPS domain
- [ ] `config.yml` contains no real credentials; secrets live in the gitignored `config.local.yml`
- [ ] MongoDB requires authentication and is not publicly exposed
- [ ] `uploads/` is writable and backed up
- [ ] Automated MongoDB backups are enabled

**Keeping secrets out of git**

Already handled: `config.yml` is a placeholder template, and real values live in the gitignored `config.local.yml`. Confirm before your first commit:

```bash
git check-ignore config.local.yml   # should print config.local.yml
```

If you ever added secrets to `config.yml` by hand, move them into `config.local.yml` and rotate them — a committed secret stays in git history even after deletion.

---

## 9. Troubleshooting

**"The bot token specified in the config is incorrect!"**
`Token` is wrong, revoked, or belongs to a different application. Reset it in the Developer Portal and restart. The store itself still works — only Discord logging, roles and auto-join stop.

**Login loops back to `/login`**
`callbackURL` does not match the Portal's Redirect URL exactly, or `OwnerID` does not contain your user ID.

**`/staff/*` redirects to `/`**
Your Discord ID is missing from `OwnerID`, or `USER_ID` is still in the list.

**"Settings not found"**
No settings document. Usually an empty or unreachable database. Check `MongoURI` and the `/health` endpoint.

**Images or fonts missing behind a proxy**
Set `trustProxy: true` and confirm the proxy forwards `X-Forwarded-For`.

**Buttons do nothing in the browser**
A Content-Security-Policy issue. Every page must send `script-src-attr 'unsafe-inline'`, otherwise inline `onclick` handlers are silently blocked. Check:

```bash
curl -sI http://127.0.0.1:3000/ | grep -i content-security-policy
```

**Port already in use**

```bash
ss -lptn 'sport = :3000'
```

**Logs**

Structured JSON goes to stdout. On failure the app also appends to `./logs.txt`.
