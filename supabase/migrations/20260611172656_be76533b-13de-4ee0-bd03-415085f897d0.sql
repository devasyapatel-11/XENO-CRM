
-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  city text,
  age int,
  total_spend numeric NOT NULL DEFAULT 0,
  last_purchase_date timestamptz,
  clv numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Churn Risk')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX customers_status_idx ON public.customers(status);
CREATE INDEX customers_city_idx ON public.customers(city);

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  order_date timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL,
  product_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  payment_status text NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid','Pending','Failed','Refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX orders_customer_idx ON public.orders(customer_id);
CREATE INDEX orders_date_idx ON public.orders(order_date DESC);
CREATE INDEX orders_category_idx ON public.orders(category);

-- Segments
CREATE TABLE public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  rules jsonb NOT NULL DEFAULT '{"op":"AND","conditions":[]}'::jsonb,
  audience_size int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments TO anon, authenticated;
GRANT ALL ON public.segments TO service_role;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.segments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  goal text,
  segment_id uuid REFERENCES public.segments(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('Email','SMS','WhatsApp','RCS')),
  subject text,
  message_content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Scheduled','Sending','Sent','Paused','Failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO anon, authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.campaigns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Campaign metrics
CREATE TABLE public.campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sent int NOT NULL DEFAULT 0,
  delivered int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  opened int NOT NULL DEFAULT 0,
  clicked int NOT NULL DEFAULT 0,
  converted int NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_metrics TO anon, authenticated;
GRANT ALL ON public.campaign_metrics TO service_role;
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.campaign_metrics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Copilot threads + messages
CREATE TABLE public.copilot_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_threads TO anon, authenticated;
GRANT ALL ON public.copilot_threads TO service_role;
ALTER TABLE public.copilot_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.copilot_threads FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.copilot_threads(id) ON DELETE CASCADE,
  message_id text,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  parts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_messages TO anon, authenticated;
