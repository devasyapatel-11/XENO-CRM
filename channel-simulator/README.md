# Xeno Channel Simulator

Standalone service that mimics an external messaging provider (WhatsApp / SMS / Email / RCS). The CRM POSTs messages to `/send`, and the simulator asynchronously fires lifecycle events back to the CRM via callbacks.

## Architecture

```
CRM (app.domain.com)                Channel Simulator (sim.domain.com)
        │                                        │
        │  POST /send                            │
        │ ─────────────────────────────────────► │
        │   { communication_id, channel,         │
        │     recipient, message, callback_url } │
        │                                        │  enqueues internally
        │                                        │  ┌──────────────────┐
        │                                        │  │ simulator_queue  │
        │                                        │  └──────────────────┘
        │                                        │  auto-tick every 3s
        │                                        │  emits events with
        │  POST {callback_url}                   │  realistic probs
        │ ◄───────────────────────────────────── │
        │   { communication_id, event_type,      │
        │     timestamp, metadata }              │
        │                                        │
```

## Event Lifecycle

```
QUEUED → SENT (97%) or FAILED (3%)
SENT → DELIVERED → OPENED → READ → CLICKED → CONVERTED
        (each step has channel-specific conditional probability)
```

### Channel Probabilities

| Channel   | Delivered | Opened | Read | Clicked | Converted |
|-----------|-----------|--------|------|---------|-----------|
| Email     | 96%       | 55%    | 85%  | 30%     | 10%       |
| SMS       | 98%       | 90%    | 95%  | 18%     | 6%        |
| WhatsApp  | 97%       | 80%    | 90%  | 35%     | 12%       |
| RCS       | 95%       | 70%    | 88%  | 40%     | 14%       |

## Setup

```bash
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SIMULATOR_SECRET
npm install
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (bypasses RLS) |
| `SIMULATOR_SECRET` | ✅ | Shared secret sent in `x-simulator-secret` header |
| `PORT` | ❌ | HTTP port (default 3001) |

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/stats` | Queue statistics |
| `POST` | `/send` | Accept message from CRM |
| `POST` | `/tick` | Manually drain one batch |

## Deployment

Deploy to any Node-compatible host (Railway, Render, Fly.io). Set the deployed URL as `CHANNEL_SIMULATOR_URL` in the CRM's environment.
