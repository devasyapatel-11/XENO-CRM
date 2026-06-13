-- Create function to update customer total spend, clv, and last purchase date
CREATE OR REPLACE FUNCTION public.sync_customer_order_stats()
RETURNS trigger AS $$
DECLARE
  v_customer_id uuid;
  v_total_spend numeric;
  v_last_purchase timestamptz;
BEGIN
  -- Determine which customer needs recalculation
  IF TG_OP = 'DELETE' THEN
    v_customer_id := OLD.customer_id;
  ELSE
    v_customer_id := NEW.customer_id;
  END IF;

  -- Calculate aggregates from orders with 'Paid' status
  SELECT COALESCE(SUM(amount), 0), MAX(order_date)
  INTO v_total_spend, v_last_purchase
  FROM public.orders
  WHERE customer_id = v_customer_id AND payment_status = 'Paid';

  -- Update customer stats
  UPDATE public.customers
  SET total_spend = v_total_spend,
      last_purchase_date = v_last_purchase,
      clv = v_total_spend * 1.2
  WHERE id = v_customer_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
CREATE OR REPLACE TRIGGER trg_orders_sync_stats
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_order_stats();
