// Channel Simulator Engine
// Accepts inbound send requests, queues them, and drives the event lifecycle:
//   QUEUED → SENT → DELIVERED → OPENED → READ → CLICKED → CONVERTED
// Each step fires a callback POST to the CRM's receipts endpoint.

import { db } from "./db.js";

const EVENT_CHAIN = ["SENT", "DELIVERED", "OPENED", "READ", "CLICKED", "CONVERTED"] as const;
type EventType = (typeof EVENT_CHAIN)[number] | "FAILED";

// Per-channel conditional probabilities (each step conditional on previous)
const PROBS: Record<string, Record<string, number>> = {
  Email:    { DELIVERED: 0.96, OPENED: 0.55, READ: 0.85, CLICKED: 0.30, CONVERTED: 0.10 },
  SMS:      { DELIVERED: 0.98, OPENED: 0.90, READ: 0.95, CLICKED: 0.18, CONVERTED: 0.06 },
  WhatsApp: { DELIVERED: 0.97, OPENED: 0.80, READ: 0.90, CLICKED: 0.35, CONVERTED: 0.12 },
  RCS:      { DELIVERED: 0.95, OPENED: 0.70, READ: 0.88, CLICKED: 0.40, CONVERTED: 0.14 },
};

const FAILURE_AT_SEND = 0.03; // 3% hard-fail at the SENT stage

function pickNextEvent(channel: string, current: string): EventType | null {
  const table = PROBS[channel] ?? PROBS.Email;
  const idx = EVENT_CHAIN.indexOf(current as (typeof EVENT_CHAIN)[number]);
  if (idx < 0) return "SENT";
  if (idx >= EVENT_CHAIN.length - 1) return null; // chain complete
  const next = EVENT_CHAIN[idx + 1];
  const p = table[next] ?? 0;
  return Math.random() < p ? next : null;
}

async function dbLog(
  level: string,
  message: string,
  metadata: Record<string, unknown> = {},
  communication_id?: string,
): Promise<void> {
  await db()
    .from("simulator_logs")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ level, message, metadata, communication_id } as any);
}

async function postCallback(
  callbackUrl: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number; body?: string }> {
  try {
    const r = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-channel-simulator": "1",
        // Shared secret so the CRM can verify callbacks are from us
        "x-simulator-secret": process.env.SIMULATOR_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });
    const body = await r.text();
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: (e as Error).message };
  }
}

/** Enqueue a new communication for simulation. */
export async function enqueue(input: {
  communication_id: string;
  customer_id?: string;
  channel: string;
  recipient: string;
  message: string;
  callback_url: string;
}): Promise<void> {
  const { error } = await db()
    .from("simulator_queue")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      communication_id: input.communication_id,
      customer_id: input.customer_id ?? null,
      channel: input.channel,
      recipient: input.recipient,
      message: input.message,
      callback_url: input.callback_url,
      current_state: "QUEUED",
      next_event: "SENT",
      // Stagger initial delay 100ms–1.5s to simulate real-world latency
      next_run_at: new Date(Date.now() + 100 + Math.random() * 1400).toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  if (error) throw new Error(`enqueue failed: ${error.message}`);
  await dbLog(
    "info",
    "queued",
    { channel: input.channel, recipient: input.recipient },
    input.communication_id,
  );
}

/** Drain due queue items. Returns counts for monitoring. */
export async function tick(limit = 200): Promise<{
  processed: number;
  emitted: number;
  failed: number;
}> {
  const nowIso = new Date().toISOString();
  const { data: due } = await db()
    .from("simulator_queue")
    .select("*")
    .lte("next_run_at", nowIso)
    .not("current_state", "in", "(TERMINAL,DEAD)")
    .order("next_run_at", { ascending: true })
    .limit(limit);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (due as any[]) ?? [];
  if (rows.length === 0) return { processed: 0, emitted: 0, failed: 0 };

  let emitted = 0;
  let failed = 0;

  for (const row of rows) {
    const channel = row.channel as string;
    const cur = row.current_state as string;
    let event: EventType | null;
    let isTerminal = false;

    if (cur === "QUEUED") {
      if (Math.random() < FAILURE_AT_SEND) {
        event = "FAILED";
        isTerminal = true;
      } else {
        event = "SENT";
      }
    } else if (EVENT_CHAIN.includes(cur as (typeof EVENT_CHAIN)[number])) {
      event = pickNextEvent(channel, cur);
      if (!event) {
        // Chain stopped here naturally — mark terminal
        await db()
          .from("simulator_queue")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ current_state: "TERMINAL", next_event: null } as any)
          .eq("id", row.id);
        continue;
      }
      isTerminal = event === "CONVERTED";
    } else {
      continue;
    }

    const payload = {
      communication_id: row.communication_id,
      event_type: event,
      timestamp: new Date().toISOString(),
      metadata: { channel, recipient: row.recipient, attempt: (row.attempts ?? 0) + 1 },
    };

    const cb = await postCallback(row.callback_url ?? "", payload);

    if (cb.ok) {
      emitted++;
      await dbLog("info", `emitted ${event}`, { status: cb.status }, row.communication_id);
      // Stagger next step: 1.5s–9.5s
      const delayMs = 1500 + Math.floor(Math.random() * 8000);
      await db()
        .from("simulator_queue")
        .update({
          current_state: isTerminal ? "TERMINAL" : (event as string),
          next_event: isTerminal ? null : "next",
          next_run_at: new Date(Date.now() + delayMs).toISOString(),
          attempts: 0,
          last_error: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", row.id);
    } else {
      failed++;
      const attempts = (row.attempts ?? 0) + 1;
      const isDead = attempts >= (row.max_attempts ?? 3);
      await dbLog(
        "warn",
        `callback failed (attempt ${attempts})`,
        { status: cb.status, body: cb.body?.slice(0, 200) },
        row.communication_id,
      );
      // Exponential backoff: 2s, 4s, 8s … capped at 60s
      const backoff = Math.min(60_000, 2000 * Math.pow(2, attempts));
      await db()
        .from("simulator_queue")
        .update({
          attempts,
          last_error: `HTTP ${cb.status}: ${cb.body?.slice(0, 200) ?? ""}`,
          next_run_at: new Date(Date.now() + backoff).toISOString(),
          current_state: isDead ? "DEAD" : cur,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", row.id);
    }
  }

  return { processed: rows.length, emitted, failed };
}

/** Run tick in a loop at a fixed interval. */
export function startAutoTick(intervalMs = 3000): () => void {
  let running = false;
  const run = async () => {
    if (running) return; // prevent overlap
    running = true;
    try {
      const result = await tick(200);
      if (result.processed > 0) {
        console.log(
          `[simulator] tick — processed:${result.processed} emitted:${result.emitted} failed:${result.failed}`,
        );
      }
    } catch (e) {
      console.error("[simulator] tick error:", e);
    } finally {
      running = false;
    }
  };
  const handle = setInterval(run, intervalMs);
  console.log(`[simulator] auto-tick started (every ${intervalMs}ms)`);
  return () => clearInterval(handle);
}
