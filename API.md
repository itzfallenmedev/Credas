# API

HTTP reference for Credas 2.0.0.

**Contents:** [Conventions](#conventions) · [Licence verification](#licence-verification) · [Snippets](#licence-verification-snippets) · [Endpoints](#endpoint-reference) · [Rate limits](#rate-limits) · [Errors](#errors)

---

## Conventions

- **Base URL** — your deployment, e.g. `https://yourdomain.com`
- **Content type** — `application/json` for `/api/*`; form-encoded for HTML forms
- **Authentication** — the licence API is public. Everything under `/staff/*` and `/licenses`, `/tickets` requires a Discord login session **and** an ID present in `config.yml` → `OwnerID`
- **CSRF** — form `POST`s require a hidden `_csrf` field. JSON `/api/*` routes are exempt
- **Request ID** — every response carries `x-request-id`; quote it in bug reports
- **Logging** — failures on `/api/license/verify` are written to the staff audit log

---

## Licence verification

The endpoint your product calls at launch to decide whether to run.

### `POST /api/license/verify`

**Request**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `key` | string | yes | The licence key |
| `hwid` | string | no | Hardware ID. Supplying it binds the device on first success |
| `sessionId` | string | no | Opaque per-run ID, used for concurrent-session limits |

**Response — valid (`200`)**

```json
{
  "valid": true,
  "code": "VALID",
  "message": "License is valid.",
  "data": {
    "product": "Credas Bot",
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "hwidLocked": true,
    "status": "active"
  }
}
```

`expiresAt` is `null` for a key that never expires. `hwidLocked` tells you whether a device is already bound.

**Response — rejected (`403`)**

```json
{
  "valid": false,
  "code": "HWID_MISMATCH",
  "message": "This license is already active on another device.",
  "data": null
}
```

> Always branch on `code`, not on the message text — messages are user-facing copy and may change.

### Response codes

| `code` | HTTP | Meaning | Suggested client behaviour |
| --- | --- | --- | --- |
| `VALID` | 200 | Key is good | Run the product |
| `NO_KEY` | 403 | No key supplied | Prompt for a key |
| `INVALID_KEY` | 403 | Key does not exist | Prompt for a key |
| `BANNED` | 403 | Revoked by staff | Block, show the reason |
| `SUSPENDED` | 403 | Temporarily suspended | Block, suggest contacting support |
| `EXPIRED` | 403 | Past `expiresAt` | Block, offer renewal |
| `HWID_MISMATCH` | 403 | Bound to another device | Block, offer a reset |
| `HWID_DISABLED` | 403 | Key is not device-bound | Run the product |
| `IP_LIMIT` | 403 | IP limit reached | Block |
| `SESSION_LIMIT` | 403 | Too many concurrent sessions | Close other instances, or block |

### `POST /api/license/activate`

Identical to `verify`; both `key` and `hwid` are required (`400 BAD_INPUT` otherwise). Use it at first launch to make the binding explicit.

### `POST /api/license/deactivate`

Unbinds the current device so the key can be activated elsewhere.

**Request:** `key`, `hwid` — the HWID must match the bound one.

| Status | Response |
| --- | --- |
| `200` | `{"ok":true,"message":"Device unbound. The next activation will bind a new device."}` |
| `403` | `{"ok":false,"message":"HWID does not match this license."}` |
| `404` | `{"ok":false,"message":"License not found."}` |

---

## Licence verification snippets

All examples target `https://yourdomain.com`. Replace the key, and send a stable per-machine `hwid`.

### cURL

```bash
curl -X POST https://yourdomain.com/api/license/verify \
  -H 'Content-Type: application/json' \
  -d '{
        "key": "CREDAS-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZA",
        "hwid": "9f2c-machine-fingerprint",
        "sessionId": "run-8a41"
      }'
```

### Node.js (18+, native `fetch`)

```js
const CREDS_URL = 'https://yourdomain.com';

async function verifyLicense(key, hwid, sessionId) {
  const res = await fetch(`${CREDS_URL}/api/license/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, hwid, sessionId })
  });

  const result = await res.json();

  if (result.valid) {
    console.log(`Licensed to ${result.data.product}`);
    return result.data;
  }

  switch (result.code) {
    case 'HWID_MISMATCH':
      throw new Error('This key is active on another device.');
    case 'EXPIRED':
      throw new Error('This licence has expired.');
    case 'BANNED':
    case 'SUSPENDED':
      throw new Error(`Licence unavailable: ${result.message}`);
    case 'IP_LIMIT':
    case 'SESSION_LIMIT':
      throw new Error('Too many active sessions. Close other instances and retry.');
    default:
      throw new Error(result.message || 'Invalid licence key.');
  }
}

verifyLicense('CREDAS-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZA', '9f2c-machine-fingerprint', 'run-8a41')
  .then(() => console.log('Launching…'))
  .catch(err => { console.error(err.message); process.exit(1); });
