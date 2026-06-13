import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { ChannelBadge } from "@/components/StatusBadge";
import { inrFull, num, pct } from "@/lib/crm/format";

export const Route = createFileRoute("/analytics")({ component: Analytics });

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function Analytics() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [campaigns, orders, customers] = await Promise.all([
        supabase.from("campaigns").select("*, campaign_metrics(*)"),
        supabase.from("orders").select("*"),
        supabase.from("customers").select("city,status"),
      ]);
      return { campaigns: campaigns.data ?? [], orders: orders.data ?? [], customers: customers.data ?? [] };
    },
  });

  if (!data) return <AppShell title="Analytics"><PageContainer><div className="h-72 rounded-xl border animate-pulse bg-card" /></PageContainer></AppShell>;

  const totals = data.campaigns.reduce((acc, c) => {
    const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
    if (m) { acc.sent += m.sent; acc.delivered += m.delivered; acc.opened += m.opened; acc.clicked += m.clicked; acc.converted += m.converted; acc.revenue += Number(m.revenue); }
    return acc;
  }, { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 });

  const funnel = [
    { stage: "Sent", value: totals.sent },
    { stage: "Delivered", value: totals.delivered },
    { stage: "Opened", value: totals.opened },
    { stage: "Clicked", value: totals.clicked },
    { stage: "Converted", value: totals.converted },
  ];

  const byChannel = Object.entries(
    data.campaigns.reduce<Record<string, { sent: number; converted: number; revenue: number }>>((acc, c) => {
      const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
      if (!m) return acc;
      acc[c.channel] = acc[c.channel] ?? { sent: 0, converted: 0, revenue: 0 };
      acc[c.channel].sent += m.sent;
      acc[c.channel].converted += m.converted;
      acc[c.channel].revenue += Number(m.revenue);
      return acc;
    }, {}),
  ).map(([channel, v]) => ({ channel, ...v }));

  const byCity = Object.entries(
    data.customers.reduce<Record<string, number>>((acc, c) => { if (c.city) acc[c.city] = (acc[c.city] ?? 0) + 1; return acc; }, {}),
  ).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const orderTrend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    const k = d.toISOString().slice(0, 10);
    const rev = data.orders.filter((o) => o.payment_status === "Paid" && o.order_date.startsWith(k)).reduce((s, o) => s + Number(o.amount), 0);
    return { day: d.getDate().toString(), revenue: Math.round(rev) };
  });

  const leaderboard = [...data.campaigns]
    .map((c) => {
      const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
      return { ...c, m };
    })
    .filter((c) => c.m)
    .sort((a, b) => Number(b.m!.revenue) - Number(a.m!.revenue));

  return (
    <AppShell title="Analytics">
      <PageContainer>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Tile label="Sent" value={num(totals.sent)} />
          <Tile label="Delivered" value={num(totals.delivered)} />
          <Tile label="Opened" value={num(totals.opened)} />
          <Tile label="Clicked" value={num(totals.clicked)} />
          <Tile label="Converted" value={num(totals.converted)} />
          <Tile label="Revenue" value={inrFull(totals.revenue)} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Campaign Funnel">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Channel Performance">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byChannel}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sent" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="converted" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Revenue (Last 30 days)">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={orderTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Customers by City">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byCity} dataKey="count" nameKey="city" outerRadius={90} label={(e) => e.city}>
                  {byCity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <Panel title="Campaign Leaderboard">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30">
              <tr><th className="text-left px-5 py-2.5 font-medium">#</th><th className="text-left px-5 py-2.5 font-medium">Campaign</th><th className="text-left px-5 py-2.5 font-medium">Channel</th><th className="text-right px-5 py-2.5 font-medium">Sent</th><th className="text-right px-5 py-2.5 font-medium">Conv Rate</th><th className="text-right px-5 py-2.5 font-medium">Revenue</th></tr>
            </thead>
            <tbody>
              {leaderboard.map((c, i) => (
                <tr key={c.id} className="border-t">
                  <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3"><ChannelBadge channel={c.channel} /></td>
                  <td className="px-5 py-3 text-right">{num(c.m!.sent)}</td>
                  <td className="px-5 py-3 text-right">{pct(c.m!.sent ? (c.m!.converted / c.m!.sent) * 100 : 0)}</td>
                  <td className="px-5 py-3 text-right font-medium">{inrFull(c.m!.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </PageContainer>
    </AppShell>
  );
}

const Tile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border bg-card p-4">
    <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    <div className="text-xl font-semibold mt-1">{value}</div>
  </div>
);
const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border bg-card overflow-hidden">
    <div className="px-5 py-3 border-b"><h3 className="text-sm font-semibold">{title}</h3></div>
    <div className="p-5">{children}</div>
  </div>
);
