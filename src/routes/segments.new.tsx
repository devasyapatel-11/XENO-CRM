import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Sparkles, Plus, Trash2, Save, Users as UsersIcon, Loader2 } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FIELDS, OPERATORS_BY_TYPE, emptyRules, evaluateRules, type Condition, type SegmentRules } from "@/lib/crm/segment";
import { useServerFn } from "@tanstack/react-start";
import { generateSegmentRules } from "@/lib/ai.functions";
import { toast } from "sonner";
import { num, inrFull } from "@/lib/crm/format";

export const Route = createFileRoute("/segments/new")({ component: SegmentBuilder });

function SegmentBuilder() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<SegmentRules>(emptyRules());
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const generate = useServerFn(generateSegmentRules);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-with-orders"],
    queryFn: async () => (await supabase.from("customers").select("*, orders(*)")).data ?? [],
  });

  const matched = useMemo(() => customers.filter((c) => evaluateRules(rules, c)), [customers, rules]);

  const addCondition = () => setRules((r) => ({ ...r, conditions: [...r.conditions, { field: "total_spend", operator: ">", value: 0 }] }));
  const removeCondition = (i: number) => setRules((r) => ({ ...r, conditions: r.conditions.filter((_, idx) => idx !== i) }));
  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setRules((r) => ({ ...r, conditions: r.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));

  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await generate({ data: { prompt: aiPrompt } });
      setRules(res.rules as SegmentRules);
      toast.success("AI generated your segment rules");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally { setAiLoading(false); }
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("segments").insert({ name, description, rules: rules as never, audience_size: matched.length }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Segment saved");
    navigate({ to: "/segments/$id", params: { id: data.id } });
  };

  return (
    <AppShell title="New Segment">
      <PageContainer>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name (e.g. High Value VIPs)" className="text-lg font-semibold border-0 px-0 focus-visible:ring-0" />
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this segment…" className="border-0 px-0 resize-none focus-visible:ring-0" rows={2} />
            </div>

            <div className="rounded-xl border bg-gradient-to-br from-primary/8 via-card to-card p-5 space-y-3">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">AI Segment Builder</h3></div>
              <p className="text-xs text-muted-foreground">Describe your audience in plain English. E.g. <em>"Inactive customers from Mumbai who spent over ₹5000."</em></p>
              <div className="flex gap-2">
                <Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Customers who spent over ₹5000 and haven't purchased in 30 days…" onKeyDown={(e) => e.key === "Enter" && runAI()} />
                <Button onClick={runAI} disabled={aiLoading}>{aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}{aiLoading ? "Generating…" : "Generate"}</Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Rules</h3>
                <Select value={rules.op} onValueChange={(v) => setRules((r) => ({ ...r, op: v as "AND" | "OR" }))}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="AND">Match ALL</SelectItem><SelectItem value="OR">Match ANY</SelectItem></SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {rules.conditions.map((cond, i) => {
                  const field = FIELDS.find((f) => f.value === cond.field)!;
                  const ops = OPERATORS_BY_TYPE[field.type];
                  return (
                    <div key={i} className="flex flex-wrap gap-2 items-center rounded-lg border bg-muted/30 p-2">
                      {i > 0 && <span className="text-xs font-mono text-muted-foreground px-2">{rules.op}</span>}
                      <Select value={cond.field} onValueChange={(v) => updateCondition(i, { field: v as Condition["field"], value: "" })}>
                        <SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={cond.operator} onValueChange={(v) => updateCondition(i, { operator: v as Condition["operator"] })}>
                        <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{ops.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                      </Select>
                      {field.type === "enum" ? (
                        <Select value={String(cond.value)} onValueChange={(v) => updateCondition(i, { value: v })}>
                          <SelectTrigger className="flex-1 h-9 min-w-32"><SelectValue placeholder="Choose…" /></SelectTrigger>
                          <SelectContent>{field.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input type={field.type === "number" ? "number" : "text"} value={cond.value} onChange={(e) => updateCondition(i, { value: field.type === "number" ? Number(e.target.value) : e.target.value })} className="flex-1 h-9 min-w-32" placeholder="Value" />
                      )}
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeCondition(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                })}
                {rules.conditions.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-lg">No conditions yet. Add one below or use AI.</div>
                )}
                <Button variant="outline" size="sm" onClick={addCondition}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Condition</Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5 sticky top-6">
              <div className="flex items-center gap-2 mb-4"><UsersIcon className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Live Preview</h3></div>
              <div className="text-4xl font-semibold tracking-tight">{num(matched.length)}</div>
              <div className="text-xs text-muted-foreground mt-1">of {num(customers.length)} customers match</div>
              <div className="my-4 h-px bg-border" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Total spend</dt><dd className="font-medium">{inrFull(matched.reduce((s, c) => s + Number(c.total_spend), 0))}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Avg CLV</dt><dd className="font-medium">{inrFull(matched.length ? matched.reduce((s, c) => s + Number(c.clv), 0) / matched.length : 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Churn risk</dt><dd className="font-medium">{matched.filter((c) => c.status === "Churn Risk").length}</dd></div>
              </dl>
              <Button onClick={save} disabled={saving} className="w-full mt-4"><Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Saving…" : "Save Segment"}</Button>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <h4 className="text-sm font-semibold mb-3">Sample Matches</h4>
              <ul className="space-y-2 text-sm">
                {matched.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex justify-between border-b border-dashed pb-1.5 last:border-0">
                    <span className="truncate">{c.name}</span>
                    <span className="text-muted-foreground text-xs">{c.city}</span>
                  </li>
                ))}
                {matched.length === 0 && <li className="text-xs text-muted-foreground">No matches</li>}
              </ul>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
