# Africa's Talking Notification Microservice

A single API that front-end apps call to send a notification — the service
figures out *how* to deliver it (SMS, Email, or WhatsApp) and talks to the
right provider behind the scenes. Built to demo **Africa's Talking** for SMS,
with Email (SMTP) and WhatsApp (Twilio) wired up alongside it so the
architecture reads as a real omni-channel notification service, not a
single-purpose SMS script.

Requests are accepted immediately and processed asynchronously: the API returns
`202 Accepted` with a job ID while an in-process worker sends through the
provider, retries on failure, and appends delivery events to a local log file.

**API documentation:** [Swagger UI](http://localhost:3000/docs) · [OpenAPI JSON](http://localhost:3000/openapi.json) · [Diagnostics](http://localhost:3000/diagnostics) · [All routes (below)](#all-routes)

---

## Quick start (beginning to end)

### 1. Prerequisites

- **Node.js 20+** and **npm**
- (Optional) Provider accounts for the channels you want to test:
  - [Africa's Talking](https://account.africastalking.com) — SMS
  - Any SMTP provider — Email
  - [Twilio](https://console.twilio.com) — WhatsApp

### 2. Install dependencies

```bash
git clone <your-repo-url>
cd AT-notification-microservice
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. At minimum for local SMS testing:

```env
SERVICE_API_KEY=change-me-to-a-strong-secret
AT_USERNAME=sandbox
AT_API_KEY=your_sandbox_api_key
```

> **Local dev tip:** Leave `SERVICE_API_KEY` blank to disable API auth entirely during development.

### 4. Run the service (development)

```bash
npm run dev
```

The server starts on **http://localhost:3000** (or `PORT` from `.env`).

You should see a log line listing key URLs: `/health`, `/ready`, `/metrics`, `/docs`, `/openapi.json`.

### 5. Verify it is running

Open in a browser or curl:

| Check | URL |
|---|---|
| Liveness | http://localhost:3000/health |
| Readiness | http://localhost:3000/ready |
| API docs (Swagger UI) | http://localhost:3000/docs |
| Diagnostics dashboard | http://localhost:3000/diagnostics |

Or from the terminal:

```bash
curl http://localhost:3000/health
```

### 6. Send a test notification

**Via Swagger UI (easiest):**

1. Open http://localhost:3000/docs
2. Click **Authorize** and enter your `x-api-key` (or skip if auth is disabled in dev)
3. Expand `POST /api/v1/notifications` → **Try it out**
4. Use the SMS example payload and **Execute**

**Via curl:**

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: change-me-to-a-strong-secret" \
  -d "{\"channel\":\"sms\",\"to\":\"+254712345678\",\"message\":\"Hello!\"}"
```

Expected response (**202 Accepted**):

```json
{
  "success": true,
  "channel": "sms",
  "provider": "queue",
  "externalId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "metadata": null,
  "timestamp": "2026-06-20T06:16:09.019Z"
}
```

### 7. Check delivery outcome

The HTTP response only confirms the job was **queued**. To see whether delivery succeeded:

- **Diagnostics dashboard:** http://localhost:3000/diagnostics
- **JSON log API:** http://localhost:3000/diagnostics/log?limit=50
- **Log file:** `data/notifications.log` (or `NOTIFICATION_STORE_PATH`)

Look for `recordType: "outcome"` entries matching your `externalId` (job ID).

### 8. Run tests

```bash
npm run test:all    # typecheck + lint + full test suite
```

Optional live smoke test (server must already be running):

```bash
npm run test:live
```

### 9. Production build

```bash
npm run build
npm start
```

Or with Docker:

```bash
docker build -t notification-microservice .
docker run --rm -p 3000:3000 --env-file .env notification-microservice
```

---

## All routes

| Method | Path | Auth | Rate limited | Description |
|---|---|---|---|---|
| `GET` | `/health` | No | No | **Liveness probe.** Returns `{ status: "ok", service, timestamp }`. Use for load balancers and uptime checks. |
| `GET` | `/ready` | No | No | **Readiness probe.** Returns `{ status: "ready", service, timestamp, uptime }`. Confirms the process is up and accepting work. |
| `GET` | `/metrics` | No | No | **Prometheus metrics.** Text exposition format — request counts, durations, provider success/failure counters. |
| `GET` | `/docs` | No | No | **Swagger UI.** Interactive API documentation. Try endpoints in the browser; use **Authorize** for `x-api-key`. |
| `GET` | `/openapi.json` | No | No | **OpenAPI 3.0 spec** (JSON). Machine-readable API contract for codegen, Postman import, etc. |
| `GET` | `/diagnostics` | No* | No | **Diagnostics dashboard (HTML).** Runtime config summary, provider status (configured/missing — no secrets), recent delivery log, metrics snapshot. |
| `GET` | `/diagnostics/log` | No* | No | **Delivery log snapshot (JSON).** Query param `limit` (1–500, default 200). Returns recent `request`, `job`, and `outcome` records. |
| `POST` | `/api/v1/notifications` | Yes** | Yes | **Send a notification.** Validates payload, enqueues async delivery, returns **202** with job ID (`externalId`). |

\* **Diagnostics in production:** disabled unless `DIAGNOSTICS_ENABLED=true`. Always enabled in non-production.

\** **API auth:** `x-api-key` header required when `SERVICE_API_KEY` is set. In development, auth is skipped if `SERVICE_API_KEY` is blank. In production, the key is always required.

### Route details

#### `POST /api/v1/notifications`

**Headers:** `Content-Type: application/json`, `x-api-key: <SERVICE_API_KEY>` (when auth enabled)

**Body:**

```json
{
  "channel": "sms",
  "to": "+254712345678",
  "message": "Your OTP is 482913",
  "subject": "Optional — email only",
  "metadata": { "traceId": "abc-123" }
}
```

| Field | Required | Description |
|---|---|---|
| `channel` | Yes | `"sms"` \| `"email"` \| `"whatsapp"` |
| `to` | Yes | E.164 phone for SMS/WhatsApp; email address for email |
| `message` | Yes | Body text (max 2000 chars) |
| `subject` | No | Email subject only |
| `metadata` | No | Free-form object echoed back in the response |

**Responses:**

| Status | Meaning |
|---|---|
| `202` | Job queued — check log/diagnostics for delivery outcome |
| `400` | Validation error or malformed JSON body |
| `401` | Missing or invalid `x-api-key` |
| `429` | Rate limit exceeded on this endpoint |
| `500` | Internal server error |

The worker retries failed provider calls up to **3 times** with exponential backoff (1s → 2s → 4s, capped at 30s).

#### `GET /diagnostics/log`

**Query parameters:**

| Param | Default | Description |
|---|---|---|
| `limit` | `200` | Max records to return (1–500) |

**Example response:**

```json
{
  "success": true,
  "count": 3,
  "storePath": "data/notifications.log",
  "records": [
    { "recordType": "request", "jobId": "...", "channel": "sms", "payload": { ... } },
    { "recordType": "job", "jobId": "...", "provider": "sms", "status": "processing", "attempts": 1 },
    { "recordType": "outcome", "jobId": "...", "provider": "africastalking", "success": true, "status": "Success" }
  ],
  "timestamp": "2026-06-20T10:00:00.000Z"
}
```

---

## How it's organized

```
src/
  config/
    env.ts                 # env vars + provider readiness checks
    logger.ts              # structured logging (pino)
    metrics.ts             # Prometheus counters/histograms
    startup.ts             # production startup validation
  openapi/
    spec.ts                # OpenAPI 3.0 document
  providers/
    notification-provider.interface.ts   # contract every channel implements
    sms.provider.ts        # Africa's Talking
    email.provider.ts        # Nodemailer / SMTP
    whatsapp.provider.ts   # Twilio WhatsApp
  services/
    notification.service.ts   # enqueue + return job ID
    notification.queue.ts     # async worker with retries
    notification.store.ts     # append-only JSONL delivery log
  validators/notification.validator.ts   # zod schema (channel-aware)
  controllers/
    notification.controller.ts
    diagnostics.controller.ts
  middleware/
    api-key-auth.ts
    error-handler.ts
  routes/
    notification.routes.ts
    diagnostics.routes.ts
    openapi.routes.ts
  utils/with-timeout.ts
  app.ts / server.ts
tests/                     # vitest unit + integration suite
scripts/test-endpoints.ps1 # optional live smoke test against a running server
```

The `NotificationProvider` interface is the whole trick: the queue and service
never know *how* a message gets sent. Adding a 4th channel (push notifications,
Slack, whatever) means writing one new class and registering it in
`notification.service.ts` — nothing else changes.

---

## Environment variables

| Variable | Used for | Notes |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` \| `production` \| `test` |
| `PORT` | HTTP listen port | Default: `3000` |
| `SERVICE_API_KEY` | Protects `/api/v1/*` via `x-api-key` header | Required in production. Blank in dev disables auth. |
| `DIAGNOSTICS_ENABLED` | Enable `/diagnostics` in production | Off by default in production; on automatically in non-production |
| `CORS_ORIGINS` | Comma-separated browser origin allow list | Empty = permissive in dev, denied in production |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Rate limit on `POST /api/v1/notifications` | Defaults: 15 min window, 100 requests |
| `PROVIDER_TIMEOUT_MS` | Upstream provider call timeout | Default: 20s |
| `NOTIFICATION_STORE_PATH` | Append-only delivery log file | Default: `data/notifications.log` |
| `AT_USERNAME` / `AT_API_KEY` / `AT_SENDER_ID` | SMS via Africa's Talking | Use `sandbox` + sandbox key for free testing |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email | Gmail app password, SendGrid, Mailgun, etc. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | WhatsApp | Twilio WhatsApp Sandbox for free testing |

You don't need all three providers configured to run the service — only the
channel(s) you actually call need valid credentials. Calling an unconfigured
channel still returns `202` (the job is queued), but the worker records a
failure in the log after retries are exhausted.

In production, startup fails fast if any env vars are missing.
In development, missing vars are logged as warnings so you can iterate on one
channel at a time.

---

## curl examples

**SMS (Africa's Talking):**

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SERVICE_API_KEY" \
  -d '{
    "channel": "sms",
    "to": "+254712345678",
    "message": "Hello from Africa'\''s Talking via our notification service!"
  }'
```

**Email:**

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SERVICE_API_KEY" \
  -d '{
    "channel": "email",
    "to": "someone@example.com",
    "subject": "Welcome!",
    "message": "Thanks for signing up."
  }'
```

**WhatsApp:**

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SERVICE_API_KEY" \
  -d '{
    "channel": "whatsapp",
    "to": "+254712345678",
    "message": "Hello from our notification service!"
  }'
```

**Health / metrics / docs:**

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/metrics
curl http://localhost:3000/openapi.json
curl "http://localhost:3000/diagnostics/log?limit=10"
```

---

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start dev server with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm test` | Run vitest unit + integration tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:all` | typecheck + lint + test |
| `npm run test:live` | PowerShell smoke test against `localhost:3000` |
| `npm run typecheck` | TypeScript check without emit |
| `npm run lint` | ESLint |
| `npm run audit` | `npm audit --audit-level=moderate` |

CI (`.github/workflows/ci.yml`) runs lint, build, test, and `npm audit` on push/PR to `main`.

---

## Docker

```bash
docker build -t notification-microservice .
docker run --rm -p 3000:3000 --env-file .env notification-microservice
```

The image runs the compiled production build (`node dist/server.js`). Mount a
volume for `NOTIFICATION_STORE_PATH` if you want delivery logs to survive
container restarts.

---

## Notes for the Africa's Talking demo

- In **sandbox** mode (`AT_USERNAME=sandbox`), messages aren't delivered to
  real phones — check the **Sandbox > Outbox** in the Africa's Talking
  dashboard to see what was "sent" and its status.
- To send to real phones in sandbox, add the destination number to your
  sandbox's simulator phone numbers first.
- Going live just means switching `AT_USERNAME` to your live account
  username and using a live API key + an approved Sender ID — no code
  changes required, since the credentials are config, not logic.

---

## What's deliberately simple (and how you'd extend it)

- **In-process queue** — jobs run in the same Node process. For horizontal
  scaling or crash safety, swap `NotificationQueue` for Redis/SQS/BullMQ and
  keep the same provider layer.
- **File-based log** — delivery history is an append-only JSONL file, good
  for demos and single-instance deploys. Swap `NotificationStore` for Postgres
  or a warehouse when you need querying, retention policies, or multi-instance
  writes.
- **No job status API yet** — clients get a `jobId` on 202 but must read
  `/diagnostics/log` or the log file for outcome. Add `GET /api/v1/notifications/:jobId`
  when you need programmatic status lookup.
- **Single-channel per request** — call the endpoint twice (e.g. once for
  `sms`, once for `email`) if you want the same message on two channels.
