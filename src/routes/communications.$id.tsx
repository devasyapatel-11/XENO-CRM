import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/communications/$id")({ component: CommunicationDetail });

const EVENT_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-cyan-100 text-cyan-700",
  OPENED: "bg-purple-100 text-purple-700",
  READ: "bg-indigo-100 text-indigo-700",
  CLICKED: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};

function CommunicationDetail() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["comm", id],
    queryFn: async () => {
      const [{ data: comm }, { data: events }] = await Promise.all([
        supabase.from("communications").select("*, campaigns(name), customers(name,email)").eq("id", id).maybeSingle(),
        supabase.from("communication_events").select("*").eq("communication_id", id).order("occurred_at", { ascending: true }),
      ]);
      return { comm, events: events ?? [] };
    },
    refetchInterval: 4000,
  });
  if (!q.data?.comm) return <AppShell title="Communication"><PageContainer>Loading…</PageContainer></AppShell>;
  const c = q.data.comm;

  return (
    <AppShell title="Communication" actions={<Link to="/campaigns"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>}>
      <PageContainer>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Campaign</p>
                <CardTitle>{(c as never as { campaigns: { name: string } | null }).campaigns?.name ?? "—"}</CardTitle>
              </div>
              <Badge className={EVENT_COLORS[c.state] ?? ""}>{c.state}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Channel</p><p className="font-medium">{c.channel}</p></div>
            <div><p className="text-xs text-muted-foreground">Recipient</p><p className="font-medium truncate">{c.recipient}</p></div>
            <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{(c as never as { customers: { name: string } | null }).customers?.name ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(c.created_at).toLocaleString()}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Message</CardTitle></CardHeader>
          <CardContent><div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">{c.message}</div></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Event timeline ({q.data.events.length})</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {q.data.events.map((e, i) => (
                <li key={e.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full ring-4 ring-background ${EVENT_COLORS[e.event_type]?.split(" ")[0] ?? "bg-primary"}`} />
                    {i < q.data.events.length - 1 && <div className="w-px h-12 bg-border" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={EVENT_COLORS[e.event_type] ?? ""}>{e.event_type}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(e.occurred_at).toLocaleString()}</span>
                    </div>
                  </div>
                </li>
              ))}
              {q.data.events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
            </ol>
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