```

### Python

```python
import json
import platform
import uuid
import requests

CREDS_URL = "https://yourdomain.com"


def machine_id() -> str:
    """Stable per-machine identifier. Use a hardware serial where possible."""
    return f"{platform.node()}-{uuid.getnode():012x}"


def verify_license(key: str, session_id: str | None = None) -> dict:
    res = requests.post(
        f"{CREDS_URL}/api/license/verify",
        json={
            "key": key,
            "hwid": machine_id(),
            "sessionId": session_id or str(uuid.uuid4()),
        },
        timeout=15,
    )
    result = res.json()

    if result.get("valid"):
        return result["data"]

    raise RuntimeError(f"{result.get('code')}: {result.get('message')}")


if __name__ == "__main__":
    data = verify_license("CREDAS-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZA")
    print("Licensed to", data["product"])
```

### PHP

```php
<?php
declare(strict_types=1);

const CREDS_URL = 'https://yourdomain.com';

function verifyLicense(string $key, string $hwid, string $sessionId): array
{
    $ch = curl_init(CREDS_URL . '/api/license/verify');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode([
            'key'       => $key,
            'hwid'      => $hwid,
            'sessionId' => $sessionId,
        ]),
        CURLOPT_TIMEOUT        => 15,
    ]);

    $body  = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
        throw new RuntimeException('License check failed: ' . $error);
    }

    $result = json_decode($body, true);

    if (!($result['valid'] ?? false)) {
        throw new RuntimeException(($result['code'] ?? 'ERROR') . ': ' . ($result['message'] ?? 'Unknown error'));
    }

    return $result['data'];
}

verifyLicense(
    'CREDAS-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZA',
    php_uname('n'),
    bin2hex(random_bytes(8))
);
// Licensed to Credas Bot
```

### C#

```csharp
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

public static class LicenseClient
{
    private const string CredsUrl = "https://yourdomain.com";
    private static readonly HttpClient Http = new();

    private sealed record LicenseResponse(
        bool Valid, string Code, string Message,
        LicenseData? Data);

    private sealed record LicenseData(
        string Product, DateTimeOffset? ExpiresAt, bool HwidLocked, string Status);

    public static async Task<LicenseData> VerifyAsync(
        string key, string hwid, string sessionId)
    {
        var response = await Http.PostAsJsonAsync($"{CredsUrl}/api/license/verify",
            new { key, hwid, sessionId });

        var result = await response.Content.ReadFromJsonAsync<LicenseResponse>()
                     ?? throw new InvalidOperationException("Empty response from license API.");

        if (!result.Valid)
            throw new InvalidOperationException($"{result.Code}: {result.Message}");

        return result.Data ?? throw new InvalidOperationException("Missing license data.");
    }
}

// Usage
var license = await LicenseClient.VerifyAsync(
    "CREDAS-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZA",
    Environment.MachineName,
    Guid.NewGuid().ToString("N"));
Console.WriteLine($"Licensed to {license.Product}");
```

### Go

```go
package license

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const credsURL = "https://yourdomain.com"

type Data struct {
	Product    string     `json:"product"`
	ExpiresAt  *time.Time `json:"expiresAt"`
	HwidLocked bool       `json:"hwidLocked"`
	Status     string     `json:"status"`
}

type response struct {
	Valid   bool   `json:"valid"`
	Code    string `json:"code"`
	Message string `json:"message"`
	Data    *Data  `json:"data"`
}

