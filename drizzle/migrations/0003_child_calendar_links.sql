CREATE TABLE public.child_calendars (
  child_id uuid PRIMARY KEY REFERENCES public.children(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  url text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_calendars TO authenticated;
GRANT ALL ON public.child_calendars TO service_role;
ALTER TABLE public.child_calendars ENABLE ROW LEVEL SECURITY;
CREATE POLICY child_calendars_own ON public.child_calendars FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY child_calendars_active_access ON public.child_calendars AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_account_access()) WITH CHECK (public.has_account_access());
ALTER TABLE public.tasks ADD COLUMN external_uid text;