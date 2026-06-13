import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MapPin, Sparkles } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { inrFull, relativeDate, initials, num } from "@/lib/crm/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customers/$id")({ component: CustomerDetail });

function CustomerDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const [c, o] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).maybeSingle(),
        supabase.from("orders").select("*").eq("customer_id", id).order("order_date", { ascending: false }),
      ]);
      return { customer: c.data, orders: o.data ?? [] };
    },
  });

  if (isLoading || !data) return <AppShell title="Customer"><PageContainer><div className="h-40 rounded-xl border animate-pulse bg-card" /></PageContainer></AppShell>;
  if (!data.customer) return <AppShell title="Customer"><PageContainer><div className="text-sm text-muted-foreground">Customer not found.</div></PageContainer></AppShell>;

  const c = data.customer;
  const totalOrders = data.orders.length;
  const lifetimeRevenue = data.orders.filter((o) => o.payment_status === "Paid").reduce((s, o) => s + Number(o.amount), 0);

  return (
    <AppShell title="Customer Profile" actions={<Button variant="ghost" size="sm" asChild><Link to="/customers"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back</Link></Button>}>
      <PageContainer>
        <div className="rounded-xl border bg-card p-6 flex flex-col md:flex-row gap-6">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/80 to-chart-5/70 grid place-items-center text-primary-foreground text-lg font-semibold shrink-0">
            {initials(c.name)}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{c.name}</h2>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</span>
              {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</span>}
              {c.city && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{c.city}</span>}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total Spend" value={inrFull(c.total_spend)} />
              <Stat label="Lifetime Value" value={inrFull(c.clv)} />
              <Stat label="Orders" value={num(totalOrders)} />
              <Stat label="Last Purchase" value={relativeDate(c.last_purchase_date)} />
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders ({totalOrders})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="ai">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="rounded-xl border bg-card p-5">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Purchase Summary</h3>
                <dl className="text-sm space-y-2">
                  <Row label="Lifetime Revenue" value={inrFull(lifetimeRevenue)} />
                  <Row label="Avg Order Value" value={inrFull(totalOrders ? lifetimeRevenue / totalOrders : 0)} />
                  <Row label="Member since" value={new Date(c.created_at).toLocaleDateString()} />
                </dl>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-3">Engagement</h3>
                <dl className="text-sm space-y-2">
                  <Row label="Email" value="Subscribed" />
                  <Row label="WhatsApp" value="Opted in" />
                  <Row label="SMS" value="Subscribed" />
                </dl>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/30">
                <tr><th className="text-left font-medium px-5 py-2.5">Order</th><th className="text-left font-medium px-5 py-2.5">Product</th><th className="text-left font-medium px-5 py-2.5">Category</th><th className="text-right font-medium px-5 py-2.5">Amount</th><th className="text-left font-medium px-5 py-2.5">Status</th><th className="text-left font-medium px-5 py-2.5">Date</th></tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-5 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="px-5 py-3">{o.product_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{o.category}</td>
                    <td className="px-5 py-3 text-right font-medium">{inrFull(o.amount)}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.payment_status} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(o.order_date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {data.orders.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No orders yet.</td></tr>}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="activity" className="rounded-xl border bg-card p-5">
            <ol className="relative border-l border-border pl-6 space-y-5">
              {data.orders.slice(0, 5).map((o) => (
                <li key={o.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />
                  <p className="text-sm font-medium">Purchased {o.product_name}</p>
                  <p className="text-xs text-muted-foreground">{inrFull(o.amount)} • {new Date(o.order_date).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          </TabsContent>

          <TabsContent value="ai" className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-2 text-sm">
                <p><strong>Recommended action:</strong> Send a personalized re-engagement email featuring products in their top category.</p>
                <p><strong>Predicted next purchase:</strong> within 14 days, ~{inrFull(c.total_spend / Math.max(totalOrders, 1))}.</p>
                <p><strong>Suggested channel:</strong> WhatsApp — historically highest open rate for this profile.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AppShell>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div><div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div><div className="text-lg font-semibold mt-0.5">{value}</div></div>
);
const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between border-b border-dashed pb-1.5"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>
);
