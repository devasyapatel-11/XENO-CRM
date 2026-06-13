import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Megaphone } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { StatusBadge, ChannelBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { num, inrFull, pct, relativeDate } from "@/lib/crm/format";

export const Route = createFileRoute("/campaigns/")({ component: CampaignsList });

function CampaignsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns-list"],
    queryFn: async () => (await supabase.from("campaigns").select("*, campaign_metrics(*), segments(name)").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <AppShell title="Campaigns" actions={<Button size="sm" asChild><Link to="/campaigns/new"><Plus className="mr-1.5 h-3.5 w-3.5" />New Campaign</Link></Button>}>
      <PageContainer>
        {isLoading ? <div className="h-64 rounded-xl border animate-pulse bg-card" /> :
          (data ?? []).length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns yet" description="Launch your first AI-powered campaign in under a minute." action={{ label: "New Campaign", onClick: () => location.href = "/campaigns/new" }} />
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="text-left font-medium px-5 py-2.5">Campaign</th>
                    <th className="text-left font-medium px-5 py-2.5">Channel</th>
                    <th className="text-left font-medium px-5 py-2.5">Segment</th>
                    <th className="text-right font-medium px-5 py-2.5">Sent</th>
                    <th className="text-right font-medium px-5 py-2.5">Opened</th>
                    <th className="text-right font-medium px-5 py-2.5">Conv. Rate</th>
                    <th className="text-right font-medium px-5 py-2.5">Revenue</th>
                    <th className="text-left font-medium px-5 py-2.5">Status</th>
                    <th className="text-left font-medium px-5 py-2.5">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((c) => {
                    const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
                    const cr = m && m.sent > 0 ? (m.converted / m.sent) * 100 : 0;
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <Link to="/campaigns/$id" params={{ id: c.id }} className="font-medium hover:text-primary">{c.name}</Link>
                          <div className="text-xs text-muted-foreground truncate max-w-xs">{c.goal}</div>
                        </td>
                        <td className="px-5 py-3"><ChannelBadge channel={c.channel} /></td>
                        <td className="px-5 py-3 text-muted-foreground">{c.segments?.name ?? "—"}</td>
                        <td className="px-5 py-3 text-right">{m ? num(m.sent) : "—"}</td>
                        <td className="px-5 py-3 text-right">{m ? num(m.opened) : "—"}</td>
                        <td className="px-5 py-3 text-right">{m ? pct(cr) : "—"}</td>
                        <td className="px-5 py-3 text-right font-medium">{m ? inrFull(m.revenue) : "—"}</td>
                        <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">{relativeDate(c.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </PageContainer>
    </AppShell>
  );
}
