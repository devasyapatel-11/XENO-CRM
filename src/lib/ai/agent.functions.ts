// AI Campaign Agent - turns a marketer goal into a launch-ready campaign
// through a transparent multi-step workflow.
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { evaluateRules, type SegmentRules } from "@/lib/crm/segment";

const MODEL = "google/gemma-4-31b-it:free";
const MAX_TOKENS = 1024;

function getModel() {
  return createLovableAiGatewayProvider()(MODEL);
}

type Step = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  reasoning?: string;
  output?: unknown;
  started_at?: string;
  finished_at?: string;
};

const STEP_LABELS = [
  { id: "audience", label: "Identify best audience" },
  { id: "segment",  label: "Create customer segment" },
  { id: "channel",  label: "Recommend channel" },
  { id: "message",  label: "Generate campaign message" },
  { id: "estimate", label: "Estimate audience & performance" },
  { id: "ready",    label: "Ready for approval" },
];

function newSteps(): Step[] {
  return STEP_LABELS.map((s) => ({ ...s, status: "pending" as const }));
}

async function patchStep(runId: string, id: string, patch: Partial<Step>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("ai_agent_runs").select("steps").eq("id", runId).maybeSingle();
  const steps = ((data?.steps as Step[] | null) ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s));
  await supabaseAdmin.from("ai_agent_runs").update({ steps: steps as never }).eq("id", runId);
}

export const startAgentRun = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ goal: z.string().min(3) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("ai_agent_runs")
      .insert({ goal: data.goal, status: "running", steps: newSteps() as never })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { run_id: row.id };
  });

