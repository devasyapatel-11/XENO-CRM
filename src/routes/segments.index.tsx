import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Layers, Users as UsersIcon } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { num, relativeDate } from "@/lib/crm/format";

export const Route = createFileRoute("/segments/")({ component: SegmentsList });

function SegmentsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["segments"],
    queryFn: async () => (await supabase.from("segments").select("*").order("updated_at", { ascending: false })).data ?? [],
  });

  return (
    <AppShell title="Audience Segments" actions={<Button size="sm" asChild><Link to="/segments/new"><Plus className="mr-1.5 h-3.5 w-3.5" />New Segment</Link></Button>}>
      <PageContainer>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Segments</h2>
          <p className="text-sm text-muted-foreground">Create dynamic customer segments — build with rules or describe in natural language.</p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-xl border bg-card animate-pulse" />)}</div>
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon={Layers} title="No segments yet" description="Create your first segment to start targeting customers." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data ?? []).map((s) => (
              <Link key={s.id} to="/segments/$id" params={{ id: s.id }} className="group rounded-xl border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition">
                <div className="flex items-start justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Layers className="h-4 w-4" /></div>
                  <span className="text-xs text-muted-foreground">{relativeDate(s.updated_at)}</span>
                </div>
                <h3 className="mt-4 font-semibold group-hover:text-primary transition">{s.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description ?? "No description"}</p>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{num(s.audience_size)}</span>
                  <span className="text-muted-foreground">customers</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
