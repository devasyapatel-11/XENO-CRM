
-- 1. Communications (one row per outbound message from a campaign)
CREATE TABLE public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  channel text NOT NULL,
  recipient text NOT NULL,
  message text NOT NULL,
  state text NOT NULL DEFAULT 'PENDING',
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communications TO anon, authenticated;
GRANT ALL ON public.communications TO service_role;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.communications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_touch_communications BEFORE UPDATE ON public.communications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_comm_campaign ON public.communications(campaign_id);
CREATE INDEX idx_comm_customer ON public.communications(customer_id);

-- 2. Communication events (append-only event source)
CREATE TABLE public.communication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_events TO anon, authenticated;
GRANT ALL ON public.communication_events TO service_role;
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.communication_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_events_comm ON public.communication_events(communication_id);
CREATE INDEX idx_events_type ON public.communication_events(event_type);
CREATE INDEX idx_events_occurred ON public.communication_events(occurred_at DESC);

-- 3. Simulator queue (Channel Simulator's internal queue)
CREATE TABLE public.simulator_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL,
  customer_id uuid,
  channel text NOT NULL,
  recipient text NOT NULL,
  message text NOT NULL,
  callback_url text,
  current_state text NOT NULL DEFAULT 'QUEUED',
  next_event text,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_queue TO anon, authenticated;
GRANT ALL ON public.simulator_queue TO service_role;
ALTER TABLE public.simulator_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.simulator_queue FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_touch_sim_queue BEFORE UPDATE ON public.simulator_queue FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_sim_queue_run ON public.simulator_queue(next_run_at) WHERE current_state NOT IN ('TERMINAL','DEAD');

-- 4. Simulator logs
CREATE TABLE public.simulator_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_logs TO anon, authenticated;
GRANT ALL ON public.simulator_logs TO service_role;
ALTER TABLE public.simulator_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.simulator_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_sim_logs_created ON public.simulator_logs(created_at DESC);

-- 5. AI recommendations
CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  reasoning text NOT NULL,
  impact_estimate numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_recommendations TO anon, authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.ai_recommendations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. AI agent runs (Campaign Agent workflow)
CREATE TABLE public.ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  segment_id uuid REFERENCES public.segments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_runs TO anon, authenticated;
GRANT ALL ON public.ai_agent_runs TO service_role;
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo public access" ON public.ai_agent_runs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_touch_agent_runs BEFORE UPDATE ON public.ai_agent_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
