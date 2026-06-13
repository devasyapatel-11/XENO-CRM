import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Filter, Download, UserPlus } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { inrFull, num, relativeDate, initials } from "@/lib/crm/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/customers/")({ component: CustomersPage });

function CustomersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"spend" | "recent" | "clv">("recent");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(ql) || c.email.toLowerCase().includes(ql) || (c.city ?? "").toLowerCase().includes(ql));
    }
    if (status !== "all") list = list.filter((c) => c.status === status);
    list = [...list].sort((a, b) => {
      if (sort === "spend") return Number(b.total_spend) - Number(a.total_spend);
      if (sort === "clv") return Number(b.clv) - Number(a.clv);
      return new Date(b.last_purchase_date ?? 0).getTime() - new Date(a.last_purchase_date ?? 0).getTime();
    });
    return list;
  }, [data, q, status, sort]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <AppShell
      title="Customers"
      actions={<><Button variant="outline" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button><Button size="sm"><UserPlus className="mr-1.5 h-3.5 w-3.5" />Add Customer</Button></>}
    >
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col md:flex-row gap-3 p-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, city…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Churn Risk">Churn Risk</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent purchase</SelectItem>
                <SelectItem value="spend">Highest total spend</SelectItem>
                <SelectItem value="clv">Highest CLV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading customers…</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={UserPlus} title="No customers match" description="Try adjusting filters or import a CSV to bring in customers." action={{ label: "Clear filters", onClick: () => { setQ(""); setStatus("all"); } }} />
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="text-left font-medium px-5 py-2.5">Customer</th>
                    <th className="text-left font-medium px-5 py-2.5">City</th>
                    <th className="text-right font-medium px-5 py-2.5">Total Spend</th>
                    <th className="text-right font-medium px-5 py-2.5">CLV</th>
                    <th className="text-left font-medium px-5 py-2.5">Last Purchase</th>
                    <th className="text-left font-medium px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <Link to="/customers/$id" params={{ id: c.id }} className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/80 to-chart-5/70 grid place-items-center text-primary-foreground text-xs font-semibold">{initials(c.name)}</div>
                          <div>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.email}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{c.city ?? "—"}</td>
                      <td className="px-5 py-3 text-right font-medium">{inrFull(c.total_spend)}</td>
                      <td className="px-5 py-3 text-right">{inrFull(c.clv)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{relativeDate(c.last_purchase_date)}</td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
                <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {num(filtered.length)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
