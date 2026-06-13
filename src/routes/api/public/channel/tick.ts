// Channel Simulator - tick endpoint (drains queue, emits one batch of events).
// Call manually from UI or schedule via pg_cron.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/channel/tick")({
  server: {
    handlers: {
      POST: async () => {
        const { simulatorTick } = await import("@/lib/simulator/engine.server");
        const result = await simulatorTick(200);
        return Response.json(result);
      },
      GET: async () => {
        const { simulatorTick } = await import("@/lib/simulator/engine.server");
        const result = await simulatorTick(200);
        return Response.json(result);
      },
    },
  },
});
