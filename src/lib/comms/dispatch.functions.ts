// CRM-side dispatcher. Creates communications rows for a campaign's audience
// and forwards each to the Channel Simulator (external service).
// The simulator calls back to /api/public/receipts which updates state +
// aggregates into campaign_metrics in real time.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const DispatchInput = z.object({
  campaign_id: z.string().uuid(),
  audience_limit: z.number().int().min(1).max(500).default(50),
});

function deriveCrmOrigin(): string {
  try {
    const host = getRequestHost();
    const proto = getRequestHeader("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch { /* not in request context */ }
  return process.env.PUBLIC_APP_URL ?? "";
}

/** Returns the channel simulator base URL.
 *  Falls back to the CRM's own /api/public/channel endpoint so local dev
 *  works without a separately-running simulator process. */
function simulatorUrl(): string {
  return (process.env.CHANNEL_SIMULATOR_URL ?? "").replace(/\/$/, "");
}

export const dispatchCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DispatchInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: camp } = await supabaseAdmin
      .from("campaigns")
      .select("id,channel,message_content,segment_id,name,goal")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (!camp) throw new Error("Campaign not found");

    // Fetch segment rules if a segment is attached
    let segmentRules: { op: string; conditions: unknown[] } | null = null;
    if (camp.segment_id) {
      const { data: seg } = await supabaseAdmin
        .from("segments")
        .select("rules")
        .eq("id", camp.segment_id)
        .maybeSingle();
      if (seg?.rules && typeof seg.rules === "object" && !Array.isArray(seg.rules)) {
        segmentRules = seg.rules as { op: string; conditions: unknown[] };
      }
    }

    // Build audience: customers matching segment rules (if any) or top by CLV
    let customers: Array<{ id: string; name: string; email: string; phone: string | null }> = [];

    if (segmentRules && segmentRules.conditions.length > 0) {
      // Fetch all customers and filter client-side using evaluateRules
      const { data: all } = await supabaseAdmin
        .from("customers")
        .select("id,name,email,phone,total_spend,clv,age,city,status,last_purchase_date, orders(category,payment_status)");

      if (all) {
        const { evaluateRules } = await import("@/lib/crm/segment");
        const filtered = all.filter((c) =>
          evaluateRules(segmentRules as Parameters<typeof evaluateRules>[0], {
            total_spend: Number(c.total_spend),
            clv: Number(c.clv),
            age: c.age ?? null,
            city: c.city,
            status: c.status,
            last_purchase_date: c.last_purchase_date,
          }),
        );
        customers = filtered.slice(0, data.audience_limit);
      }
    } else {
      const { data: top } = await supabaseAdmin
        .from("customers")
        .select("id,name,email,phone")
        .order("clv", { ascending: false })
        .limit(data.audience_limit);
      customers = top ?? [];
    }

    if (!customers || customers.length === 0) throw new Error("No customers in audience");

    // Create communications rows (state=PENDING)
    const commRows = customers.map((c) => ({
      campaign_id: camp.id,
      customer_id: c.id,
      channel: camp.channel,
      recipient: camp.channel === "Email" ? c.email : (c.phone ?? c.email),
      message: (camp.message_content ?? "").replace(/\{\{name\}\}/g, c.name.split(" ")[0]),
      state: "PENDING",
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("communications")
      .insert(commRows)
      .select("id,channel,recipient,message,customer_id");
    if (error) throw new Error(error.message);

    // Initialise campaign_metrics row (zeroed — will be updated by callbacks)
    await supabaseAdmin
      .from("campaign_metrics")
      .upsert(
        {
          campaign_id: camp.id,
          sent: 0,
          delivered: 0,
          failed: 0,
          opened: 0,
          clicked: 0,
          converted: 0,
          revenue: 0,
        },
        { onConflict: "campaign_id" },
      );

    // Mark campaign Sending
    await supabaseAdmin
      .from("campaigns")
      .update({ status: "Sending", sent_at: new Date().toISOString() })
      .eq("id", camp.id);

    // Build URLs
    const crmOrigin = deriveCrmOrigin();
    const simBase = simulatorUrl() || `${crmOrigin}/api/public/channel`;
    const sendUrl = simBase.endsWith("/send") ? simBase : `${simBase}/send`;
    const cbUrl = `${crmOrigin}/api/public/receipts`;

    // Dispatch to simulator in parallel (fire-and-forget; errors are non-fatal)
    const tasks = (inserted ?? []).map((c) =>
      fetch(sendUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          communication_id: c.id,
          customer_id: c.customer_id,
          recipient: c.recipient,
          channel: c.channel,
          message: c.message,
          callback_url: cbUrl,
        }),
      }).catch((e) => {
        console.error("[dispatch] send error:", e);
        return null;
      }),
    );
    await Promise.all(tasks);

    // Kick simulator tick if we're using the built-in fallback endpoint
    if (!process.env.CHANNEL_SIMULATOR_URL) {
      await fetch(`${crmOrigin}/api/public/channel/tick`, { method: "POST" }).catch(() => null);
    }

    return { dispatched: inserted?.length ?? 0, campaign: camp.name };
  });

export const tickSimulator = createServerFn({ method: "POST" }).handler(async () => {
  const simBase = simulatorUrl();

  if (simBase) {
    // External simulator — call its /tick endpoint
    const res = await fetch(`${simBase}/tick`, { method: "POST" }).catch(() => null);
    if (res?.ok) return res.json() as Promise<{ processed: number; emitted: number; failed: number }>;
    return { processed: 0, emitted: 0, failed: 0 };
  }

  // Fallback: run locally
  const { simulatorTick } = await import("@/lib/simulator/engine.server");
  let totalEmitted = 0, totalFailed = 0, totalProcessed = 0;
  for (let i = 0; i < 3; i++) {
    const r = await simulatorTick(200);
    totalEmitted += r.emitted;
    totalFailed += r.failed;
    totalProcessed += r.processed;
    if (r.processed === 0) break;
    await new Promise((res) => setTimeout(res, 200));
  }
  return { processed: totalProcessed, emitted: totalEmitted, failed: totalFailed };
});
