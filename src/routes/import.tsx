// Data Ingestion page — lets marketers import customers and orders via CSV
// or add individual customers and orders manually.
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Upload, UserPlus, ShoppingBag, CheckCircle2, AlertTriangle, Download, Loader2, Check, ChevronsUpDown, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { createOrder, importOrders } from "@/lib/crm/orders.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/import")({ component: ImportPage });

type ParsedCustomer = {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  age?: number;
  total_spend?: number;
  clv?: number;
  status?: string;
};

type ParsedOrder = {
  customer_email: string;
  amount: number;
  category: string;
  product_name: string;
  quantity: number;
  payment_status: "Paid" | "Pending" | "Failed" | "Refunded";
  order_date?: string;
};

// ─── CSV Parsers ──────────────────────────────────────────────────────────────
function parseCustomersCSV(text: string): ParsedCustomer[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return {
      name: obj.name ?? obj.full_name ?? "",
      email: obj.email ?? "",
      phone: obj.phone ?? obj.mobile ?? undefined,
      city: obj.city ?? undefined,
      age: obj.age ? parseInt(obj.age) : undefined,
      total_spend: obj.total_spend ?? obj.totalspend ? parseFloat(obj.total_spend ?? obj.totalspend) : undefined,
      clv: obj.clv ? parseFloat(obj.clv) : undefined,
      status: obj.status ?? undefined,
    };
  }).filter((c) => c.name && c.email);
}

function parseOrdersCSV(text: string): ParsedOrder[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return {
      customer_email: obj.customer_email ?? obj.email ?? "",
      amount: obj.amount ? parseFloat(obj.amount) : 0,
      category: obj.category ?? "Apparel",
      product_name: obj.product_name ?? obj.product ?? "Product",
      quantity: obj.quantity ? parseInt(obj.quantity) : 1,
      payment_status: (["Paid", "Pending", "Failed", "Refunded"].includes(obj.payment_status) ? obj.payment_status : "Paid") as ParsedOrder["payment_status"],
      order_date: obj.order_date ?? obj.date ?? undefined,
    };
  }).filter((o) => o.customer_email && o.amount > 0);
}

