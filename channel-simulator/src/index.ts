// Xeno Channel Simulator — standalone HTTP service
// Exposes:
//   POST /send   — accepts messages from the CRM, enqueues for simulation
//   POST /tick   — manually drain one batch (useful for testing)
//   GET  /health — liveness check
//   GET  /stats  — queue statistics

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { enqueue, tick, startAutoTick } from "./engine.js";
import { db } from "./db.js";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    status: "running",
    service: "xeno-channel-simulator",
    endpoints: {
      health: "/health",
      stats: "/stats",
      send: "/send (POST)",
      tick: "/tick (POST)"
    }
  })
);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (c) =>
  c.json({ ok: true, service: "xeno-channel-simulator", ts: new Date().toISOString() }),
);

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get("/stats", async (c) => {
  const { data } = await db().from("simulator_queue").select("current_state");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[]) ?? [];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const s = r.current_state as string;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return c.json({ total: rows.length, counts });
});

// ── Send ──────────────────────────────────────────────────────────────────────
// CRM → Simulator: accept a message and queue it for simulation.
app.post("/send", async (c) => {
  let body: {
    communication_id: string;
    customer_id?: string;
    recipient: string;
    channel: string;
    message: string;
    callback_url?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const { communication_id, recipient, channel, message, callback_url, customer_id } = body;
  if (!communication_id || !recipient || !channel || !message) {
    return c.json(
      { error: "missing required fields: communication_id, recipient, channel, message" },
      400,
    );
  }
  if (!callback_url) {
    return c.json({ error: "callback_url is required" }, 400);
  }

  try {
    await enqueue({ communication_id, customer_id, channel, recipient, message, callback_url });
    return c.json({ accepted: true, communication_id });
  } catch (e) {
    console.error("[/send] error:", e);
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ── Manual tick ───────────────────────────────────────────────────────────────
app.post("/tick", async (c) => {
  try {
    const result = await tick(200);
    return c.json(result);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? "3001", 10);

startAutoTick(3000); // auto-drain every 3 seconds

serve({ fetch: app.fetch, port }, () => {
  console.log(`[simulator] listening on http://localhost:${port}`);
});
