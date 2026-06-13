import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const MODEL = "meta-llama/llama-3.3-70b-instruct:free";

function getModel() {
  return createLovableAiGatewayProvider()(MODEL);
}

async function snapshot() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: cust }, { data: orders }, { data: camps }] = await Promise.all([
    supabaseAdmin.from("customers").select("status,city,total_spend,clv,last_purchase_date"),
    supabaseAdmin.from("orders").select("category,amount,payment_status,order_date"),
    supabaseAdmin.from("campaigns").select("name,channel,status,campaign_metrics(sent,delivered,opened,clicked,converted,revenue)"),
  ]);

  const byStatus: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  let totalSpend = 0, churnRiskSpend = 0;
  const churnRisk: Array<{ spend: number; clv: number }> = [];
  for (const c of cust ?? []) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    if (c.city) byCity[c.city] = (byCity[c.city] ?? 0) + 1;
    totalSpend += Number(c.total_spend);
    if (c.status === "Churn Risk") { churnRisk.push({ spend: Number(c.total_spend), clv: Number(c.clv) }); churnRiskSpend += Number(c.total_spend); }
  }
  const revByCat: Record<string, number> = {};
  for (const o of orders ?? []) if (o.payment_status === "Paid") revByCat[o.category] = (revByCat[o.category] ?? 0) + Number(o.amount);
  const byChannel: Record<string, { sent: number; converted: number; revenue: number }> = {};
  for (const c of camps ?? []) {
    const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
    if (!m || c.status !== "Sent") continue;
    const cur = byChannel[c.channel] ?? { sent: 0, converted: 0, revenue: 0 };
    cur.sent += m.sent; cur.converted += m.converted; cur.revenue += Number(m.revenue);
    byChannel[c.channel] = cur;
  }
  return {
    customers: cust?.length ?? 0, byStatus, byCity,
    totalSpend: Math.round(totalSpend),
    churnRisk: { count: churnRisk.length, totalSpend: Math.round(churnRiskSpend) },
    revenueByCategory: Object.entries(revByCat).map(([k, v]) => ({ category: k, revenue: Math.round(v) })).sort((a, b) => b.revenue - a.revenue),
    channels: Object.entries(byChannel).map(([k, v]) => ({ channel: k, sent: v.sent, conversion: v.sent ? +(v.converted / v.sent * 100).toFixed(2) : 0, revenue: Math.round(v.revenue) })),
  };
}

export const generateRecommendations = createServerFn({ method: "POST" }).handler(async () => {
  const snap = await snapshot();
  const sys = `You are a CRM marketing strategist for an Indian D2C brand. Given the snapshot, propose 4 high-impact recommendations.
Reply JSON ONLY: { "recommendations": [{ "kind": "audience"|"channel"|"campaign"|"revenue", "title": "headline", "summary": "one sentence", "reasoning": "2-3 sentences citing numbers", "impact_estimate": <INR number>, "payload": {} }] }
Use snapshot numbers only — do not invent.`;

  const { text } = await generateText({ model: getModel(), system: sys, prompt: JSON.stringify(snap), maxTokens: 2048 });
  const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
  let parsed: { recommendations: Array<{ kind: string; title: string; summary: string; reasoning: string; impact_estimate: number; payload?: unknown }> };
  try { parsed = JSON.parse(cleaned); } catch { throw new Error("AI returned invalid JSON"); }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ai_recommendations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (parsed.recommendations?.length) {
    await supabaseAdmin.from("ai_recommendations").insert(parsed.recommendations.map((r) => ({
      kind: r.kind, title: r.title, summary: r.summary, reasoning: r.reasoning,
      impact_estimate: r.impact_estimate ?? null,
      payload: (r.payload ?? {}) as never,
    })));
  }
  return { count: parsed.recommendations?.length ?? 0, snapshot: snap };
});
