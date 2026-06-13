// Channel Simulator engine - server only.
// Pretends to be an external comms provider (WhatsApp/SMS/Email/RCS).
// Drains simulator_queue, generates lifecycle events with realistic
// probabilities, and POSTs callbacks to the CRM receipts endpoint.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EVENT_CHAIN = ["SENT", "DELIVERED", "OPENED", "READ", "CLICKED", "CONVERTED"] as const;
type EventType = (typeof EVENT_CHAIN)[number] | "FAILED";

// Channel-specific probabilities (conditional on previous step happening)
const PROBS: Record<string, Record<string, number>> = {
  Email:    { DELIVERED: 0.96, OPENED: 0.55, READ: 0.85, CLICKED: 0.30, CONVERTED: 0.10 },
  SMS:      { DELIVERED: 0.98, OPENED: 0.90, READ: 0.95, CLICKED: 0.18, CONVERTED: 0.06 },
  WhatsApp: { DELIVERED: 0.97, OPENED: 0.80, READ: 0.90, CLICKED: 0.35, CONVERTED: 0.12 },
  RCS:      { DELIVERED: 0.95, OPENED: 0.70, READ: 0.88, CLICKED: 0.40, CONVERTED: 0.14 },
};

const FAILURE_AT_SEND = 0.03; // 3% hard failure

function pickNextEvent(channel: string, current: string): EventType | null {
  const table = PROBS[channel] ?? PROBS.Email;
  const idx = EVENT_CHAIN.indexOf(current as (typeof EVENT_CHAIN)[number]);
  if (idx < 0) return "SENT";
  if (idx >= EVENT_CHAIN.length - 1) return null;
  const next = EVENT_CHAIN[idx + 1];
  const p = table[next] ?? 0;
  return Math.random() < p ? (next as EventType) : null;
}

async function log(level: string, message: string, metadata: Record<string, unknown> = {}, communication_id?: string) {
  await supabaseAdmin.from("simulator_logs").insert({ level, message, metadata: metadata as never, communication_id });
}

async function postCallback(callbackUrl: string, payload: unknown): Promise<{ ok: boolean; status: number; body?: string }> {
  try {
    const r = await fetch(callbackUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-channel-simulator": "1" },
      body: JSON.stringify(payload),
    });
    const body = await r.text();
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: (e as Error).message };
  }
}

/** Enqueue a new communication for the simulator. */
export async function simulatorEnqueue(input: {
  communication_id: string;
  customer_id?: string;
  channel: string;
  recipient: string;
  message: string;
  callback_url: string;
}) {
  await supabaseAdmin.from("simulator_queue").insert({
    communication_id: input.communication_id,
    customer_id: input.customer_id,
    channel: input.channel,
    recipient: input.recipient,
    message: input.message,
    callback_url: input.callback_url,
    current_state: "QUEUED",
    next_event: "SENT",
    next_run_at: new Date(Date.now() + Math.random() * 1500).toISOString(),
  });
  await log("info", "queued", { channel: input.channel, recipient: input.recipient }, input.communication_id);
}

/** Drain due items from the queue, emit one event each, schedule the next. */
export async function simulatorTick(limit = 200): Promise<{ processed: number; emitted: number; failed: number }> {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("simulator_queue")
    .select("*")
    .lte("next_run_at", nowIso)
    .not("current_state", "in", "(TERMINAL,DEAD)")
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (!due || due.length === 0) return { processed: 0, emitted: 0, failed: 0 };

  let emitted = 0;
  let failed = 0;

  for (const row of due) {
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
    } else if (cur === "SENT" || EVENT_CHAIN.includes(cur as (typeof EVENT_CHAIN)[number])) {
      event = pickNextEvent(channel, cur);
      if (!event) {
        // chain stops here, mark terminal
        await supabaseAdmin
          .from("simulator_queue")
          .update({ current_state: "TERMINAL", next_event: null })
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
      metadata: { channel, recipient: row.recipient, attempt: row.attempts + 1 },
    };

    const cb = await postCallback(row.callback_url ?? "", payload);
    if (cb.ok) {
      emitted++;
      await log("info", `emitted ${event}`, { status: cb.status }, row.communication_id);
      const delayMs = 1500 + Math.floor(Math.random() * 8000);
      await supabaseAdmin
        .from("simulator_queue")
        .update({
          current_state: isTerminal ? "TERMINAL" : event,
          next_event: isTerminal ? null : "next",
          next_run_at: new Date(Date.now() + delayMs).toISOString(),
          attempts: 0,
          last_error: null,
        })
        .eq("id", row.id);
    } else {
      failed++;
      const attempts = (row.attempts ?? 0) + 1;
      const dead = attempts >= (row.max_attempts ?? 3);
      await log("warn", `callback failed (attempt ${attempts})`, { status: cb.status, body: cb.body?.slice(0, 200) }, row.communication_id);
      const backoff = Math.min(60_000, 2000 * Math.pow(2, attempts));
      await supabaseAdmin
        .from("simulator_queue")
        .update({
          attempts,
          last_error: `HTTP ${cb.status}: ${cb.body?.slice(0, 200) ?? ""}`,
          next_run_at: new Date(Date.now() + backoff).toISOString(),
          current_state: dead ? "DEAD" : cur,
        })
        .eq("id", row.id);
    }
  }

  return { processed: due.length, emitted, failed };
}
