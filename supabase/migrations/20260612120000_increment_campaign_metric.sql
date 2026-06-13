-- Atomic counter increment for campaign_metrics.
-- Called by the receipts endpoint on every simulator callback.
-- Using a function avoids read-modify-write races under concurrent callbacks.

CREATE OR REPLACE FUNCTION public.increment_campaign_metric(
  p_campaign_id uuid,
  p_column      text,
  p_amount      numeric DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _sql text;
BEGIN
  -- Whitelist columns to prevent SQL injection
  IF p_column NOT IN ('sent','delivered','failed','opened','clicked','converted','revenue') THEN
    RAISE EXCEPTION 'invalid column: %', p_column;
  END IF;

  _sql := format(
    'UPDATE public.campaign_metrics SET %I = COALESCE(%I, 0) + $1 WHERE campaign_id = $2',
    p_column, p_column
  );
  EXECUTE _sql USING p_amount, p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_campaign_metric(uuid, text, numeric) TO anon, authenticated, service_role;
