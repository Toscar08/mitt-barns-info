ALTER TABLE public.verified_payments
  ADD COLUMN plan text NOT NULL DEFAULT 'lifetime',
  ADD COLUMN access_until timestamptz,
  ADD COLUMN provider_customer text,
  ADD COLUMN provider_subscription text;
ALTER TABLE public.verified_payments DROP CONSTRAINT IF EXISTS payment_amount;
ALTER TABLE public.verified_payments ADD CONSTRAINT payment_plan CHECK (
  (plan = 'lifetime' AND amount_cents = 49900 AND access_until IS NULL)
  OR (plan = 'monthly' AND amount_cents = 3900 AND access_until IS NOT NULL)
  OR (plan = 'yearly' AND amount_cents = 34900 AND access_until IS NOT NULL)
);
ALTER TABLE public.verified_payments ALTER COLUMN plan DROP DEFAULT;
CREATE INDEX verified_payments_user_access ON public.verified_payments (user_id, access_until);

-- Signed-in users may only ask about themselves; server code (no auth.uid) may ask about anyone.
CREATE OR REPLACE FUNCTION public.has_paid_access(target_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT (auth.uid() IS NULL OR auth.uid()=target_user) AND EXISTS(SELECT 1 FROM public.verified_payments WHERE user_id=target_user AND revoked_at IS NULL AND (access_until IS NULL OR clock_timestamp()<access_until));
$$;
REVOKE ALL ON FUNCTION public.has_paid_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_paid_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_account_access() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND (EXISTS(SELECT 1 FROM public.account_trials WHERE user_id=auth.uid() AND clock_timestamp()<ends_at) OR public.has_paid_access(auth.uid()) OR EXISTS(SELECT 1 FROM public.complimentary_access WHERE user_id=auth.uid() AND revoked_at IS NULL)); $$;

CREATE OR REPLACE FUNCTION public.get_my_campaign_access() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE launch_at timestamptz; trial_row public.account_trials; paid boolean; paid_until timestamptz; paid_plan text; server_now timestamptz; status text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 PERFORM public.claim_launch_trial(auth.uid());
 SELECT started_at INTO launch_at FROM public.launch_campaign WHERE id=true;
 SELECT * INTO trial_row FROM public.account_trials WHERE user_id=auth.uid();
 paid:=public.has_paid_access(auth.uid());
 SELECT access_until, plan INTO paid_until, paid_plan FROM public.verified_payments
  WHERE user_id=auth.uid() AND revoked_at IS NULL AND (access_until IS NULL OR clock_timestamp()<access_until)
  ORDER BY access_until DESC NULLS FIRST LIMIT 1;
 server_now:=clock_timestamp();
 status:=public.campaign_access_status(launch_at,trial_row.ends_at,paid,server_now);
 IF EXISTS(SELECT 1 FROM public.complimentary_access WHERE user_id=auth.uid() AND revoked_at IS NULL) THEN status:='complimentary'; END IF;
 RETURN jsonb_build_object('status',status,'serverNow',server_now,'launchStartedAt',launch_at,'trialStartsAt',trial_row.starts_at,'trialEndsAt',trial_row.ends_at,'remainingSeconds',CASE WHEN trial_row.ends_at IS NULL THEN 0 ELSE greatest(0,extract(epoch FROM trial_row.ends_at-server_now)) END,'isAdmin',public.has_role(auth.uid(),'admin'),'paidPlan',paid_plan,'paidUntil',paid_until);
END; $$;