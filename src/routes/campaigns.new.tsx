import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, ChevronRight, Loader2, Send, Mail, MessageSquare, Smartphone } from "lucide-react";
import { z } from "zod";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateCampaignContent } from "@/lib/ai.functions";
import { dispatchCampaign } from "@/lib/comms/dispatch.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { num } from "@/lib/crm/format";

const search = z.object({ segmentId: z.string().optional() });

export const Route = createFileRoute("/campaigns/new")({
  validateSearch: (s) => search.parse(s),
  component: NewCampaign,
});

const STEPS = ["Details", "Audience", "Content", "Channel", "Review"] as const;
type Channel = "Email" | "SMS" | "WhatsApp" | "RCS";
const CHANNEL_ICONS = { Email: Mail, SMS: Smartphone, WhatsApp: MessageSquare, RCS: MessageSquare };

function NewCampaign() {
  const { segmentId: initialSegment } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [segmentId, setSegmentId] = useState<string>(initialSegment ?? "");
  const [channel, setChannel] = useState<Channel>("Email");
  const [tone, setTone] = useState("friendly, premium");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const gen = useServerFn(generateCampaignContent);
  const dispatch = useServerFn(dispatchCampaign);

  const { data: segments = [] } = useQuery({
    queryKey: ["segments-pick"],
    queryFn: async () => (await supabase.from("segments").select("id,name,audience_size")).data ?? [],
  });
  const selectedSegment = segments.find((s) => s.id === segmentId);

  const runAI = async () => {
    if (!goal.trim() || !selectedSegment) { toast.error("Pick goal & audience first"); return; }
    setAiLoading(true);
    try {
      const res = await gen({ data: { goal, audience: selectedSegment.name, channel, tone } });
      if (!name) setName(res.name);
      setSubject(res.subject ?? "");
      setMessage(res.message);
    } catch (e) { toast.error(e instanceof Error ? e.message : "AI failed"); }
    finally { setAiLoading(false); }
  };

  const launch = async () => {
    setLaunching(true);
    // 1. Create the campaign row in Draft state
    const { data: c, error } = await supabase.from("campaigns").insert({
      name, goal, segment_id: segmentId || null, channel, subject: subject || null,
      message_content: message, status: "Draft",
    }).select().single();

    if (error || !c) {
      toast.error(error?.message ?? "Failed to create campaign");
      setLaunching(false);
      return;
    }

    // 2. Dispatch via the real simulator pipeline — metrics come from callbacks
    try {
      const audienceLimit = selectedSegment?.audience_size
        ? Math.min(selectedSegment.audience_size, 200)
        : 50;
      const result = await dispatch({ data: { campaign_id: c.id, audience_limit: audienceLimit } });
      toast.success(`Campaign launched — dispatched to ${result.dispatched} customers. Events will arrive shortly.`);
      navigate({ to: "/campaigns" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispatch failed");
    }
    setLaunching(false);
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <AppShell title="New Campaign">
      <PageContainer>
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition", i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                <span className="grid h-5 w-5 place-items-center rounded-full bg-background/30 text-[10px]">{i + 1}</span>{s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border bg-card p-6 min-h-[400px]">
            {step === 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Campaign details</h3>
                <div><label className="text-xs font-medium text-muted-foreground">Campaign name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali VIP Preview" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Goal</label><Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Drive repeat purchases from VIPs during Diwali week with early access." rows={3} /></div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Choose audience</h3>
                <Select value={segmentId} onValueChange={setSegmentId}>
                  <SelectTrigger><SelectValue placeholder="Pick a segment…" /></SelectTrigger>
                  <SelectContent>{segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({num(s.audience_size)})</SelectItem>)}</SelectContent>
                </Select>
                {selectedSegment && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">Estimated reach</div>
                    <div className="text-3xl font-semibold mt-1">{num(selectedSegment.audience_size)}</div>
                  </div>
                )}
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Message content</h3>
                  <Button size="sm" onClick={runAI} disabled={aiLoading}>{aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}AI Generate</Button>
                </div>
                <div className="flex gap-2">
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly, premium">Friendly &amp; Premium</SelectItem>
                      <SelectItem value="urgent, conversion">Urgent &amp; Conversion</SelectItem>
                      <SelectItem value="warm, win-back">Warm Win-back</SelectItem>
                      <SelectItem value="bold, energetic">Bold &amp; Energetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {channel === "Email" && <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />}
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} placeholder={`Write your ${channel} message. Use {{name}} for personalization.`} />
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Choose channel</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(["Email", "WhatsApp", "SMS", "RCS"] as const).map((c) => {
                    const Icon = CHANNEL_ICONS[c];
                    return (
                      <button key={c} onClick={() => setChannel(c)} className={cn("rounded-lg border p-4 text-left transition", channel === c ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/30")}>
                        <Icon className="h-5 w-5 text-primary" />
                        <div className="mt-2 font-medium">{c}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{c === "Email" ? "Long-form with subject" : c === "SMS" ? "160 char limit" : c === "WhatsApp" ? "Rich, conversational" : "Rich, branded"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Review &amp; launch</h3>
                <Row label="Name" value={name || "—"} />
                <Row label="Goal" value={goal || "—"} />
                <Row label="Channel" value={channel} />
                <Row label="Audience" value={selectedSegment ? `${selectedSegment.name} (${num(selectedSegment.audience_size)})` : "—"} />
                {subject && <Row label="Subject" value={subject} />}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Message</div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{message || "—"}</div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 mt-6 border-t">
              <Button variant="outline" onClick={back} disabled={step === 0}>Back</Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={next}>Continue<ChevronRight className="h-3.5 w-3.5 ml-1.5" /></Button>
              ) : (
                <Button onClick={launch} disabled={launching || !name || !message}><Send className="h-3.5 w-3.5 mr-1.5" />{launching ? "Launching…" : "Launch Campaign"}</Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h4 className="text-sm font-semibold mb-3">Live Preview</h4>
            <div className="rounded-xl border bg-gradient-to-br from-muted/30 to-background p-4 text-sm space-y-2">
              <div className="text-xs text-muted-foreground uppercase">{channel}</div>
              {channel === "Email" && <div className="font-medium">{subject || "Your subject line"}</div>}
              <div className="whitespace-pre-wrap text-sm">{message || "Your message will appear here. Click AI Generate to draft it."}</div>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-4 text-sm"><div className="w-24 text-muted-foreground">{label}</div><div className="font-medium flex-1">{value}</div></div>
);
