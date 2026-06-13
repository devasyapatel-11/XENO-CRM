import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, IndianRupee, Megaphone, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Legend,
} from "recharts";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge, ChannelBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { inrFull, num, pct, relativeDate } from "@/lib/crm/format";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Dashboard });

async function fetchDashboard() {
  const [customers, orders, campaigns] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("orders").select("*").order("order_date", { ascending: false }),
    supabase.from("campaigns").select("*, campaign_metrics(*), segments(name)").order("created_at", { ascending: false }),
  ]);
  return {
    customers: customers.data ?? [],
    orders: orders.data ?? [],
    campaigns: campaigns.data ?? [],
  };
}

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  if (isLoading || !data) return <AppShell title="Dashboard"><PageContainer><DashboardSkeleton /></PageContainer></AppShell>;

  const { customers, orders, campaigns } = data;
  const totalRevenue = orders.filter((o) => o.payment_status === "Paid").reduce((s, o) => s + Number(o.amount), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "Sent" || c.status === "Sending" || c.status === "Scheduled").length;
  const churnRisk = customers.filter((c) => c.status === "Churn Risk").length;
  const metricsAgg = campaigns.reduce(
    (acc, c) => {
      const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
      if (m) { acc.sent += m.sent; acc.converted += m.converted; }
      return acc;
    },
    { sent: 0, converted: 0 },
  );
  const conversionRate = metricsAgg.sent > 0 ? (metricsAgg.converted / metricsAgg.sent) * 100 : 0;

  // Revenue trend (last 30 days)
  const trend = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(); day.setDate(day.getDate() - (13 - i));
    const label = day.toLocaleDateString("en", { month: "short", day: "numeric" });
    const dayKey = day.toISOString().slice(0, 10);
    const rev = orders.filter((o) => o.payment_status === "Paid" && o.order_date.startsWith(dayKey)).reduce((s, o) => s + Number(o.amount), 0);
    return { label, revenue: Math.round(rev) };
  });

  const byCategory = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.category] = (acc[o.category] ?? 0) + Number(o.amount);
      return acc;
    }, {}),
  ).map(([category, revenue]) => ({ category, revenue: Math.round(revenue) }));

  return (
    <AppShell title="Dashboard" actions={<Button asChild size="sm"><Link to="/campaigns/new"><Megaphone className="mr-1.5 h-3.5 w-3.5" />New Campaign</Link></Button>}>
      <PageContainer>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back 👋</h2>
          <p className="text-sm text-muted-foreground">Here's what's happening across your CRM today.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="Total Customers" value={num(customers.length)} delta={8.4} icon={Users} />
          <KpiCard label="Total Revenue" value={inrFull(totalRevenue)} delta={12.7} icon={IndianRupee} tone="success" />
          <KpiCard label="Active Campaigns" value={num(activeCampaigns)} delta={3.1} icon={Megaphone} />
          <KpiCard label="Conversion Rate" value={pct(conversionRate)} delta={1.2} icon={TrendingUp} tone="success" />
          <KpiCard label="Churn Risk" value={num(churnRisk)} delta={-4.5} icon={AlertTriangle} tone="warning" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Revenue Trend</h3>
                <p className="text-xs text-muted-foreground">Last 14 days</p>
              </div>
              <span className="text-xs text-muted-foreground">Paid orders only</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Revenue by Category</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={70} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="revenue" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Recent Campaigns</h3>
              <Button variant="ghost" size="sm" asChild><Link to="/campaigns">View all</Link></Button>
            </div>
            <div className="space-y-2">
              {campaigns.slice(0, 5).map((c) => {
                const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <ChannelBadge channel={c.channel} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.goal ?? "—"}</p>
                    </div>
                    {m && (
                      <div className="hidden sm:flex items-center gap-6 text-xs">
                        <div><div className="text-muted-foreground">Sent</div><div className="font-medium">{num(m.sent)}</div></div>
                        <div><div className="text-muted-foreground">Opened</div><div className="font-medium">{num(m.opened)}</div></div>
                        <div><div className="text-muted-foreground">Revenue</div><div className="font-medium">{inrFull(m.revenue)}</div></div>
                      </div>
                    )}
                    <StatusBadge status={c.status} />
                  </div>
                );
              })}
              {campaigns.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No campaigns yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">AI Recommendations</h3></div>
            <p className="text-xs text-muted-foreground mt-1">Based on recent customer signals</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="rounded-lg border bg-background p-3">
                <p className="font-medium">Launch a win-back campaign</p>
                <p className="text-xs text-muted-foreground mt-1">{churnRisk} customers showing churn risk. WhatsApp + 15% off is high impact.</p>
              </li>
              <li className="rounded-lg border bg-background p-3">
                <p className="font-medium">Reward your top spenders</p>
                <p className="text-xs text-muted-foreground mt-1">VIPs from Mumbai &amp; Hyderabad drove 38% of revenue last 30 days.</p>
              </li>
              <li className="rounded-lg border bg-background p-3">
                <p className="font-medium">Cross-sell Beauty to Apparel buyers</p>
                <p className="text-xs text-muted-foreground mt-1">High overlap detected in last 60 days of orders.</p>
              </li>
            </ul>
            <Button variant="link" size="sm" className="mt-2 px-0" asChild><Link to="/copilot">Open AI Copilot →</Link></Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between p-5 pb-3">
            <h3 className="text-sm font-semibold">Latest Orders</h3>
            <Button variant="ghost" size="sm" asChild><Link to="/orders">View all</Link></Button>
          </div>
          <div className="border-t">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/30">
                <tr><th className="text-left font-medium px-5 py-2.5">Order</th><th className="text-left font-medium px-5 py-2.5">Customer</th><th className="text-left font-medium px-5 py-2.5">Category</th><th className="text-right font-medium px-5 py-2.5">Amount</th><th className="text-left font-medium px-5 py-2.5">Status</th><th className="text-left font-medium px-5 py-2.5">Date</th></tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((o) => {
                  const cust = customers.find((c) => c.id === o.customer_id);
                  return (
                    <tr key={o.id} className="border-t hover:bg-muted/30">
                      <td className="px-5 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                      <td className="px-5 py-3">{cust?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{o.category}</td>
                      <td className="px-5 py-3 text-right font-medium">{inrFull(o.amount)}</td>
                      <td className="px-5 py-3"><StatusBadge status={o.payment_status} /></td>
                      <td className="px-5 py-3 text-muted-foreground">{relativeDate(o.order_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 rounded-xl border bg-card animate-pulse" />)}</div>
      <div className="h-72 rounded-xl border bg-card animate-pulse" />
    </div>
  );
}
