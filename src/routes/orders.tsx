import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { inrFull } from "@/lib/crm/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/orders")({ component: OrdersPage });

function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders-page"],
    queryFn: async () => {
      const [o, c] = await Promise.all([
        supabase.from("orders").select("*").order("order_date", { ascending: false }),
        supabase.from("customers").select("id,name,email"),
      ]);
      return { orders: o.data ?? [], customers: c.data ?? [] };
    },
  });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const orders = data?.orders ?? [];
  const custMap = useMemo(() => new Map((data?.customers ?? []).map((c) => [c.id, c])), [data]);
  const categories = useMemo(() => Array.from(new Set(orders.map((o) => o.category))).sort(), [orders]);

  const filtered = orders.filter((o) => {
    if (cat !== "all" && o.category !== cat) return false;
    if (q) {
      const cust = custMap.get(o.customer_id);
      const ql = q.toLowerCase();
      return o.product_name.toLowerCase().includes(ql) || (cust?.name ?? "").toLowerCase().includes(ql) || o.id.includes(ql);
    }
    return true;
  });

  const totalRevenue = filtered.filter((o) => o.payment_status === "Paid").reduce((s, o) => s + Number(o.amount), 0);

  return (
    <AppShell title="Orders" actions={<Button variant="outline" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Export CSV</Button>}>
      <PageContainer>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Total Orders" value={filtered.length.toString()} />
          <Stat label="Revenue" value={inrFull(totalRevenue)} />
          <Stat label="Avg Order Value" value={inrFull(filtered.length ? totalRevenue / filtered.length : 0)} />
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex gap-3 p-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders, products, customers…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isLoading ? <div className="p-8 text-sm text-center text-muted-foreground">Loading…</div> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Order ID</th>
                  <th className="text-left font-medium px-5 py-2.5">Customer</th>
                  <th className="text-left font-medium px-5 py-2.5">Product</th>
                  <th className="text-left font-medium px-5 py-2.5">Category</th>
                  <th className="text-right font-medium px-5 py-2.5">Qty</th>
                  <th className="text-right font-medium px-5 py-2.5">Amount</th>
                  <th className="text-left font-medium px-5 py-2.5">Payment</th>
                  <th className="text-left font-medium px-5 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((o) => {
                  const cust = custMap.get(o.customer_id);
                  return (
                    <tr key={o.id} className="border-t hover:bg-muted/30">
                      <td className="px-5 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                      <td className="px-5 py-3">{cust?.name ?? "—"}</td>
                      <td className="px-5 py-3">{o.product_name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{o.category}</td>
                      <td className="px-5 py-3 text-right">{o.quantity}</td>
                      <td className="px-5 py-3 text-right font-medium">{inrFull(o.amount)}</td>
                      <td className="px-5 py-3"><StatusBadge status={o.payment_status} /></td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(o.order_date).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border bg-card p-5">
    <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
  </div>
);
