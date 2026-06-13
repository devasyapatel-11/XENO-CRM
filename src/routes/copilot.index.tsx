import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/copilot/")({ component: CopilotIndex });

function CopilotIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("copilot_threads").select("id").order("updated_at", { ascending: false }).limit(1);
      let id = data?.[0]?.id;
      if (!id) {
        const ins = await supabase.from("copilot_threads").insert({ title: "New conversation" }).select().single();
        id = ins.data?.id;
      }
      if (id) navigate({ to: "/copilot/$threadId", params: { threadId: id }, replace: true });
    })();
  }, [navigate]);
  return <div className="grid h-screen place-items-center text-sm text-muted-foreground">Opening Copilot…</div>;
}
