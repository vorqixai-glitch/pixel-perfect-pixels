
-- FINDINGS
CREATE TABLE public.findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  page_url text NOT NULL,
  description text NOT NULL DEFAULT '',
  why_matters text NOT NULL DEFAULT '',
  suggested_fix text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  confidence numeric NOT NULL DEFAULT 0.8,
  notes text NOT NULL DEFAULT '',
  assigned_to text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO authenticated;
GRANT ALL ON public.findings TO service_role;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "findings_select_own" ON public.findings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "findings_insert_own" ON public.findings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "findings_update_own" ON public.findings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "findings_delete_own" ON public.findings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER findings_updated BEFORE UPDATE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX findings_scan_idx ON public.findings(scan_id);
CREATE INDEX findings_user_idx ON public.findings(user_id);

-- AUDIT EVENTS
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid REFERENCES public.scans(id) ON DELETE CASCADE,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_own" ON public.audit_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "audit_insert_own" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX audit_user_idx ON public.audit_events(user_id, created_at DESC);