// ─── Customer Forms ──────────────────────────────────────────────────────────
function AddCustomerForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", city: "", age: "",
    total_spend: "", status: "Active",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone || null,
      city: form.city || null,
      age: form.age ? parseInt(form.age) : null,
      total_spend: form.total_spend ? parseFloat(form.total_spend) : 0,
      clv: form.total_spend ? parseFloat(form.total_spend) * 1.2 : 0,
      status: form.status,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${form.name} added successfully`);
      setForm({ name: "", email: "", phone: "", city: "", age: "", total_spend: "", status: "Active" });
      queryClient.invalidateQueries({ queryKey: ["customers-list-simple"] });
      queryClient.invalidateQueries({ queryKey: ["customers-with-orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onSuccess();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />Add customer manually
        </CardTitle>
        <CardDescription>Create a profile for a shopper directly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name *" value={form.name} onChange={(v) => set("name", v)} placeholder="Priya Sharma" />
          <Field label="Email *" value={form.email} onChange={(v) => set("email", v)} placeholder="priya@example.com" type="email" />
          <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+91 98765 43210" />
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} placeholder="Mumbai" />
          <Field label="Age" value={form.age} onChange={(v) => set("age", v)} placeholder="32" type="number" />
          <Field label="Total spend (₹)" value={form.total_spend} onChange={(v) => set("total_spend", v)} placeholder="15000" type="number" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Churn Risk">Churn Risk</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
          Add customer
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomerCSVUpload({ onSuccess }: { onSuccess: (count: number) => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedCustomer[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCustomersCSV(text);
      setPreview(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const importAll = async () => {
    if (!preview.length) return;
    setImporting(true);
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < preview.length; i += 50) {
      const chunk = preview.slice(i, i + 50).map((c) => ({
        name: c.name,
        email: c.email.trim().toLowerCase(),
        phone: c.phone ?? null,
        city: c.city ?? null,
        age: c.age ?? null,
        total_spend: c.total_spend ?? 0,
        clv: c.clv ?? (c.total_spend ? c.total_spend * 1.2 : 0),
        status: (["Active", "Inactive", "Churn Risk"].includes(c.status ?? "")) ? c.status : "Active",
      }));
      const { error, data } = await supabase
        .from("customers")
        .upsert(chunk, { onConflict: "email", ignoreDuplicates: false })
        .select("id");
      if (error) { errors += chunk.length; }
      else { imported += data?.length ?? chunk.length; }
    }

    setImporting(false);
    setResult({ imported, errors });
    setPreview([]);
    queryClient.invalidateQueries({ queryKey: ["customers-list-simple"] });
    queryClient.invalidateQueries({ queryKey: ["customers-with-orders"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    onSuccess(imported);
    if (errors === 0) toast.success(`Imported ${imported} customers`);
    else toast.warning(`Imported ${imported}, ${errors} errors`);
  };

  const downloadTemplate = () => {
    const csv = "name,email,phone,city,age,total_spend,status\nPriya Sharma,priya@example.com,+919876543210,Mumbai,28,15000,Active\n";
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = "xeno-customers-template.csv";
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />Import customers via CSV</span>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download className="h-3.5 w-3.5 mr-1.5" />Template</Button>
        </CardTitle>
        <CardDescription>Upload list of customers. Row emails are unique identifiers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/20",
          )}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Required columns: name, email</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {result && (
          <div className={cn("rounded-lg p-3 text-sm flex items-center gap-2", result.errors === 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300")}>
            {result.errors === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            Imported {result.imported} customers{result.errors > 0 ? `, ${result.errors} failed` : ""}
          </div>
        )}

        {preview.length > 0 && (
          <>
            <div className="rounded-lg border overflow-auto max-h-[280px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Email</th>
                    <th className="text-left px-3 py-2 font-medium">City</th>
                    <th className="text-right px-3 py-2 font-medium">Spend</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.city ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{c.total_spend ? `₹${c.total_spend.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="px-3 py-2">{c.status ?? "Active"}</td>
                    </tr>
                  ))}
                  {preview.length > 20 && (
                    <tr><td colSpan={5} className="px-3 py-2 text-center text-muted-foreground">+{preview.length - 20} more rows…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{preview.length} rows parsed</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreview([])}>Cancel</Button>
                <Button size="sm" onClick={importAll} disabled={importing}>
                  {importing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                  Import {preview.length} customers
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Orders Forms ────────────────────────────────────────────────────────────
function AddOrderForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customer_id: "",
    amount: "",
    category: "Apparel",
    product_name: "",
    quantity: "1",
    payment_status: "Paid",
    order_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const triggerCreateOrder = useServerFn(createOrder);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, email").order("name");
      return data ?? [];
    },
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const selectedCustomer = customers.find((c) => c.id === form.customer_id);
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const submit = async () => {
    if (!form.customer_id) {
      toast.error("Please select a customer");
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Please enter a valid order amount");
      return;
    }
    if (!form.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setSaving(true);
    try {
      await triggerCreateOrder({
        data: {
          customer_id: form.customer_id,
          amount: parseFloat(form.amount),
          category: form.category,
          product_name: form.product_name.trim(),
          quantity: parseInt(form.quantity) || 1,
          payment_status: form.payment_status as "Paid" | "Pending" | "Failed" | "Refunded",
          order_date: form.order_date ? new Date(form.order_date).toISOString() : undefined,
        }
      });

      toast.success("Order added successfully");
      setForm({
        customer_id: "",
        amount: "",
        category: "Apparel",
        product_name: "",
        quantity: "1",
        payment_status: "Paid",
        order_date: "",
      });
      queryClient.invalidateQueries({ queryKey: ["orders-page"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customers-with-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-list-simple"] });
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />Add order manually
        </CardTitle>
        <CardDescription>Log an order for an existing shopper in your CRM.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Select customer *</label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between mt-1 text-left font-normal"
              >
                {selectedCustomer ? (
                  <span className="truncate">
                    {selectedCustomer.name} ({selectedCustomer.email})
                  </span>
                ) : (
                  <span className="text-muted-foreground">Choose a customer…</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="flex flex-col h-[300px]">
                <div className="flex items-center border-b px-3 py-2 shrink-0">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <input
                    type="text"
                    placeholder="Search shopper name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground border-none focus:ring-0 focus:outline-none"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-0.5 min-h-0">
                  {filteredCustomers.map((c) => {
                    const isSelected = form.customer_id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          set("customer_id", c.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition text-left cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <div className="truncate pr-4">
                          <span className="font-medium block text-xs">{c.name}</span>
                          <span className={cn("text-[10px] block", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            {c.email}
                          </span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredCustomers.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">No customer found.</div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Product Name *" value={form.product_name} onChange={(v) => set("product_name", v)} placeholder="Cotton Tee" />
          <div>
            <label className="text-xs font-medium text-muted-foreground">Category *</label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Apparel">Apparel</SelectItem>
                <SelectItem value="Beauty">Beauty</SelectItem>
                <SelectItem value="Electronics">Electronics</SelectItem>
                <SelectItem value="Home">Home</SelectItem>
                <SelectItem value="Footwear">Footwear</SelectItem>
                <SelectItem value="Grocery">Grocery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Amount (₹) *" value={form.amount} onChange={(v) => set("amount", v)} placeholder="1200" type="number" />
          <Field label="Quantity" value={form.quantity} onChange={(v) => set("quantity", v)} placeholder="1" type="number" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Payment Status</label>
            <Select value={form.payment_status} onValueChange={(v) => set("payment_status", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
                <SelectItem value="Refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Order Date (optional)</label>
            <Input
              type="datetime-local"
              value={form.order_date}
              onChange={(e) => set("order_date", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingBag className="h-4 w-4 mr-2" />}
          Add order
        </Button>
      </CardContent>
    </Card>
  );
}

function OrderCSVUpload({ onSuccess }: { onSuccess: (count: number) => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedOrder[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; createdCustomers: number; errors: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const triggerImportOrders = useServerFn(importOrders);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseOrdersCSV(text);
      setPreview(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const importAll = async () => {
    if (!preview.length) return;
    setImporting(true);

    try {
      const chunk = preview.map((o) => ({
        customer_email: o.customer_email.trim().toLowerCase(),
        amount: o.amount,
        category: o.category,
        product_name: o.product_name,
        quantity: o.quantity,
        payment_status: o.payment_status,
        order_date: o.order_date ? new Date(o.order_date).toISOString() : undefined,
      }));

      const res = await triggerImportOrders({ data: chunk });

      setResult({
        imported: res.imported,
        createdCustomers: res.createdCustomers,
        errors: res.errorsCount,
      });
      setPreview([]);
      queryClient.invalidateQueries({ queryKey: ["orders-page"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customers-list-simple"] });
      queryClient.invalidateQueries({ queryKey: ["customers-with-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onSuccess(res.imported);

      if (res.errorsCount === 0) {
        toast.success(`Imported ${res.imported} orders. Created ${res.createdCustomers} customer profiles.`);
      } else {
        toast.warning(`Imported ${res.imported} orders (${res.errorsCount} skipped/errors).`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import orders");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "customer_email,amount,category,product_name,quantity,payment_status,order_date\npriya@example.com,2450,Apparel,Denim Jacket,1,Paid,2026-06-12T12:00:00Z\n";
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = "xeno-orders-template.csv";
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />Import orders via CSV</span>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download className="h-3.5 w-3.5 mr-1.5" />Template</Button>
        </CardTitle>
        <CardDescription>Upload orders. Auto-creates placeholder customer profiles for new emails.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/20",
          )}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Required columns: customer_email, amount, category, product_name</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {result && (
          <div className={cn("rounded-lg p-3 text-sm flex flex-col gap-1", result.errors === 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300")}>
            <div className="flex items-center gap-2 font-medium">
              {result.errors === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              Import completed
            </div>
            <div className="text-xs pl-6">
              - {result.imported} orders imported successfully.<br/>
              - {result.createdCustomers} new customer accounts auto-generated.<br/>
              {result.errors > 0 && <span>- {result.errors} records encountered error/skipped.</span>}
            </div>
          </div>
        )}

        {preview.length > 0 && (
          <>
            <div className="rounded-lg border overflow-auto max-h-[280px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Customer Email</th>
                    <th className="text-left px-3 py-2 font-medium">Product</th>
                    <th className="text-left px-3 py-2 font-medium">Category</th>
                    <th className="text-right px-3 py-2 font-medium">Amount</th>
                    <th className="text-left px-3 py-2 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((o, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 truncate max-w-[120px]">{o.customer_email}</td>
                      <td className="px-3 py-2 truncate max-w-[100px]">{o.product_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{o.category}</td>
                      <td className="px-3 py-2 text-right">₹{o.amount.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2">{o.payment_status}</td>
                    </tr>
                  ))}
                  {preview.length > 20 && (
                    <tr><td colSpan={5} className="px-3 py-2 text-center text-muted-foreground">+{preview.length - 20} more rows…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{preview.length} rows parsed</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreview([])}>Cancel</Button>
                <Button size="sm" onClick={importAll} disabled={importing}>
                  {importing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                  Import {preview.length} orders
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Ingestion Page ──────────────────────────────────────────────────────
function ImportPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell title="Import Data">
      <PageContainer>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Data Ingestion Hub</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ingest shoppers and orders via CSV spreadsheets or using manual creation forms.
          </p>
        </div>

        <Tabs defaultValue="customers" className="w-full space-y-6">
          <TabsList className="grid grid-cols-2 max-w-[400px]">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <UserPlus className="h-3.5 w-3.5" />
              Shoppers
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingBag className="h-3.5 w-3.5" />
              Purchase Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <CustomerCSVUpload key={`cust-csv-${refreshKey}`} onSuccess={() => setRefreshKey((k) => k + 1)} />
              <AddCustomerForm onSuccess={() => setRefreshKey((k) => k + 1)} />
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <OrderCSVUpload key={`ord-csv-${refreshKey}`} onSuccess={() => setRefreshKey((k) => k + 1)} />
              <AddOrderForm onSuccess={() => setRefreshKey((k) => k + 1)} />
            </div>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Schema Formats</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-4 text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase mb-1">Shoppers CSV columns:</h4>
              <div className="rounded-md bg-muted/40 p-2 font-mono text-xs overflow-auto text-foreground">
                name, email, phone, city, age, total_spend, status
              </div>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                <li><code>email</code> must be unique. Duplicate emails will update customer profile attributes.</li>
                <li><code>status</code> supports: <code>Active</code>, <code>Inactive</code>, <code>Churn Risk</code> (default Active).</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase mb-1">Orders CSV columns:</h4>
              <div className="rounded-md bg-muted/40 p-2 font-mono text-xs overflow-auto text-foreground">
                customer_email, amount, category, product_name, quantity, payment_status, order_date
              </div>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                <li><code>customer_email</code> will look up and link to the shopper account. If the shopper does not exist, an account is auto-created.</li>
                <li><code>category</code> supports: <code>Apparel</code>, <code>Beauty</code>, <code>Electronics</code>, <code>Home</code>, <code>Footwear</code>, <code>Grocery</code>.</li>
                <li><code>payment_status</code> supports: <code>Paid</code>, <code>Pending</code>, <code>Failed</code>, <code>Refunded</code> (default Paid).</li>
                <li>Aggregated metrics (Total spend, CLV, Last purchase date) update automatically for affected shoppers.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  );
}

const Field = ({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1"
    />
  </div>
);
