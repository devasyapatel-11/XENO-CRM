// Campaign detail page — shows live metrics, communication progress,
// and per-message delivery timeline as simulator callbacks arrive.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, ChannelBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inrFull, num, pct, relativeDate } from "@/lib/crm/format";
import { useServerFn } from "@tanstack/react-start";
import { tickSimulator } from "@/lib/comms/dispatch.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/campaigns/$id")({ component: CampaignDetail });

const EVENT_COLORS: Record<string, string> = {
  PENDING:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SENT:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  DELIVERED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  OPENED:    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  READ:      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  CLICKED:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  CONVERTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function CampaignDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const tick = useServerFn(tickSimulator);

  const tickM = useMutation({
    mutationFn: () => tick(),
    onSuccess: (r) => {
      toast.success(`Tick: processed ${r.processed}, emitted ${r.emitted}`);
      qc.invalidateQueries({ queryKey: ["campaign-detail", id] });
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["campaign-detail", id],
    queryFn: async () => {
      const [camp, comms] = await Promise.all([
        supabase
          .from("campaigns")
          .select("*, campaign_metrics(*), segments(name,audience_size)")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("communications")
          .select("id,state,channel,recipient,last_event_at,customers(name)")
          .eq("campaign_id", id)
          .order("last_event_at", { ascending: false })
          .limit(100),
      ]);
      return { campaign: camp.data, comms: comms.data ?? [] };
    },
    // Poll every 4s while campaign is Sending so metrics update live
    refetchInterval: (q) => {
      const s = q.state.data?.campaign?.status;
      return s === "Sending" ? 4000 : false;
    },
  });

  if (isLoading || !data?.campaign) {
    return (
      <AppShell title="Campaign">
        <PageContainer>
          <div className="h-40 rounded-xl border animate-pulse bg-card" />
        </PageContainer>
      </AppShell>
    );
  }

  const c = data.campaign;
  const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
  const cr = m && m.sent > 0 ? (m.converted / m.sent) * 100 : 0;
  const deliverRate = m && m.sent > 0 ? (m.delivered / m.sent) * 100 : 0;
  const openRate = m && m.delivered > 0 ? (m.opened / m.delivered) * 100 : 0;

  // Aggregate communication states for funnel bar
  const stateCounts = data.comms.reduce<Record<string, number>>((acc, c) => {
    acc[c.state] = (acc[c.state] ?? 0) + 1;
    return acc;
  }, {});
  const totalComms = data.comms.length;

  return (
    <AppShell
      title={c.name}
      actions={
        <div className="flex gap-2">
          {c.status === "Sending" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => tickM.mutate()}
              disabled={tickM.isPending}
            >
              {tickM.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Advance simulator
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/campaigns">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back
            </Link>
          </Button>
        </div>
      }
    >
      <PageContainer>
        {/* Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-semibold tracking-tight">{c.name}</h2>
                  <StatusBadge status={c.status} />
                  <ChannelBadge channel={c.channel} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{c.goal}</p>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  {c.segments && (
                    <span>
                      Segment: <span className="font-medium text-foreground">{c.segments.name}</span>
                    </span>
                  )}
                  {c.sent_at && (
                    <span>
                      Sent: <span className="font-medium text-foreground">{relativeDate(c.sent_at)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI tiles */}
        {m && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Sent",      value: num(m.sent),          sub: null },
              { label: "Delivered", value: num(m.delivered),     sub: pct(deliverRate) },
              { label: "Failed",    value: num(m.failed),        sub: null },
              { label: "Opened",    value: num(m.opened),        sub: pct(openRate) },
              { label: "Clicked",   value: num(m.clicked),       sub: null },
              { label: "Converted", value: num(m.converted),     sub: pct(cr) },
              { label: "Revenue",   value: inrFull(m.revenue),   sub: null },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
                <div className="text-xl font-semibold mt-1">{value}</div>
                {sub && <div className="text-xs text-emerald-600 mt-0.5">{sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* State distribution — only when there are real comms */}
        {totalComms > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Delivery pipeline ({totalComms} messages
                {c.status === "Sending" && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    live
                  </span>
                )}
                )
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap mb-4">
                {["PENDING","SENT","DELIVERED","OPENED","READ","CLICKED","CONVERTED","FAILED"].map((s) => {
                  const count = stateCounts[s] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${EVENT_COLORS[s] ?? ""}`}>
                      {s} · {count}
                    </div>
                  );
                })}
              </div>

              {/* Visual funnel bar */}
              {totalComms > 0 && (
                <div className="space-y-1.5">
                  {["SENT","DELIVERED","OPENED","CLICKED","CONVERTED"].map((s) => {
                    const count = stateCounts[s] ?? 0;
                    const pctVal = totalComms > 0 ? (count / totalComms) * 100 : 0;
                    return (
                      <div key={s} className="flex items-center gap-3 text-xs">
                        <div className="w-20 text-muted-foreground">{s}</div>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded-full transition-all duration-500"
                            style={{ width: `${pctVal}%` }}
                          />
                        </div>
                        <div className="w-16 text-right font-medium">{num(count)} <span className="text-muted-foreground">({pct(pctVal)})</span></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Message content */}
        {c.message_content && (
          <Card>
            <CardHeader><CardTitle className="text-base">Message</CardTitle></CardHeader>
            <CardContent>
              {c.subject && (
                <div className="text-xs text-muted-foreground mb-1">Subject</div>
              )}
              {c.subject && (
                <div className="font-medium mb-3">{c.subject}</div>
              )}
              <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">{c.message_content}</div>
            </CardContent>
          </Card>
        )}

        {/* Communications table */}
        {totalComms > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Individual communications (latest {data.comms.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-medium">Customer</th>
                      <th className="text-left px-5 py-2.5 font-medium">Recipient</th>
                      <th className="text-left px-5 py-2.5 font-medium">State</th>
                      <th className="text-left px-5 py-2.5 font-medium">Last event</th>
                      <th className="text-left px-5 py-2.5 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.comms.map((comm) => {
                      const customer = comm.customers as { name: string } | null;
                      return (
                        <tr key={comm.id} className="border-t hover:bg-muted/20">
                          <td className="px-5 py-2.5 font-medium">{customer?.name ?? "—"}</td>
                          <td className="px-5 py-2.5 text-muted-foreground truncate max-w-[180px]">{comm.recipient}</td>
                          <td className="px-5 py-2.5">
                            <Badge className={`text-xs ${EVENT_COLORS[comm.state] ?? ""}`}>
                              {comm.state}
                            </Badge>
                          </td>
                          <td className="px-5 py-2.5 text-muted-foreground text-xs">
                            {comm.last_event_at ? relativeDate(comm.last_event_at) : "—"}
                          </td>
                          <td className="px-5 py-2.5">
                            <Link
                              to="/communications/$id"
                              params={{ id: comm.id }}
                              className="text-xs text-primary hover:underline"
                            >
                              Timeline →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </AppShell>
  );
}
