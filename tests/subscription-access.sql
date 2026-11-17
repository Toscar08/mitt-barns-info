-- Execute against PostgreSQL after migration 0006; all fixtures roll back.
BEGIN;
CREATE FUNCTION pg_temp.assert_rule(ok boolean, rule text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',rule; END IF; END; $$;

-- A current monthly period grants access and reports its end.
INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment,plan,access_until)
 VALUES ('00000000-0000-4000-8000-000000000101','stripe','in_test_current',3900,'SEK','live','monthly',clock_timestamp()+interval '20 days');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(public.has_account_access(),'current subscription period grants access');
SELECT pg_temp.assert_rule(public.get_my_campaign_access()->>'paidPlan'='monthly','plan is reported');
SELECT pg_temp.assert_rule(public.get_my_campaign_access()->>'paidUntil' IS NOT NULL,'period end is reported');
RESET ROLE;

-- An expired period no longer grants access.
INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment,plan,access_until)
 VALUES ('00000000-0000-4000-8000-000000000102','stripe','in_test_expired',34900,'SEK','live','yearly',clock_timestamp()-interval '1 day');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(NOT public.has_account_access(),'expired subscription period blocks access');
RESET ROLE;

-- Earlier one-time purchases keep lifetime access.
INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment,plan)
 VALUES ('00000000-0000-4000-8000-000000000103','stripe','cs_test_lifetime',49900,'SEK','live','lifetime');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(public.has_account_access(),'lifetime purchase keeps access');
RESET ROLE;

-- Amounts that match no plan are refused by the database itself.
DO $$ BEGIN
 BEGIN
  INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment,plan,access_until)
   VALUES ('00000000-0000-4000-8000-000000000104','stripe','in_test_wrong',100,'SEK','live','monthly',clock_timestamp()+interval '1 day');
  RAISE EXCEPTION 'wrong amount accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment,plan)
   VALUES ('00000000-0000-4000-8000-000000000105','stripe','in_test_open',3900,'SEK','live','monthly');
  RAISE EXCEPTION 'subscription without end accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END; $$;

-- Clients still cannot write payments.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000106',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.verified_payments(user_id,provider,provider_reference,amount_cents,currency,environment,plan,access_until)
   VALUES (auth.uid(),'stripe','in_forged',3900,'SEK','live','monthly',clock_timestamp()+interval '30 days');
  RAISE EXCEPTION 'client forged a payment';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
ROLLBACK;
