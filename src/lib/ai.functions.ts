import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const MODEL = "google/gemini-2.5-flash";
const MAX_TOKENS = 1024;

function getModel() {
  return createLovableAiGatewayProvider()(MODEL);
}

const SegmentInput = z.object({ prompt: z.string().min(3) });

export const generateSegmentRules = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SegmentInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a marketing audience builder for an Indian e-commerce CRM.
Convert the user's natural-language description into a JSON segment rule.
Schema: { "op": "AND"|"OR", "conditions": [{ "field": <"total_spend"|"clv"|"age"|"city"|"status"|"last_purchase_date"|"ordered_category"|"order_count">, "operator": <">"|"<"|">="|"<="|"="|"!="|"contains">, "value": <number|string> }] }
- last_purchase_date value = INTEGER days ago. status = "Active"|"Inactive"|"Churn Risk".
- ordered_category value = "Apparel"|"Beauty"|"Electronics"|"Home"|"Footwear"|"Grocery". operator must be "=" or "!=".
- order_count value = INTEGER minimum paid orders.
- Currency is INR (e.g., "₹5000" -> 5000).
Reply ONLY the JSON object — no commentary, no markdown.`;

    const { text } = await generateText({ model: getModel(), system: sys, prompt: data.prompt, maxTokens: MAX_TOKENS });
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    try {
      return { rules: JSON.parse(cleaned) };
    } catch {
      throw new Error("AI returned invalid JSON. Try rephrasing your description.");
    }
  });

const CampaignInput = z.object({
  goal: z.string().min(3),
  audience: z.string().min(3),
  channel: z.enum(["Email", "SMS", "WhatsApp", "RCS"]),
  tone: z.string().optional(),
});

export const generateCampaignContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CampaignInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a senior CRM copywriter for an Indian D2C brand. Generate ONE marketing message.
Rules: Use {{name}} for personalization. SMS<160 chars. WhatsApp friendly+1-2 emojis<350 chars. Email: subject+90-140 word body+CTA. RCS<200 chars.
Reply JSON ONLY: { "name": "campaign name", "subject": "email subject or null", "message": "body", "cta": "CTA text" }`;

    const { text } = await generateText({
      model: getModel(),
      system: sys,
      prompt: `Goal: ${data.goal}\nAudience: ${data.audience}\nChannel: ${data.channel}\nTone: ${data.tone ?? "friendly, premium"}`,
      maxTokens: MAX_TOKENS,
    });
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    try {
      return JSON.parse(cleaned) as { name: string; subject: string | null; message: string; cta: string };
    } catch {
      throw new Error("AI returned invalid JSON.");
    }
  });
