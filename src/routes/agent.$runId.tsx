import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { approveAgentRun } from "@/lib/ai/agent.functions";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Circle, AlertCircle, ArrowRight, Rocket } from "lucide-react";
import { inrFull } from "@/lib/crm/format";
import { toast } from "sonner";

export const Route = createFileRoute("/agent/$runId")({ component: AgentRunPage });

type Step = { id: string; label: string; status: "pending" | "running" | "done" | "error"; reasoning?: string; output?: unknown };

function AgentRunPage() {
  const { runId } = Route.useParams();
  const qc = useQueryClient();
  const run = useQuery({
    queryKey: ["agent", "run", runId],
    queryFn: async () => {
      const { data } = await supabase.from("ai_agent_runs").select("*").eq("id", runId).maybeSingle();
      return data;
    },
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "running" ? 1500 : false;
    },
  });
  const approve = useServerFn(approveAgentRun);
  const approveM = useMutation({
    mutationFn: () => approve({ data: { run_id: runId, audience_limit: 50 } }),
    onSuccess: (r) => { toast.success(`Launched. Dispatched to ${r.dispatched} customers.`); qc.invalidateQueries({ queryKey: ["agent", "run", runId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!run.data) return <AppShell title="Agent Run"><PageContainer><p>Loading…</p></PageContainer></AppShell>;

  const steps = (run.data.steps as unknown as Step[]) ?? [];
  const result = run.data.result as { audience?: string; channel?: string; copy?: { name: string; subject: string | null; message: string; cta: string }; audience_size?: number; expected_revenue?: number; expected_conversions?: number } | null;

  return (
    <AppShell title="Agent Run" actions={<Link to="/agent"><Button variant="outline" size="sm">All runs</Button></Link>}>
      <PageContainer>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Goal</p>
                <CardTitle className="text-xl">{run.data.goal}</CardTitle>
              </div>
              <Badge variant={run.data.status === "launched" ? "default" : "secondary"}>{run.data.status}</Badge>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Agent workflow</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={s.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {s.status === "done" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> :
                     s.status === "running" ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
                     s.status === "error" ? <AlertCircle className="h-5 w-5 text-destructive" /> :
                     <Circle className="h-5 w-5 text-muted-foreground" />}
                    {i < steps.length - 1 && <div className="w-px h-12 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="font-medium text-sm">{s.label}</p>
                    {s.reasoning && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{s.reasoning}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {result?.copy && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Generated campaign</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Name: </span>{result.copy.name}</div>
                <div><span className="text-muted-foreground">Channel: </span><Badge variant="outline">{result.channel}</Badge></div>
                {result.copy.subject && <div><span className="text-muted-foreground">Subject: </span>{result.copy.subject}</div>}
                <div className="rounded-md bg-muted/40 p-3 whitespace-pre-wrap">{result.copy.message}</div>
                <div><span className="text-muted-foreground">CTA: </span><Badge>{result.copy.cta}</Badge></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Forecast</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Audience size</p><p className="text-2xl font-semibold">{result.audience_size?.toLocaleString("en-IN")}</p></div>
                <div><p className="text-xs text-muted-foreground">Expected conversions</p><p className="text-2xl font-semibold">{result.expected_conversions?.toLocaleString("en-IN")}</p></div>
                <div><p className="text-xs text-muted-foreground">Expected revenue</p><p className="text-2xl font-semibold text-emerald-600">{inrFull(result.expected_revenue ?? 0)}</p></div>
                {run.data.status === "awaiting_approval" && (
                  <Button onClick={() => approveM.mutate()} disabled={approveM.isPending} className="w-full mt-3">
                    {approveM.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                    Approve & launch
                  </Button>
                )}
                {run.data.status === "launched" && (
                  <Link to="/campaigns"><Button variant="outline" className="w-full">View campaign <ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
