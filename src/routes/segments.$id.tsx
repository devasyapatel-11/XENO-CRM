import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Megaphone, Users as UsersIcon, Trash2 } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { num, inrFull, relativeDate } from "@/lib/crm/format";
import { evaluateRules, type SegmentRules } from "@/lib/crm/segment";
import { toast } from "sonner";

export const Route = createFileRoute("/segments/$id")({ component: SegmentDetail });

function SegmentDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["segment", id],
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from("segments").select("*").eq("id", id).maybeSingle(),
        supabase.from("customers").select("*, orders(*)"),
      ]);
      return { segment: s.data, customers: c.data ?? [] };
    },
  });

  if (isLoading || !data) return <AppShell title="Segment"><PageContainer><div className="h-40 rounded-xl border animate-pulse bg-card" /></PageContainer></AppShell>;
  if (!data.segment) return <AppShell title="Segment"><PageContainer>Not found</PageContainer></AppShell>;

  const s = data.segment;
  const rules = s.rules as unknown as SegmentRules;
  const matched = data.customers.filter((c) => evaluateRules(rules, c));

  const remove = async () => {
    if (!confirm("Delete this segment?")) return;
    await supabase.from("segments").delete().eq("id", id);
    toast.success("Segment deleted");
    location.href = "/segments";
  };

  return (
    <AppShell title={s.name} actions={<Button variant="ghost" size="sm" asChild><Link to="/segments"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back</Link></Button>}>
      <PageContainer>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{s.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{s.description ?? "No description"}</p>
              <p className="text-xs text-muted-foreground mt-3">Updated {relativeDate(s.updated_at)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild><Link to="/campaigns/new" search={{ segmentId: id }}><Megaphone className="mr-1.5 h-3.5 w-3.5" />Launch Campaign</Link></Button>
              <Button variant="outline" size="sm" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Stat icon={<UsersIcon className="h-4 w-4" />} label="Audience size" value={num(matched.length)} />
            <Stat label="Total spend" value={inrFull(matched.reduce((s, c) => s + Number(c.total_spend), 0))} />
            <Stat label="Avg CLV" value={inrFull(matched.length ? matched.reduce((s, c) => s + Number(c.clv), 0) / matched.length : 0)} />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Rules</h3>
          <pre className="text-xs font-mono bg-muted/40 p-3 rounded-md overflow-auto">{JSON.stringify(rules, null, 2)}</pre>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="p-5 border-b"><h3 className="text-sm font-semibold">Matching Customers ({matched.length})</h3></div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30">
              <tr><th className="text-left px-5 py-2.5 font-medium">Name</th><th className="text-left px-5 py-2.5 font-medium">City</th><th className="text-right px-5 py-2.5 font-medium">Spend</th><th className="text-right px-5 py-2.5 font-medium">CLV</th><th className="text-left px-5 py-2.5 font-medium">Status</th></tr>
            </thead>
            <tbody>
              {matched.slice(0, 20).map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-5 py-3"><Link to="/customers/$id" params={{ id: c.id }} className="font-medium hover:text-primary">{c.name}</Link></td>
                  <td className="px-5 py-3 text-muted-foreground">{c.city}</td>
                  <td className="px-5 py-3 text-right">{inrFull(c.total_spend)}</td>
                  <td className="px-5 py-3 text-right">{inrFull(c.clv)}</td>
                  <td className="px-5 py-3 text-xs">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageContainer>
    </AppShell>
  );
}

const Stat = ({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border bg-background p-4">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">{icon}{label}</div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
  </div>
);
