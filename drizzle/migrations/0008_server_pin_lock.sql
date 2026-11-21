-- Makes the PIN a real lock. A family with a PIN can only read or change its folders from a sign-in
-- session that has entered the PIN (or a registered device unlock) recently. The check sits in the
-- database rules, so it holds even for someone who calls the API directly with a stolen session.

-- One row per unlocked sign-in session (the JWT session_id claim). Written only by the server.
CREATE TABLE public.pin_unlocks (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX pin_unlocks_user ON public.pin_unlocks (user_id);
REVOKE ALL ON public.pin_unlocks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pin_unlocks TO service_role;
ALTER TABLE public.pin_unlocks ENABLE ROW LEVEL SECURITY;

-- Devices that may unlock after Face ID / fingerprint. Only a hash of the device secret is stored.
CREATE TABLE public.pin_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_used_at timestamptz
);
CREATE INDEX pin_devices_user ON public.pin_devices (user_id);
REVOKE ALL ON public.pin_devices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pin_devices TO service_role;
ALTER TABLE public.pin_devices ENABLE ROW LEVEL SECURITY;

-- True when the account has no PIN, or this very session has an unexpired unlock.
CREATE OR REPLACE FUNCTION public.pin_unlocked() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (
   NOT EXISTS(SELECT 1 FROM public.workspaces WHERE owner_id=auth.uid() AND pin_hash IS NOT NULL)
   OR EXISTS(
     SELECT 1 FROM public.pin_unlocks
     WHERE user_id=auth.uid()
       AND session_id::text = (auth.jwt()->>'session_id')
       AND clock_timestamp() < expires_at
   )
 );
$$;
REVOKE ALL ON FUNCTION public.pin_unlocked() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pin_unlocked() TO authenticated, service_role;

CREATE POLICY children_pin_unlocked ON public.children AS RESTRICTIVE FOR ALL TO authenticated USING (public.pin_unlocked()) WITH CHECK (public.pin_unlocked());
CREATE POLICY entries_pin_unlocked ON public.entries AS RESTRICTIVE FOR ALL TO authenticated USING (public.pin_unlocked()) WITH CHECK (public.pin_unlocked());
CREATE POLICY tasks_pin_unlocked ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated USING (public.pin_unlocked()) WITH CHECK (public.pin_unlocked());
CREATE POLICY documents_pin_unlocked ON public.documents AS RESTRICTIVE FOR ALL TO authenticated USING (public.pin_unlocked()) WITH CHECK (public.pin_unlocked());
CREATE POLICY child_calendars_pin_unlocked ON public.child_calendars AS RESTRICTIVE FOR ALL TO authenticated USING (public.pin_unlocked()) WITH CHECK (public.pin_unlocked());
CREATE POLICY child_docs_pin_unlocked ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id <> 'child-documents' OR public.pin_unlocked())
  WITH CHECK (bucket_id <> 'child-documents' OR public.pin_unlocked());
