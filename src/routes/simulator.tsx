import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { tickSimulator } from "@/lib/comms/dispatch.functions";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Radio, Play, RotateCw, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/simulator")({ component: SimulatorPage });

function SimulatorPage() {
  const qc = useQueryClient();

  const queue = useQuery({
    queryKey: ["sim", "queue"],
    queryFn: async () => {
      const { data } = await supabase.from("simulator_queue").select("*").order("updated_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    refetchInterval: 3000,
  });

  const logs = useQuery({
    queryKey: ["sim", "logs"],
    queryFn: async () => {
      const { data } = await supabase.from("simulator_logs").select("*").order("created_at", { ascending: false }).limit(40);
      return data ?? [];
    },
    refetchInterval: 3000,
  });

  const stats = useQuery({
    queryKey: ["sim", "stats"],
    queryFn: async () => {
      const { data } = await supabase.from("simulator_queue").select("current_state");
      const rows = data ?? [];
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.current_state] = (counts[r.current_state] ?? 0) + 1;
      return { total: rows.length, counts };
    },
    refetchInterval: 3000,
  });

  const tick = useServerFn(tickSimulator);
  const tickM = useMutation({
    mutationFn: () => tick(),
    onSuccess: (r) => {
      toast.success(`Tick: emitted ${r.emitted}, failed ${r.failed}, processed ${r.processed}`);
      qc.invalidateQueries({ queryKey: ["sim"] });
    },
  });

  const inFlight =
    (stats.data?.counts.QUEUED ?? 0) +
    (stats.data?.counts.SENT ?? 0) +
    (stats.data?.counts.DELIVERED ?? 0) +
    (stats.data?.counts.OPENED ?? 0) +
    (stats.data?.counts.READ ?? 0) +
    (stats.data?.counts.CLICKED ?? 0);

  const simUrl = import.meta.env.VITE_CHANNEL_SIMULATOR_URL as string | undefined;

  return (
    <AppShell
      title="Channel Simulator"
      actions={
        <Button onClick={() => tickM.mutate()} disabled={tickM.isPending}>
          {tickM.isPending ? <RotateCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Run tick
        </Button>
      }
    >
      <PageContainer>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Queue total" value={String(stats.data?.total ?? 0)} icon={Radio} />
          <KpiCard label="In flight" value={String(inFlight)} icon={RotateCw} />
          <KpiCard label="Terminal" value={String(stats.data?.counts.TERMINAL ?? 0)} icon={CheckCircle2} />
          <KpiCard label="Dead-letter" value={String(stats.data?.counts.DEAD ?? 0)} icon={AlertTriangle} tone="destructive" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              About this service
              {simUrl ? (
                <Badge variant="default" className="text-xs ml-2">External</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs ml-2">Built-in (fallback)</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            {simUrl ? (
              <p>
                The CRM is connected to an{" "}
                <a href={simUrl} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                  external Channel Simulator <ExternalLink className="h-3 w-3" />
                </a>.
                The CRM POSTs to <code className="text-foreground">{simUrl}/send</code>, and the simulator
                asynchronously fires SENT → DELIVERED → OPENED → READ → CLICKED → CONVERTED events back to
                the CRM receipts endpoint.
              </p>
            ) : (
              <p>
                Running in <strong className="text-foreground">built-in mode</strong> — no <code>CHANNEL_SIMULATOR_URL</code> set.
                The CRM handles simulation internally via <code className="text-foreground">/api/public/channel/send</code>.
                In production, deploy the <code className="text-foreground">channel-simulator/</code> service separately
                and set <code>CHANNEL_SIMULATOR_URL</code>.
              </p>
            )}
            <p>
              Every emitted event is appended to <code className="text-foreground">communication_events</code> (event sourcing).
              Campaign analytics are derived from this log in real time.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Queue (latest 50)</CardTitle></CardHeader>
            <CardContent className="max-h-[500px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Channel</th>
                    <th className="text-left p-2">State</th>
                    <th className="text-left p-2">Recipient</th>
                    <th className="text-left p-2">Attempts</th>
                    <th className="text-left p-2">Next run</th>
                  </tr>
                </thead>
                <tbody>
                  {(queue.data ?? []).map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.channel}</td>
                      <td className="p-2">
                        <Badge variant={r.current_state === "DEAD" ? "destructive" : r.current_state === "TERMINAL" ? "default" : "secondary"}>
                          {r.current_state}
                        </Badge>
                      </td>
                      <td className="p-2 truncate max-w-[160px]">{r.recipient}</td>
                      <td className="p-2">{r.attempts}</td>
                      <td className="p-2 text-muted-foreground">{new Date(r.next_run_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                  {queue.data?.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No items in queue</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Logs</CardTitle></CardHeader>
            <CardContent className="max-h-[500px] overflow-auto space-y-2 text-xs font-mono">
              {(logs.data ?? []).map((l) => (
                <div key={l.id} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleTimeString()}</span>
                  <Badge variant={l.level === "warn" ? "destructive" : "secondary"} className="text-[10px]">{l.level}</Badge>
                  <span className="truncate">{l.message}</span>
                </div>
              ))}
              {logs.data?.length === 0 && (
                <div className="text-muted-foreground text-center py-4">No logs yet</div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AppShell>
  );
}