GRANT ALL ON public.copilot_messages TO service_role;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.copilot_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX copilot_messages_thread_idx ON public.copilot_messages(thread_id, created_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_segments_updated BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_copilot_threads_updated BEFORE UPDATE ON public.copilot_threads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed customers
INSERT INTO public.customers (name,email,phone,city,age,total_spend,last_purchase_date,clv,status) VALUES
('Aarav Sharma','aarav@example.com','+91 98200 10001','Mumbai',32,18450,now()-interval '5 days',42000,'Active'),
('Priya Patel','priya@example.com','+91 98200 10002','Bengaluru',28,9200,now()-interval '12 days',21000,'Active'),
('Rohan Mehta','rohan@example.com','+91 98200 10003','Delhi',41,32100,now()-interval '2 days',78000,'Active'),
('Ananya Iyer','ananya@example.com','+91 98200 10004','Chennai',26,1200,now()-interval '95 days',1800,'Churn Risk'),
('Kabir Singh','kabir@example.com','+91 98200 10005','Pune',35,6700,now()-interval '40 days',12500,'Active'),
('Ishita Rao','ishita@example.com','+91 98200 10006','Hyderabad',29,15400,now()-interval '8 days',31000,'Active'),
('Vivaan Gupta','vivaan@example.com','+91 98200 10007','Mumbai',38,450,now()-interval '180 days',600,'Inactive'),
('Meera Nair','meera@example.com','+91 98200 10008','Kochi',31,22300,now()-interval '15 days',48000,'Active'),
('Arjun Reddy','arjun@example.com','+91 98200 10009','Hyderabad',45,55000,now()-interval '3 days',120000,'Active'),
('Diya Joshi','diya@example.com','+91 98200 10010','Ahmedabad',24,890,now()-interval '70 days',1500,'Churn Risk'),
('Aditya Kumar','aditya@example.com','+91 98200 10011','Jaipur',33,7800,now()-interval '22 days',16000,'Active'),
('Saanvi Verma','saanvi@example.com','+91 98200 10012','Lucknow',27,3400,now()-interval '50 days',6000,'Active'),
('Reyansh Shah','reyansh@example.com','+91 98200 10013','Surat',36,28900,now()-interval '6 days',64000,'Active'),
('Anika Desai','anika@example.com','+91 98200 10014','Bengaluru',30,210,now()-interval '210 days',300,'Inactive'),
('Vihaan Bose','vihaan@example.com','+91 98200 10015','Kolkata',42,41200,now()-interval '4 days',95000,'Active'),
('Pari Khanna','pari@example.com','+91 98200 10016','Delhi',25,5600,now()-interval '18 days',10200,'Active'),
('Aryan Malhotra','aryan@example.com','+91 98200 10017','Chandigarh',39,17800,now()-interval '11 days',38000,'Active'),
('Navya Pillai','navya@example.com','+91 98200 10018','Chennai',28,2100,now()-interval '85 days',3800,'Churn Risk'),
('Krish Agarwal','krish@example.com','+91 98200 10019','Mumbai',34,12400,now()-interval '9 days',27000,'Active'),
('Tara Menon','tara@example.com','+91 98200 10020','Kochi',29,8900,now()-interval '14 days',19000,'Active');

-- Seed orders
INSERT INTO public.orders (customer_id, amount, order_date, category, product_name, quantity, payment_status)
SELECT c.id,
  (random()*8000+500)::numeric(10,2),
  now() - (random()*90 || ' days')::interval,
  (ARRAY['Apparel','Beauty','Electronics','Home','Footwear','Grocery'])[1+floor(random()*6)::int],
  (ARRAY['Cotton Tee','Lipstick','Wireless Buds','Bedsheet Set','Sneakers','Olive Oil','Denim Jacket','Serum','Smart Watch'])[1+floor(random()*9)::int],
  1+floor(random()*3)::int,
  (ARRAY['Paid','Paid','Paid','Pending','Failed'])[1+floor(random()*5)::int]
FROM public.customers c, generate_series(1,4);

-- Seed segments
INSERT INTO public.segments (name, description, rules, audience_size) VALUES
('High Value Customers','CLV above ₹30,000','{"op":"AND","conditions":[{"field":"clv","operator":">","value":30000}]}'::jsonb, 6),
('Churn Risk - Mumbai','Churn risk customers in Mumbai','{"op":"AND","conditions":[{"field":"status","operator":"=","value":"Churn Risk"},{"field":"city","operator":"=","value":"Mumbai"}]}'::jsonb, 1),
('Recent Big Spenders','Spent over ₹10k in last 30 days','{"op":"AND","conditions":[{"field":"total_spend","operator":">","value":10000},{"field":"last_purchase_date","operator":">","value":"30_days_ago"}]}'::jsonb, 8);

-- Seed campaigns + metrics
WITH s AS (SELECT id FROM public.segments LIMIT 1),
ins AS (
  INSERT INTO public.campaigns (name, goal, segment_id, channel, subject, message_content, status, sent_at)
  SELECT 'Diwali VIP Preview','Drive repeat purchase from VIPs', s.id,'Email','Your VIP Diwali preview is here ✨','Hi {{name}}, get early access to our Diwali edit — 24 hours before everyone else.','Sent', now()-interval '7 days' FROM s
  UNION ALL
  SELECT 'Win-back 20% off','Reactivate churn-risk customers', s.id,'WhatsApp',NULL,'We miss you {{name}}! Here''s 20% off your next order. Code: COMEBACK20','Sent', now()-interval '3 days' FROM s
  UNION ALL
  SELECT 'New Arrivals SMS','Announce new collection', s.id,'SMS',NULL,'New drop just landed. Shop now: xeno.shop/new','Draft', NULL FROM s
  RETURNING id
)
INSERT INTO public.campaign_metrics (campaign_id, sent, delivered, failed, opened, clicked, converted, revenue)
SELECT id,
  (800+random()*400)::int,
  (750+random()*350)::int,
  (10+random()*40)::int,
  (300+random()*300)::int,
  (80+random()*150)::int,
  (20+random()*60)::int,
  (40000+random()*80000)::numeric(10,2)
FROM ins;
