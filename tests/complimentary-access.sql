-- Execute against PostgreSQL; all fixtures roll back.
BEGIN;
CREATE FUNCTION pg_temp.assert_rule(ok boolean, rule text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',rule; END IF; END; $$;
INSERT INTO public.complimentary_access(user_id,reason) VALUES ('00000000-0000-4000-8000-000000000091','complimentary test fixture');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(public.has_account_access(),'complimentary account gets private access');
SELECT pg_temp.assert_rule(public.get_my_campaign_access()->>'status'='complimentary','free access is not recorded as paid or trial');
SELECT pg_temp.assert_rule(NOT public.has_role(auth.uid(),'admin'),'complimentary access does not grant admin privileges');
DO $$ BEGIN
 BEGIN INSERT INTO public.complimentary_access(user_id,reason) VALUES(auth.uid(),'forged'); RAISE EXCEPTION 'client forged free access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.complimentary_access SET revoked_at=NULL WHERE user_id=auth.uid(); RAISE EXCEPTION 'client edited free access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(NOT public.has_account_access(),'other account gains no access');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.complimentary_access),'grant remains private to its account');
RESET ROLE;
UPDATE public.complimentary_access SET revoked_at=clock_timestamp() WHERE user_id='00000000-0000-4000-8000-000000000091';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(NOT public.has_account_access(),'revoking complimentary access blocks access');
RESET ROLE;
ROLLBACK;