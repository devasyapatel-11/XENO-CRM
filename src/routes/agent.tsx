import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startAgentRun, executeAgent } from "@/lib/ai/agent.functions";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/agent")({ component: AgentIndex });

const PRESETS = [
  "Bring back inactive customers",
  "Increase repeat purchases from Mumbai shoppers",
  "Promote our new skincare collection",
  "Reward VIP customers with an exclusive offer",
];

function AgentIndex() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [goal, setGoal] = useState("");
  const start = useServerFn(startAgentRun);
  const exec = useServerFn(executeAgent);

  const runs = useQuery({
    queryKey: ["agent", "runs"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_agent_runs").select("id,goal,status,created_at").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const launch = useMutation({
    mutationFn: async (g: string) => {
      const { run_id } = await start({ data: { goal: g } });
      // navigate first, then kick off execution in background
      nav({ to: "/agent/$runId", params: { runId: run_id } });
      exec({ data: { run_id } }).catch((e) => toast.error((e as Error).message));
      return run_id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent", "runs"] }),
  });

  return (
    <AppShell title="AI Campaign Agent">
      <PageContainer>
        <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10"><Bot className="h-6 w-6 text-primary" /></div>
              <div>
                <CardTitle>Tell the agent your goal</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">It will pick the audience, segment, channel, copy, estimate impact, and prepare for launch — fully transparent reasoning.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Bring back inactive customers from Mumbai with an irresistible offer." rows={3} />
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => setGoal(p)}>{p}</Button>
              ))}
            </div>
            <Button onClick={() => launch.mutate(goal)} disabled={!goal.trim() || launch.isPending} className="w-full sm:w-auto">
              {launch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Run agent
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent agent runs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(runs.data ?? []).map((r) => (
              <Link key={r.id} to="/agent/$runId" params={{ runId: r.id }} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40">
                <div>
                  <p className="font-medium text-sm">{r.goal}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={r.status === "launched" ? "default" : r.status === "awaiting_approval" ? "secondary" : "outline"}>{r.status}</Badge>
              </Link>
            ))}
            {runs.data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No runs yet.</p>}
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
