import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateRecommendations } from "@/lib/ai/recommendations.functions";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Users, Megaphone, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { inrFull } from "@/lib/crm/format";

export const Route = createFileRoute("/insights")({ component: InsightsPage });

const KIND_META: Record<string, { icon: typeof Sparkles; color: string; label: string }> = {
  audience: { icon: Users, color: "bg-blue-100 text-blue-700", label: "Audience" },
  channel: { icon: Megaphone, color: "bg-purple-100 text-purple-700", label: "Channel" },
  campaign: { icon: Sparkles, color: "bg-amber-100 text-amber-700", label: "Campaign" },
  revenue: { icon: TrendingUp, color: "bg-emerald-100 text-emerald-700", label: "Revenue" },
};

function InsightsPage() {
  const qc = useQueryClient();
  const recs = useQuery({
    queryKey: ["ai", "recs"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_recommendations").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const gen = useServerFn(generateRecommendations);
  const m = useMutation({
    mutationFn: () => gen(),
    onSuccess: () => { toast.success("AI strategist refreshed your insights"); qc.invalidateQueries({ queryKey: ["ai", "recs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalImpact = (recs.data ?? []).reduce((a, r) => a + Number(r.impact_estimate ?? 0), 0);

  return (
    <AppShell
      title="AI Insights"
      actions={
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {recs.data?.length ? "Regenerate" : "Generate insights"}
        </Button>
      }
    >
      <PageContainer>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total opportunity surfaced</p>
              <p className="text-3xl font-semibold tracking-tight">{inrFull(totalImpact)}</p>
            </div>
            <div className="text-sm text-muted-foreground">{recs.data?.length ?? 0} recommendations</div>
          </CardContent>
        </Card>

        {recs.data?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
              <p className="font-medium text-foreground mb-1">Ask the AI strategist for recommendations</p>
              <p className="text-sm">Gemini-3 will analyse customers, orders, and campaign history and surface actionable plays.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(recs.data ?? []).map((r) => {
            const meta = KIND_META[r.kind] ?? KIND_META.campaign;
            const Icon = meta.icon;
            return (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${meta.color}`}><Icon className="h-4 w-4" /></div>
                      <Badge variant="secondary" className="text-[10px]">{meta.label}</Badge>
                    </div>
                    {r.impact_estimate ? <span className="text-sm font-semibold text-emerald-600">{inrFull(Number(r.impact_estimate))}</span> : null}
                  </div>
                  <CardTitle className="text-base mt-2">{r.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{r.summary}</p>
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground border-l-2 border-primary">
                    <div className="flex items-center gap-1 mb-1 font-medium text-foreground"><AlertTriangle className="h-3 w-3" /> Reasoning</div>
                    {r.reasoning}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContainer>
    </AppShell>
  );
}
