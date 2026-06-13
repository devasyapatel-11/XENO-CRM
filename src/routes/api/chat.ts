import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });
        const key = process.env.OPENROUTER_API_KEY;
        if (!key) return new Response("Missing OPENROUTER_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-2.5-flash");

        // Lazy import server-only supabase admin
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const system = `You are Xeno Copilot, an AI marketing assistant for an Indian D2C CRM platform.
You help marketers analyze customers, recommend audiences and campaigns, and explain insights.
Use the tools provided to ground every answer in real CRM data — never invent numbers.
You can now search for customers based on their purchase history (ordered product categories and order counts).
Format responses in concise markdown with bullet points and bold key metrics.
Use ₹ for currency. When you recommend a campaign or segment, end with a brief actionable next step.`;

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(50),
          maxTokens: 2048,
          tools: {
            getCustomerStats: tool({
              description: "Get aggregate customer statistics: total count, breakdown by status, city, and CLV tiers.",
              inputSchema: z.object({}),
              execute: async () => {
                const { data } = await supabaseAdmin.from("customers").select("status,city,clv,total_spend");
                const rows = data ?? [];
                const byStatus: Record<string, number> = {};
                const byCity: Record<string, number> = {};
                let highValue = 0; let totalSpend = 0;
                for (const r of rows) {
                  byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
                  if (r.city) byCity[r.city] = (byCity[r.city] ?? 0) + 1;
                  if (Number(r.clv) > 30000) highValue++;
                  totalSpend += Number(r.total_spend);
                }
                return { total: rows.length, byStatus, byCity, highValueCount: highValue, totalSpend };
              },
            }),
            getTopCustomers: tool({
              description: "Get the top N customers by total spend or CLV.",
              inputSchema: z.object({ limit: z.number().min(1).max(20).default(5), sortBy: z.enum(["total_spend", "clv"]).default("clv") }),
              execute: async ({ limit, sortBy }) => {
                const { data } = await supabaseAdmin.from("customers").select("name,city,status,total_spend,clv,last_purchase_date").order(sortBy, { ascending: false }).limit(limit);
                return data ?? [];
              },
            }),
            getChurnRiskCustomers: tool({
              description: "List customers flagged as churn risk.",
              inputSchema: z.object({ limit: z.number().min(1).max(20).default(10) }),
              execute: async ({ limit }) => {
                const { data } = await supabaseAdmin.from("customers").select("name,city,total_spend,last_purchase_date").eq("status", "Churn Risk").limit(limit);
                return data ?? [];
              },
            }),
            getCampaignPerformance: tool({
              description: "Get performance metrics for all campaigns.",
              inputSchema: z.object({}),
              execute: async () => {
                const { data } = await supabaseAdmin.from("campaigns").select("name,channel,status,campaign_metrics(*)");
                return (data ?? []).map((c) => {
                  const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
                  return { name: c.name, channel: c.channel, status: c.status, ...m };
                });
              },
            }),
            getRevenueByCategory: tool({
              description: "Revenue grouped by product category.",
              inputSchema: z.object({}),
              execute: async () => {
                const { data } = await supabaseAdmin.from("orders").select("category,amount,payment_status");
                const agg: Record<string, number> = {};
                for (const o of data ?? []) {
                  if (o.payment_status === "Paid") agg[o.category] = (agg[o.category] ?? 0) + Number(o.amount);
                }
                return Object.entries(agg).map(([category, revenue]) => ({ category, revenue: Math.round(revenue) }));
              },
            }),
            searchCustomersByBehavior: tool({
              description: "Search for customers who have ordered specific product categories or have a minimum order count.",
              inputSchema: z.object({
                orderedCategory: z.enum(["Apparel", "Beauty", "Electronics", "Home", "Footwear", "Grocery"]).optional(),
                minOrderCount: z.number().int().min(1).optional(),
                limit: z.number().min(1).max(20).default(5),
              }),
              execute: async ({ orderedCategory, minOrderCount, limit }) => {
                const { data } = await supabaseAdmin
                  .from("customers")
                  .select("id, name, email, city, total_spend, clv, status, orders(category, payment_status)");
                let list = data ?? [];
                if (orderedCategory) {
                  list = list.filter((c) =>
                    (c.orders ?? []).some((o) => o.category === orderedCategory && o.payment_status === "Paid")
                  );
                }
                if (minOrderCount !== undefined) {
                  list = list.filter((c) =>
                    (c.orders ?? []).filter((o) => o.payment_status === "Paid").length >= minOrderCount
                  );
                }
                return list.slice(0, limit).map((c) => ({
                  name: c.name,
                  email: c.email,
                  city: c.city,
                  total_spend: c.total_spend,
                  clv: c.clv,
                  status: c.status,
                  order_count: (c.orders ?? []).filter((o) => o.payment_status === "Paid").length,
                  categories_bought: Array.from(new Set((c.orders ?? []).filter((o) => o.payment_status === "Paid").map((o) => o.category))),
                }));
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