func Verify(key, hwid, sessionID string) (*Data, error) {
	body, _ := json.Marshal(map[string]string{
		"key": key, "hwid": hwid, "sessionId": sessionID,
	})

	req, err := http.NewRequest(http.MethodPost, credsURL+"/api/license/verify", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var res response
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}
	if !res.Valid {
		return nil, fmt.Errorf("%s: %s", res.Code, res.Message)
	}
	return res.Data, nil
}
```

**Using it:**

```go
data, err := license.Verify("CREDAS-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZA", hostID, runID)
if err != nil {
    log.Fatal(err)
}
fmt.Println("Licensed to", data.Product)
```

---

## Endpoint reference

### Public

| Method | Path | Rate limit | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | none | Liveness probe. `200` healthy, `503` DB down |
| `GET` | `/status` | read | Public status page |
| `GET` | `/orders/lookup` | read | Order lookup form |
| `POST` | `/orders/lookup` | search | Resolve an order by **reference + email** |
| `GET` | `/orders/:reference?token=…` | read | Order detail; requires the HMAC token |
| `POST` | `/api/license/verify` | licence | Validate a key |
| `POST` | `/api/license/activate` | licence | Validate and bind a device |
| `POST` | `/api/license/deactivate` | licence | Unbind the current device |
| `GET` | `/lang/:code` | none | Switch language, sets the `credas_lang` cookie |
| `GET` | `/api/products` | api | Product feed |
| `GET` | `/api/reviews` | api | Review feed |
| `GET` | `/api/statistics` | api | Public store statistics |
| `GET` | `/api/cart/count` | read | Cart item count |

`GET /health`:

```json
{
  "status": "ok",
  "uptime": 1284,
  "database": "connected",
  "version": "2.0.0",
  "time": "2026-09-24T13:33:52.697Z"
}
```

**Order lookup** is form-encoded and HTML-rendered. Matching requires both the order reference and the email used at checkout; mismatches are audited.

### Authenticated

| Method | Path | Rate limit | Description |
| --- | --- | --- | --- |
| `GET` | `/licenses` | read | The signed-in user's licences |
| `POST` | `/licenses/:id/reset-hwid` | write | Unbind the user's own device |
| `GET` | `/tickets` | read | The user's tickets |
| `POST` | `/tickets` | write | Open a ticket |
| `GET` | `/tickets/:id` | read | One ticket |
| `POST` | `/tickets/:id/reply` | write | Reply |
| `POST` | `/tickets/:id/status` | write | Change status |

`POST /tickets` accepts `subject` (≤200), `body` (≤8000), `category`, `priority`, `product`, `productName`, `orderID`.

- `category` — one of `technical`, `billing`, `account`, `feature-request`, `other` (default `technical`)
- `priority` — one of `low`, `normal`, `high`, `urgent` (default `normal`)

New tickets get a reference like `TKT-AB12CD34`.

### Staff

Requires a Discord session whose ID is in `OwnerID`. All mutating routes require `_csrf`.

| Method | Path | Rate limit | Description |
| --- | --- | --- | --- |
| `GET` | `/staff/overview` | read | Dashboard |
| `GET` | `/staff/sales` | read | Sales analytics |
| `GET` | `/staff/users` | read | User management |
| `GET` | `/staff/products` | read | Product list |
| `GET` | `/staff/products/create` | read | New product form |
| `POST` | `/staff/products/create` | write | Create a product |
| `GET` | `/staff/products/edit/:id` | read | Edit form |
| `POST` | `/staff/products/update/:id` | write | Update a product |
| `GET` | `/staff/discount-codes` | read | Discount codes |
| `GET`/`POST` | `/staff/discount-codes/{create,edit/:id,delete/:id}` | write | Manage codes |
| `GET`/`POST` | `/staff/anti-piracy` | write | Key validation rules |
| `GET` | `/staff/licenses` | read | Licence list with search + status filter |
| `POST` | `/staff/licenses/create` | write | Issue a key |
| `POST` | `/staff/licenses/:id/:action` | write | `suspend`, `ban`, `unban`, `reset`, `extend`, `note` |
| `POST` | `/staff/licenses/:id/delete` | write | Delete a licence |
| `GET` | `/staff/tickets` | read | Ticket queue |
| `GET`/`POST` | `/staff/status` | read/write | Status page |
| `POST` | `/staff/status/component` | write | Add or update a component |
| `POST` | `/staff/status/incident` | write | Publish an incident |
| `POST` | `/staff/status/incident/:id/update` | write | Post an incident update |
| `GET` | `/staff/audit` | read | Audit log, filterable |
| `GET` | `/staff/audit/export` | read | CSV export |
| `GET`/`POST` | `/staff/settings` | read/write | Store settings, including maintenance mode |
| `GET`/`POST` | `/staff/page-customization` | read/write | Homepage copy, section visibility, features, FAQ, tabs |

---

## Rate limits

| Bucket | Window | Max |
| --- | --- | --- |
| `auth` | 15 min | 20 |
| `login` | 15 min | 10 |
| `write` | 10 min | 40 |
| `checkout` | 10 min | 25 |
| `read` | 1 min | 180 |
| `search` | 1 min | 60 |
| `api` | 1 min | 120 |
| `license` | 1 min | 30 |

`auth` and `login` skip successful requests. Exceeding a limit returns `429` with `{"error":"RATE_LIMITED","message":"Too many requests. Please wait a moment and try again."}`.

**Back off on 429** — do not retry immediately. Standard headers (`RateLimit-*`) are included.

---

## Errors

JSON API routes return a consistent envelope:

```json
{ "code": "HWID_MISMATCH", "message": "Human-readable text" }
```

| Status | When |
| --- | --- |
| `400` | Malformed input (`BAD_INPUT`) |
| `403` | Licence rejected, or CSRF failure on a form |
| `404` | Not found |
| `429` | Rate limited |
| `500` | Server error — quote the `x-request-id` |

HTML routes render an error page rather than JSON.

**Security note:** never log licence keys. The store stores them AES-256-GCM encrypted and looks them up by SHA-256 hash, so a key is shown to staff exactly once, at issue time.
