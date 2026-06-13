import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OrderInput = z.object({
  customer_id: z.string().uuid(),
  amount: z.number().positive(),
  category: z.string().min(1),
  product_name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  payment_status: z.enum(["Paid", "Pending", "Failed", "Refunded"]).default("Paid"),
  order_date: z.string().optional(),
});

const ImportOrderInput = z.object({
  customer_email: z.string().email(),
  amount: z.number().positive(),
  category: z.string().min(1),
  product_name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  payment_status: z.enum(["Paid", "Pending", "Failed", "Refunded"]).default("Paid"),
  order_date: z.string().optional(),
});

/** Helper to recalculate customer metrics based on paid orders */
async function syncCustomerMetrics(supabaseAdmin: any, customerId: string) {
  // Get all paid orders for the customer
  const { data: orders, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select("amount, order_date")
    .eq("customer_id", customerId)
    .eq("payment_status", "Paid");

  if (fetchErr) {
    console.error(`Error fetching customer orders for ${customerId}:`, fetchErr);
    return;
  }

  let totalSpend = 0;
  let lastPurchaseDate: string | null = null;

  if (orders && orders.length > 0) {
    totalSpend = orders.reduce((sum: number, o: any) => sum + Number(o.amount), 0);
    const dates = orders
      .map((o: any) => new Date(o.order_date).getTime())
      .filter((t: number) => !isNaN(t));
    if (dates.length > 0) {
      lastPurchaseDate = new Date(Math.max(...dates)).toISOString();
    }
  }

  // Update customer record
  const { error: updateErr } = await supabaseAdmin
    .from("customers")
    .update({
      total_spend: totalSpend,
      last_purchase_date: lastPurchaseDate,
      clv: totalSpend * 1.2,
    })
    .eq("id", customerId);

  if (updateErr) {
    console.error(`Error updating customer metrics for ${customerId}:`, updateErr);
  }
}

export const createOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => OrderInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if customer exists
    const { data: customer, error: custErr } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id", data.customer_id)
      .maybeSingle();

    if (custErr || !customer) {
      throw new Error("Customer not found");
    }

    const orderDate = data.order_date || new Date().toISOString();

    // Insert order
    const { data: order, error: insertErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: data.customer_id,
        amount: data.amount,
        category: data.category,
        product_name: data.product_name,
        quantity: data.quantity,
        payment_status: data.payment_status,
        order_date: orderDate,
      })
      .select("id")
      .single();

    if (insertErr || !order) {
      throw new Error(`Failed to create order: ${insertErr?.message}`);
    }

    // Sync stats
    await syncCustomerMetrics(supabaseAdmin, data.customer_id);

    return { order_id: order.id };
  });

export const importOrders = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.array(ImportOrderInput).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let importedCount = 0;
    let createdCustomersCount = 0;
    const errors: string[] = [];

    // Process each order sequentially or in small groups to correctly serialize and recalculate stats
    for (const item of data) {
      try {
        // Find customer by email
        let { data: customer } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("email", item.customer_email.trim().toLowerCase())
          .maybeSingle();

        let customerId = customer?.id;

        // If customer doesn't exist, create placeholder customer
        if (!customerId) {
          const emailParts = item.customer_email.split("@");
          const defaultName = emailParts[0]
            .split(/[._-]/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

          const { data: newCust, error: createCustErr } = await supabaseAdmin
            .from("customers")
            .insert({
              name: defaultName || "D2C Shopper",
              email: item.customer_email.trim().toLowerCase(),
              status: "Active",
            })
            .select("id")
            .single();

          if (createCustErr || !newCust) {
            throw new Error(`Failed to create customer for order: ${createCustErr?.message}`);
          }

          customerId = newCust.id;
          createdCustomersCount++;
        }

        const orderDate = item.order_date || new Date().toISOString();

        // Insert order
        const { error: orderErr } = await supabaseAdmin.from("orders").insert({
          customer_id: customerId,
          amount: item.amount,
          category: item.category,
          product_name: item.product_name,
          quantity: item.quantity,
          payment_status: item.payment_status,
          order_date: orderDate,
        });

        if (orderErr) {
          throw new Error(`Failed to insert order: ${orderErr.message}`);
        }

        // Sync customer stats
        await syncCustomerMetrics(supabaseAdmin, customerId);
        importedCount++;
      } catch (err) {
        console.error("Error importing order:", err);
        errors.push((err as Error).message);
      }
    }

    if (errors.length > 0 && importedCount === 0) {
      throw new Error(`Import failed: ${errors[0]}`);
    }

    return {
      imported: importedCount,
      createdCustomers: createdCustomersCount,
      errorsCount: errors.length,
    };
  });
