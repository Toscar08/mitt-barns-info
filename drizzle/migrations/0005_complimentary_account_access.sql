CREATE TABLE public.complimentary_access (user_id uuid PRIMARY KEY, granted_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz, reason text NOT NULL);
REVOKE ALL ON public.complimentary_access FROM anon, authenticated;
GRANT SELECT ON public.complimentary_access TO authenticated;
GRANT ALL ON public.complimentary_access TO service_role;
ALTER TABLE public.complimentary_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_grant ON public.complimentary_access FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY own_grant_boundary ON public.complimentary_access AS RESTRICTIVE FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.has_account_access() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND (EXISTS(SELECT 1 FROM public.account_trials WHERE user_id=auth.uid() AND clock_timestamp()<ends_at) OR EXISTS(SELECT 1 FROM public.verified_payments WHERE user_id=auth.uid() AND revoked_at IS NULL) OR EXISTS(SELECT 1 FROM public.complimentary_access WHERE user_id=auth.uid() AND revoked_at IS NULL)); $$;
CREATE OR REPLACE FUNCTION public.get_my_campaign_access() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE launch_at timestamptz; trial_row public.account_trials; paid boolean; server_now timestamptz; status text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 PERFORM public.claim_launch_trial(auth.uid());
 SELECT started_at INTO launch_at FROM public.launch_campaign WHERE id=true;
 SELECT * INTO trial_row FROM public.account_trials WHERE user_id=auth.uid();
 SELECT EXISTS(SELECT 1 FROM public.verified_payments WHERE user_id=auth.uid() AND revoked_at IS NULL) INTO paid;
 server_now:=clock_timestamp();
 status:=public.campaign_access_status(launch_at,trial_row.ends_at,paid,server_now);
 IF EXISTS(SELECT 1 FROM public.complimentary_access WHERE user_id=auth.uid() AND revoked_at IS NULL) THEN status:='complimentary'; END IF;
 RETURN jsonb_build_object('status',status,'serverNow',server_now,'launchStartedAt',launch_at,'trialStartsAt',trial_row.starts_at,'trialEndsAt',trial_row.ends_at,'remainingSeconds',CASE WHEN trial_row.ends_at IS NULL THEN 0 ELSE greatest(0,extract(epoch FROM trial_row.ends_at-server_now)) END,'isAdmin',public.has_role(auth.uid(),'admin'));
END; $$;