export const executeAgent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const runId = data.run_id;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run } = await supabaseAdmin.from("ai_agent_runs").select("goal").eq("id", runId).maybeSingle();
    if (!run) throw new Error("Run not found");
    const goal = run.goal;

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id,name,email,phone,city,age,total_spend,clv,last_purchase_date,status, orders(category,payment_status)");
    const total = customers?.length ?? 0;

    // Step 1: audience
    await patchStep(runId, "audience", { status: "running", started_at: new Date().toISOString() });
    const { text: audText } = await generateText({
      model: getModel(),
      system: "You are an AI marketing strategist. Describe the ideal target audience in 2-3 sentences. Reply with ONLY a short paragraph.",
      prompt: `Goal: ${goal}\nCustomers: ${JSON.stringify({ total, byStatus: customers?.reduce<Record<string,number>>((a,c) => { a[c.status]=(a[c.status]??0)+1; return a; }, {}) })}`,
      maxTokens: MAX_TOKENS,
    });
    await patchStep(runId, "audience", { status: "done", reasoning: audText, output: { description: audText }, finished_at: new Date().toISOString() });

    // Step 2: segment rules
    await patchStep(runId, "segment", { status: "running", started_at: new Date().toISOString() });
    const { text: segText } = await generateText({
      model: getModel(),
      system: `Convert audience description to JSON segment rule. Schema: { "op":"AND"|"OR", "conditions":[{"field":"total_spend"|"clv"|"age"|"city"|"status"|"last_purchase_date"|"ordered_category"|"order_count","operator":">"|"<"|">="|"<="|"="|"!="|"contains","value":<number|string>}] }. Fields schema: total_spend/clv/age/order_count are numbers, ordered_category is one of "Apparel"|"Beauty"|"Electronics"|"Home"|"Footwear"|"Grocery". Reply ONLY JSON.`,
      prompt: audText,
      maxTokens: MAX_TOKENS,
    });
    let rules: SegmentRules;
    try { rules = JSON.parse(segText.replace(/^```json\s*|\s*```$/g, "").trim()) as SegmentRules; }
    catch { rules = { op: "AND", conditions: [] }; }
    const matched = (customers ?? []).filter((c) => evaluateRules(rules, {
      total_spend: Number(c.total_spend), clv: Number(c.clv),
      age: c.age ?? null, city: c.city, status: c.status, last_purchase_date: c.last_purchase_date,
      orders: c.orders,
    }));
    await patchStep(runId, "segment", { status: "done", reasoning: `${rules.conditions?.length ?? 0} rule(s). Matched ${matched.length} customers.`, output: { rules, matched: matched.length }, finished_at: new Date().toISOString() });

    // Step 3: channel
    await patchStep(runId, "channel", { status: "running", started_at: new Date().toISOString() });
    const { data: campMetrics } = await supabaseAdmin.from("campaigns").select("channel,status,campaign_metrics(sent,converted,revenue)");
    const ch: Record<string, { sent: number; converted: number; revenue: number }> = {};
    for (const c of campMetrics ?? []) {
      const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
      if (!m || c.status !== "Sent") continue;
      const cur = ch[c.channel] ?? { sent: 0, converted: 0, revenue: 0 };
      cur.sent += m.sent; cur.converted += m.converted; cur.revenue += Number(m.revenue);
      ch[c.channel] = cur;
    }
    const best = Object.entries(ch).sort((a, b) => (b[1].sent ? b[1].converted/b[1].sent : 0) - (a[1].sent ? a[1].converted/a[1].sent : 0))[0]?.[0] ?? "WhatsApp";
    await patchStep(runId, "channel", { status: "done", reasoning: `Picked ${best} based on historical conversion.`, output: { channel: best }, finished_at: new Date().toISOString() });

    // Step 4: message
    await patchStep(runId, "message", { status: "running", started_at: new Date().toISOString() });
    const { text: msgText } = await generateText({
      model: getModel(),
      system: `CRM copywriter for Indian D2C brand. Generate ONE message for the channel. Use {{name}} for personalization. SMS<160 chars. WhatsApp+emojis<350. Email: subject+body+CTA. RCS<200.
Reply JSON ONLY: {"name":"campaign name","subject":"or null","message":"body","cta":"CTA"}`,
      prompt: `Goal: ${goal}\nAudience: ${audText}\nChannel: ${best}`,
      maxTokens: MAX_TOKENS,
    });
    let copy: { name: string; subject: string | null; message: string; cta: string };
    try { copy = JSON.parse(msgText.replace(/^```json\s*|\s*```$/g, "").trim()); }
    catch { copy = { name: goal.slice(0, 48), subject: null, message: `Hi {{name}}, ${goal}.`, cta: "Shop now" }; }
    await patchStep(runId, "message", { status: "done", reasoning: `Drafted ${best} copy.`, output: copy, finished_at: new Date().toISOString() });

    // Step 5: estimate
    await patchStep(runId, "estimate", { status: "running", started_at: new Date().toISOString() });
    const channelStat = ch[best] ?? { sent: 1, converted: 0, revenue: 0 };
    const convRate = channelStat.sent ? channelStat.converted / channelStat.sent : 0.04;
    const avgRev = channelStat.converted ? channelStat.revenue / channelStat.converted : 1200;
    const expectedConv = Math.round(matched.length * convRate);
    const expectedRevenue = Math.round(expectedConv * avgRev);
    await patchStep(runId, "estimate", {
      status: "done",
      reasoning: `At ${(convRate*100).toFixed(1)}% conversion, ~${expectedConv} customers → ₹${expectedRevenue.toLocaleString("en-IN")}.`,
      output: { audience_size: matched.length, expected_conversions: expectedConv, expected_revenue: expectedRevenue },
      finished_at: new Date().toISOString(),
    });

    // Step 6: ready
    await patchStep(runId, "ready", { status: "done", reasoning: "Awaiting marketer approval.", finished_at: new Date().toISOString() });

    // Persist segment + draft campaign
    const { data: seg } = await supabaseAdmin.from("segments").insert({
      name: `AI: ${copy.name}`, description: audText, rules: rules as never, audience_size: matched.length,
    }).select("id").single();
    const { data: camp } = await supabaseAdmin.from("campaigns").insert({
      name: copy.name, goal, channel: best, subject: copy.subject, message_content: copy.message, status: "Draft", segment_id: seg?.id ?? null,
    }).select("id").single();

    await supabaseAdmin.from("ai_agent_runs").update({
      status: "awaiting_approval",
      campaign_id: camp?.id ?? null,
      segment_id: seg?.id ?? null,
      result: { audience: audText, channel: best, copy, audience_size: matched.length, expected_revenue: expectedRevenue, expected_conversions: expectedConv } as never,
    }).eq("id", runId);

    return { run_id: runId, campaign_id: camp?.id, segment_id: seg?.id, audience_size: matched.length, expected_revenue: expectedRevenue };
  });

export const approveAgentRun = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ run_id: z.string().uuid(), audience_limit: z.number().int().min(1).max(500).default(50) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run } = await supabaseAdmin.from("ai_agent_runs").select("campaign_id").eq("id", data.run_id).maybeSingle();
    if (!run?.campaign_id) throw new Error("Run has no campaign");
    const { dispatchCampaign } = await import("@/lib/comms/dispatch.functions");
    const result = await dispatchCampaign({ data: { campaign_id: run.campaign_id, audience_limit: data.audience_limit } });
    await supabaseAdmin.from("ai_agent_runs").update({ status: "launched" }).eq("id", data.run_id);
    return result;
  });
