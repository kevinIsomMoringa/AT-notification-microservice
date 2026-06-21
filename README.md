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

## How it's organized

```
src/
  config/
    env.ts                 # env vars + provider readiness checks
    logger.ts              # structured logging (pino)
    metrics.ts             # Prometheus counters/histograms
    startup.ts             # production startup validation
  providers/
    notification-provider.interface.ts   # contract every channel implements
    sms.provider.ts        # Africa's Talking
    email.provider.ts      # Nodemailer / SMTP
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
  utils/with-timeout.ts
  app.ts / server.ts
tests/                     # vitest unit + integration suite
scripts/test-endpoints.ps1 # optional live smoke test against a running server
```

The `NotificationProvider` interface is the whole trick: the queue and service
never know *how* a message gets sent. Adding a 4th channel (push notifications,
Slack, whatever) means writing one new class and registering it in
`notification.service.ts` — nothing else changes.

## Setup

```bash
npm install
cp .env.example .env
# fill in .env (see below)
npm run dev      # ts-node-dev, hot reload
# or
npm run build && npm start
```

### Environment variables

| Variable | Used for | Notes |
|---|---|---|
| `SERVICE_API_KEY` | Protects `/api/v1/*` via `x-api-key` header | Required in production. In local dev, leave blank to disable auth entirely. |
| `DIAGNOSTICS_ENABLED` | Enable `/diagnostics` in production | Off by default in production; enabled automatically in non-production. |
| `CORS_ORIGINS` | Comma-separated browser origin allow list | Empty = permissive in dev, denied in production |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Rate limit on `POST /api/v1/notifications` | Defaults: 15 min window, 100 requests |
| `PROVIDER_TIMEOUT_MS` | Upstream provider call timeout | Default: 20s |
| `NOTIFICATION_STORE_PATH` | Append-only delivery log file | Default: `data/notifications.log` |
| `AT_USERNAME` / `AT_API_KEY` / `AT_SENDER_ID` | SMS via Africa's Talking | [account.africastalking.com](https://account.africastalking.com) — use `sandbox` + sandbox key for free testing |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email | Any SMTP provider (Gmail app password, SendGrid, Mailgun, Postmark...) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | WhatsApp | [console.twilio.com](https://console.twilio.com) — WhatsApp Sandbox works for free testing |

You don't need all three providers configured to run the service — only the
channel(s) you actually call need valid credentials. Calling an unconfigured
channel still returns `202` (the job is queued), but the worker records a
failure in the log after retries are exhausted.

In production, startup fails fast if any of the above env vars are missing.
In development, missing vars are logged as warnings so you can iterate on one
channel at a time.

## API

### `POST /api/v1/notifications`

Headers: `Content-Type: application/json`, `x-api-key: <SERVICE_API_KEY>` (when auth is enabled)

```json
{
  "channel": "sms",
  "to": "+254712345678",
  "message": "Your OTP is 482913"
}
```

- `channel`: `"sms" | "email" | "whatsapp"`
- `to`: phone number in E.164 format for `sms`/`whatsapp`, email address for `email`
- `message`: the body text (max 2000 chars)
- `subject`: optional, used only by `email`
- `metadata`: optional free-form object, echoed back in the response for your own tracing/logging

**Accepted (202)** — job queued for async delivery:

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

Use `externalId` to correlate with entries in the delivery log (`/diagnostics/log`)
or the file at `NOTIFICATION_STORE_PATH`. Delivery success/failure is recorded
asynchronously — the HTTP response only confirms the job was accepted.

**Validation error (400)** — bad shape, e.g. malformed phone/email.
**Auth error (401)** — missing/wrong `x-api-key` (when auth is enabled).
**Rate limit (429)** — too many requests in the configured window.

The worker retries failed provider calls up to 3 times with exponential backoff
(1s → 2s → 4s, capped at 30s).

### Observability endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /health` | No | Liveness — `{ status: "ok", ... }` |
| `GET /ready` | No | Readiness — includes uptime |
| `GET /metrics` | No | Prometheus metrics (request counts, provider success/failure) |
| `GET /diagnostics` | No* | HTML dashboard: config summary, recent log, metrics snapshot |
| `GET /diagnostics/log?limit=200` | No* | JSON snapshot of recent delivery log entries |

\* Disabled in production unless `DIAGNOSTICS_ENABLED=true`. Never exposes secrets.

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

## Testing

```bash
npm test              # vitest unit + integration tests (mocked providers)
npm run test:watch    # watch mode
npm run test:all      # typecheck + lint + test
npm run test:live     # smoke test against localhost:3000 (server must be running)
```

CI (`.github/workflows/ci.yml`) runs lint, build, test, and `npm audit` on
push/PR to `main`.

## Docker

```bash
docker build -t notification-microservice .
docker run --rm -p 3000:3000 --env-file .env notification-microservice
```

The image runs the compiled production build (`node dist/server.js`). Mount a
volume for `NOTIFICATION_STORE_PATH` if you want delivery logs to survive
container restarts.

## Notes for the Africa's Talking demo

- In **sandbox** mode (`AT_USERNAME=sandbox`), messages aren't delivered to
  real phones — check the **Sandbox > Outbox** in the Africa's Talking
  dashboard to see what was "sent" and its status.
- To send to real phones in sandbox, add the destination number to your
  sandbox's simulator phone numbers first.
- Going live just means switching `AT_USERNAME` to your live account
  username and using a live API key + an approved Sender ID — no code
  changes required, since the credentials are config, not logic.

## What's deliberately simple (and how you'd extend it)

- **In-process queue** — jobs run in the same Node process. For horizontal
  scaling or crash safety, swap `NotificationQueue` for Redis/SQS/BullMQ and
  keep the same provider layer.
- **File-based log** — delivery history is an append-only JSONL file, good
  for demos and single-instance deploys. Swap `NotificationStore` for Postgres
  or a warehouse when you need querying, retention policies, or multi-instance
  writes.
- **Single-channel per request** — call the endpoint twice (e.g. once for
  `sms`, once for `email`) if you want the same message on two channels.
