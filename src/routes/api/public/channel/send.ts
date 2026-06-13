// Channel Simulator - CRM-internal fallback /send endpoint.
// When CHANNEL_SIMULATOR_URL is NOT set, the CRM routes sends through here
// so local development works without a separately running simulator.
// In production, set CHANNEL_SIMULATOR_URL and the CRM will POST directly
// to the external simulator service instead of this route.
import { createFileRoute } from "@tanstack/react-router";

type SendBody = {
  communication_id: string;
  customer_id?: string;
  recipient: string;
  channel: "Email" | "SMS" | "WhatsApp" | "RCS";
  message: string;
  callback_url?: string;
};

export const Route = createFileRoute("/api/public/channel/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: SendBody;
        try {
          body = (await request.json()) as SendBody;
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400 });
        }
        if (!body.communication_id || !body.recipient || !body.channel || !body.message) {
          return Response.json({ error: "missing required fields" }, { status: 400 });
        }
        const origin = new URL(request.url).origin;
        const callback = body.callback_url ?? `${origin}/api/public/receipts`;
        const { simulatorEnqueue } = await import("@/lib/simulator/engine.server");
        await simulatorEnqueue({
          communication_id: body.communication_id,
          customer_id: body.customer_id,
          channel: body.channel,
          recipient: body.recipient,
          message: body.message,
          callback_url: callback,
        });
        return Response.json({ accepted: true, communication_id: body.communication_id });
      },
    },
  },
});
