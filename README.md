# Africa's Talking Notification Microservice

A single API that front-end apps call to send a notification — the service
figures out *how* to deliver it (SMS, Email, or WhatsApp) and talks to the
right provider behind the scenes. Built to demo **Africa's Talking** for SMS,
with Email (SMTP) and WhatsApp (Twilio) wired up alongside it so the
architecture reads as a real omni-channel notification service, not a
single-purpose SMS script.

## How it's organized

```
src/
  config/env.ts                  # all env vars in one place + friendly missing-config errors
  providers/
    notification-provider.interface.ts   # the contract every channel implements
    sms.provider.ts              # Africa's Talking
    email.provider.ts            # Nodemailer / SMTP
    whatsapp.provider.ts         # Twilio WhatsApp
  services/notification.service.ts       # picks the right provider for a given channel
  validators/notification.validator.ts   # zod schema (channel-aware: phone vs email)
  controllers/notification.controller.ts # HTTP <-> service glue
  middleware/api-key-auth.ts     # x-api-key header check
  middleware/error-handler.ts    # 404 + 500 handlers
  routes/notification.routes.ts
  app.ts / server.ts
```

The `NotificationProvider` interface is the whole trick: the controller and
service never know *how* a message gets sent. Adding a 4th channel (push
notifications, Slack, whatever) means writing one new class and registering
it in `notification.service.ts` — nothing else changes.

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

| Variable | Used for | Where to get it |
|---|---|---|
| `SERVICE_API_KEY` | Protects this API itself (`x-api-key` header) | Pick any strong secret |
| `AT_USERNAME` / `AT_API_KEY` / `AT_SENDER_ID` | SMS via Africa's Talking | [account.africastalking.com](https://account.africastalking.com) — use `sandbox` as the username + your sandbox API key to test for free without sending real SMS |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email | Any SMTP provider (Gmail app password, SendGrid, Mailgun, Postmark...) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | WhatsApp | [console.twilio.com](https://console.twilio.com) — the WhatsApp **Sandbox** number works for free testing once you join it from your phone |

You don't need all three configured to run the service — only the channel(s)
you actually call need valid credentials. Calling an unconfigured channel
returns a clear `502` explaining which env var is missing, instead of a raw
SDK crash.

## API

### `POST /api/v1/notifications`

Headers: `Content-Type: application/json`, `x-api-key: <SERVICE_API_KEY>`

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

**Success (200):**
```json
{
  "success": true,
  "channel": "sms",
  "provider": "africastalking",
  "externalId": "ATXid_abc123",
  "status": "Success",
  "metadata": null,
  "timestamp": "2026-06-20T06:16:09.019Z"
}
```

**Validation error (400)** — bad shape, e.g. malformed phone/email.
**Provider error (502)** — request was valid but the upstream provider rejected it (bad credentials, unreachable carrier, etc.) — `status` carries the real provider error message.
**Auth error (401)** — missing/wrong `x-api-key`.

### `GET /health`

No auth required. Returns `{ status: "ok", ... }` — point your load balancer/uptime checker at this.

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

- **Synchronous send-and-respond** — fine for a demo / moderate traffic. For
  high volume or flaky upstreams, swap the controller's direct `dispatch()`
  call for "enqueue job, return 202, worker calls the same providers."
  Because the provider layer is already decoupled, that's a routing change,
  not a rewrite.
- **No persistence** — nothing is stored. Add a `notifications` table/log if
  you need delivery history, retries, or analytics.
- **Single-channel per request** — call the endpoint twice (e.g. once for
  `sms`, once for `email`) if you want the same message on two channels.
