import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Send, MessageSquare, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { relativeDate } from "@/lib/crm/format";
import { toast } from "sonner";

export const Route = createFileRoute("/copilot/$threadId")({
  component: CopilotThread,
  loader: async ({ params }) => {
    const [t, m] = await Promise.all([
      supabase.from("copilot_threads").select("*").eq("id", params.threadId).maybeSingle(),
      supabase.from("copilot_messages").select("*").eq("thread_id", params.threadId).order("created_at"),
    ]);
    return { thread: t.data, initialMessages: m.data ?? [] };
  },
});

const SUGGESTIONS = [
  "Who are my most valuable customers?",
  "Show me customers likely to churn",
  "How are my campaigns performing?",
  "Recommend a win-back campaign",
];

function CopilotThread() {
  const { threadId } = Route.useParams();
  const { thread, initialMessages } = Route.useLoaderData();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: threads = [] } = useQuery({
    queryKey: ["copilot-threads"],
    queryFn: async () => (await supabase.from("copilot_threads").select("*").order("updated_at", { ascending: false })).data ?? [],
  });

  const transport = useRef(new DefaultChatTransport({ api: "/api/chat" })).current;

  const restored: UIMessage[] = initialMessages.map((m: { id: string; message_id: string | null; role: string; parts: unknown }) => ({
    id: m.message_id ?? m.id,
    role: m.role as "user" | "assistant" | "system",
    parts: m.parts as UIMessage["parts"],
  }));

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: restored,
    transport,
    onError: (e) => toast.error(e.message),
    onFinish: async ({ message }) => {
      await supabase.from("copilot_messages").insert({ thread_id: threadId, message_id: message.id, role: "assistant", parts: message.parts as never });
      // Update thread title from first user message if still default
      if (thread?.title === "New conversation" && messages[0]) {
        const text = messages[0].parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join(" ").slice(0, 60);
        if (text) await supabase.from("copilot_threads").update({ title: text }).eq("id", threadId);
      }
      qc.invalidateQueries({ queryKey: ["copilot-threads"] });
    },
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, [threadId]);

  const submit = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || status === "submitted" || status === "streaming") return;
    setInput("");
    await supabase.from("copilot_messages").insert({ thread_id: threadId, role: "user", parts: [{ type: "text", text: t }] as never });
    await sendMessage({ text: t });
  };

  const newThread = async () => {
    const { data } = await supabase.from("copilot_threads").insert({ title: "New conversation" }).select().single();
    if (data) { qc.invalidateQueries({ queryKey: ["copilot-threads"] }); navigate({ to: "/copilot/$threadId", params: { threadId: data.id } }); }
  };

  const deleteThread = async (id: string) => {
    await supabase.from("copilot_threads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["copilot-threads"] });
    if (id === threadId) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining[0]) navigate({ to: "/copilot/$threadId", params: { threadId: remaining[0].id } });
      else navigate({ to: "/copilot" });
    }
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <AppShell title="AI Copilot">
      <div className="grid grid-cols-[260px_1fr] h-[calc(100vh-3.5rem)]">
        {/* Thread sidebar */}
        <aside className="border-r bg-card/40 flex flex-col">
          <div className="p-3 border-b">
            <Button size="sm" className="w-full" onClick={newThread}><Plus className="mr-1.5 h-3.5 w-3.5" />New conversation</Button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-0.5">
            {threads.map((t) => (
              <div key={t.id} className={cn("group flex items-center rounded-md text-sm", t.id === threadId ? "bg-accent" : "hover:bg-muted/60")}>
                <Link to="/copilot/$threadId" params={{ threadId: t.id }} className="flex-1 flex items-start gap-2 px-3 py-2 min-w-0">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{t.title}</div>
                    <div className="text-[10px] text-muted-foreground">{relativeDate(t.updated_at)}</div>
                  </div>
                </Link>
                <button onClick={() => deleteThread(t.id)} className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 hover:text-destructive transition" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {threads.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No conversations</div>}
          </div>
        </aside>

        {/* Chat */}
        <div className="flex flex-col min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-chart-5 text-primary-foreground"><Sparkles className="h-6 w-6" /></div>
                  <h2 className="mt-4 text-xl font-semibold">Hi, I'm Xeno Copilot</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Ask me anything about your customers, segments, or campaigns.</p>
                  <div className="mt-6 grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => submit(s)} className="rounded-lg border bg-card p-3 text-left text-sm hover:border-primary/50 hover:bg-accent/30 transition">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                  {m.role === "assistant" && <div className="h-7 w-7 shrink-0 rounded-md bg-gradient-to-br from-primary to-chart-5 grid place-items-center text-primary-foreground"><Sparkles className="h-3.5 w-3.5" /></div>}
                  <div className={cn("max-w-[80%]", m.role === "user" ? "rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm" : "text-sm prose prose-sm dark:prose-invert max-w-none")}>
                    {m.parts.map((part, i) => {
                      if (part.type === "text") return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
                      if (part.type.startsWith("tool-")) {
                        const tp = part as { type: string; state?: string };
                        return <div key={i} className="my-2 inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"><Loader2 className={cn("h-3 w-3", tp.state === "output-available" ? "" : "animate-spin")} />Querying {tp.type.replace("tool-", "")}…</div>;
                      }
                      return null;
                    })}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-chart-5 grid place-items-center text-primary-foreground"><Sparkles className="h-3.5 w-3.5" /></div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Thinking…</div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t bg-card/60 p-4">
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Ask Copilot about your CRM data…"
                rows={1}
                className="resize-none max-h-32"
              />
              <Button onClick={() => submit()} disabled={!input.trim() || isLoading} size="icon" className="h-10 w-10 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">Copilot uses real CRM data and may make mistakes. Verify important insights.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
