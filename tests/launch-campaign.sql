-- Integration tests run against the real PostgreSQL rules. All fixtures roll back.
BEGIN;
CREATE FUNCTION pg_temp.assert_rule(ok boolean, rule text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',rule; END IF; END; $$;
SELECT pg_temp.assert_rule(public.trial_window_eligible('2026-11-30 23:59:59.999Z','2026-11-01Z'), 'registration before 30-day boundary');
SELECT pg_temp.assert_rule(NOT public.trial_window_eligible('2026-12-01Z','2026-11-01Z'), 'registration exactly at 30-day boundary');
SELECT pg_temp.assert_rule(NOT public.trial_window_eligible('2026-12-01 00:00:00.001Z','2026-11-01Z'), 'registration after boundary');
SELECT pg_temp.assert_rule(NOT public.trial_window_eligible('2026-10-31Z','2026-11-01Z'), 'prelaunch account excluded');
SELECT pg_temp.assert_rule(public.campaign_access_status('2026-11-01Z','2026-12-01Z',false,'2026-12-01Z')='paused','exact expiry pauses');
SELECT pg_temp.assert_rule(public.campaign_access_status('2026-11-01Z','2026-12-01Z',true,'2026-12-02Z')='paid','verified payment restores access');
INSERT INTO public.launch_campaign(id,started_at) VALUES(true,clock_timestamp()-interval '1 hour');
INSERT INTO auth.users(id,email,email_confirmed_at,created_at) VALUES('00000000-0000-4000-8000-000000000001','campaign.rule.test@gmail.com',now(),now());
SELECT pg_temp.assert_rule((SELECT ends_at-starts_at=interval '720 hours' FROM public.account_trials WHERE user_id='00000000-0000-4000-8000-000000000001'),'30 x 24 hours from registration');
INSERT INTO auth.users(id,email,email_confirmed_at,created_at) VALUES('00000000-0000-4000-8000-000000000002','campaignruletest+alias@gmail.com',now(),now());
SELECT pg_temp.assert_rule(NOT EXISTS(SELECT 1 FROM public.account_trials WHERE user_id='00000000-0000-4000-8000-000000000002'),'repeat email alias denied');
INSERT INTO auth.users(id,email,created_at) VALUES('00000000-0000-4000-8000-000000000003','unconfirmed@example.invalid',now());
SELECT pg_temp.assert_rule(NOT EXISTS(SELECT 1 FROM public.account_trials WHERE user_id='00000000-0000-4000-8000-000000000003'),'unconfirmed email denied');
UPDATE auth.users SET email_confirmed_at=now() WHERE id='00000000-0000-4000-8000-000000000003';
SELECT pg_temp.assert_rule(EXISTS(SELECT 1 FROM public.account_trials WHERE user_id='00000000-0000-4000-8000-000000000003'),'confirmation trigger grants eligible trial');
INSERT INTO public.children(id,user_id,name) VALUES('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','Campaign rule fixture');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(public.has_account_access(),'active trial accessible');
SELECT pg_temp.assert_rule((SELECT count(*)=1 FROM public.children WHERE id='00000000-0000-4000-8000-000000000010'),'active owner reads folder');
DO $$ BEGIN
  BEGIN INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment) VALUES(auth.uid(),'stripe','client-forgery',49900,'SEK','live'); RAISE EXCEPTION 'client forged payment'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.start_launch_campaign(now()); RAISE EXCEPTION 'nonadmin launched'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
UPDATE public.account_trials SET starts_at=now()-interval '720 hours',ends_at=now() WHERE user_id='00000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(NOT public.has_account_access(),'expired trial blocked server-side');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.children),'expired folders hidden by RLS');
DO $$ BEGIN
  BEGIN INSERT INTO public.children(user_id,name) VALUES(auth.uid(),'blocked write'); RAISE EXCEPTION 'expired account wrote'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SELECT pg_temp.assert_rule(EXISTS(SELECT 1 FROM public.children WHERE id='00000000-0000-4000-8000-000000000010'),'paused data retained');
DO $$ BEGIN
  BEGIN INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment) VALUES('00000000-0000-4000-8000-000000000001','stripe','test-payment',49900,'SEK','sandbox'); RAISE EXCEPTION 'test payment accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE public.launch_campaign SET started_at=now() WHERE id=true; RAISE EXCEPTION 'launch reset accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='launch reset accepted' THEN RAISE; END IF; END;
END; $$;
INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment) VALUES('00000000-0000-4000-8000-000000000001','stripe','verified-rule-fixture',49900,'SEK','live');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(public.has_account_access(),'trusted live payment unlocks');
SELECT pg_temp.assert_rule((SELECT count(*)=1 FROM public.children WHERE id='00000000-0000-4000-8000-000000000010'),'paid owner reads retained data');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.children),'other account denied');
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.get_my_campaign_access(); RAISE EXCEPTION 'anonymous RPC accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
ROLLBACK;
SELECT 'Campaign boundary and enforcement tests passed; fixtures rolled back' AS result;