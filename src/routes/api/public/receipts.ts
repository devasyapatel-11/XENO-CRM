// CRM Communication Tracking Engine
// Receives event callbacks from the Channel Simulator.
//
// Per event:
//   1. Appends to communication_events (event sourcing — immutable log)
//   2. Advances materialized state on the communications row
//   3. Increments the matching counter on campaign_metrics (real-time)
//
// campaign_metrics columns incremented per event:
//   SENT      → sent
//   FAILED    → failed
//   DELIVERED → delivered
//   OPENED    → opened
//   CLICKED   → clicked
//   CONVERTED → converted  (+revenue estimate)
import { createFileRoute } from "@tanstack/react-router";

type Receipt = {
  communication_id: string;
  event_type: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

const TERMINAL = new Set(["FAILED", "CONVERTED"]);

// Rough average order value used to estimate revenue on conversion (INR)
const AVG_ORDER_VALUE_INR = 1_200;

// Map event_type → campaign_metrics column to increment
const EVENT_TO_METRIC: Record<string, string> = {
  SENT:      "sent",
  FAILED:    "failed",
  DELIVERED: "delivered",
  OPENED:    "opened",
  CLICKED:   "clicked",
  CONVERTED: "converted",
};

export const Route = createFileRoute("/api/public/receipts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Receipt;
        try {
          body = (await request.json()) as Receipt;
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400 });
        }

        const { communication_id, event_type, timestamp, metadata } = body;
        if (!communication_id || !event_type) {
          return Response.json({ error: "missing fields: communication_id, event_type" }, { status: 400 });
        }

        // Validate shared secret when configured (prevents spoofed callbacks)
        const expectedSecret = process.env.SIMULATOR_SECRET;
        if (expectedSecret) {
          const incoming = request.headers.get("x-simulator-secret") ?? "";
          if (incoming !== expectedSecret) {
            return Response.json({ error: "unauthorized" }, { status: 401 });
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const occurred_at = timestamp ?? new Date().toISOString();

        // 1. Append to event log (never update, only insert)
        const { error: evErr } = await supabaseAdmin.from("communication_events").insert({
          communication_id,
          event_type,
          occurred_at,
          metadata: (metadata ?? {}) as never,
        });
        if (evErr) return Response.json({ error: evErr.message }, { status: 500 });

        // 2. Advance materialized communication state
        await supabaseAdmin
          .from("communications")
          .update({ state: event_type, last_event_at: occurred_at })
          .eq("id", communication_id);

        // 3. Increment campaign_metrics in real-time via fetch-then-update
        const metricCol = EVENT_TO_METRIC[event_type];
        if (metricCol) {
          const { data: comm } = await supabaseAdmin
            .from("communications")
            .select("campaign_id")
            .eq("id", communication_id)
            .maybeSingle();

          const campaignId = comm?.campaign_id;
          if (campaignId) {
            // Fetch current metric row
            const { data: mRow } = await supabaseAdmin
              .from("campaign_metrics")
              .select("sent,delivered,failed,opened,clicked,converted,revenue")
              .eq("campaign_id", campaignId)
              .maybeSingle();

            if (mRow) {
              const patch: Record<string, number> = {
                [metricCol]: ((mRow as Record<string, number>)[metricCol] ?? 0) + 1,
              };
              if (event_type === "CONVERTED") {
                patch.revenue = ((mRow as Record<string, number>).revenue ?? 0) + AVG_ORDER_VALUE_INR;
              }
              await supabaseAdmin
                .from("campaign_metrics")
                .update(patch as never)
                .eq("campaign_id", campaignId);
            } else {
              // No metrics row yet — create one zeroed with this first event
              const initial: Record<string, number | string> = {
                campaign_id: campaignId,
                sent: 0, delivered: 0, failed: 0,
                opened: 0, clicked: 0, converted: 0, revenue: 0,
                [metricCol]: 1,
              };
              if (event_type === "CONVERTED") initial.revenue = AVG_ORDER_VALUE_INR;
              await supabaseAdmin.from("campaign_metrics").insert(initial as never);
            }

            // When campaign hits a terminal event, flip status to Sent
            if (TERMINAL.has(event_type)) {
              const { count: pendingCount } = await supabaseAdmin
                .from("communications")
                .select("id", { count: "exact", head: true })
                .eq("campaign_id", campaignId)
                .eq("state", "PENDING");

              if ((pendingCount ?? 1) === 0) {
                await supabaseAdmin
                  .from("campaigns")
                  .update({ status: "Sent" })
                  .eq("id", campaignId)
                  .eq("status", "Sending");
              }
            }
          }
        }

        return Response.json({ ok: true, terminal: TERMINAL.has(event_type) });
      },
    },
  },
});
