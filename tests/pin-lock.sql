-- Execute against PostgreSQL after migration 0008; all fixtures roll back.
-- Uses a complimentary grant so the account has access, then checks that the PIN gates the data.
BEGIN;
CREATE FUNCTION pg_temp.assert_rule(ok boolean, rule text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',rule; END IF; END; $$;

INSERT INTO auth.users(id, email) VALUES ('00000000-0000-4000-8000-000000000201','pin-lock-test@example.invalid');
INSERT INTO public.complimentary_access(user_id,reason) VALUES ('00000000-0000-4000-8000-000000000201','pin lock test');
INSERT INTO public.workspaces(owner_id,slug,pin_hash) VALUES ('00000000-0000-4000-8000-000000000201','pin-lock-test','pbkdf2$1$00$00');
INSERT INTO public.children(user_id,name) VALUES ('00000000-0000-4000-8000-000000000201','Test');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000201","session_id":"00000000-0000-4000-8000-0000000002aa","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(NOT public.pin_unlocked(),'a session without an unlock is locked');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.children),'locked session sees no folders');
DO $$ BEGIN
  BEGIN INSERT INTO public.pin_unlocks(session_id,user_id,expires_at) VALUES ('00000000-0000-4000-8000-0000000002aa',auth.uid(),clock_timestamp()+interval '1 hour'); RAISE EXCEPTION 'client unlocked itself'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;

-- The server unlocks this session.
INSERT INTO public.pin_unlocks(session_id,user_id,expires_at) VALUES ('00000000-0000-4000-8000-0000000002aa','00000000-0000-4000-8000-000000000201',clock_timestamp()+interval '15 minutes');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule(public.pin_unlocked(),'unlocked session passes');
SELECT pg_temp.assert_rule((SELECT count(*)=1 FROM public.children),'unlocked session sees its folder');
RESET ROLE;

-- Another session of the same account stays locked.
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000201","session_id":"00000000-0000-4000-8000-0000000002bb","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.children),'other session stays locked');
RESET ROLE;

-- An expired unlock locks again.
UPDATE public.pin_unlocks SET expires_at=clock_timestamp()-interval '1 second';
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000201","session_id":"00000000-0000-4000-8000-0000000002aa","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.children),'expired unlock locks the data');
RESET ROLE;

-- Without a PIN the account is open, as before.
UPDATE public.workspaces SET pin_hash=NULL WHERE owner_id='00000000-0000-4000-8000-000000000201';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule((SELECT count(*)=1 FROM public.children),'no PIN means no lock');
RESET ROLE;
ROLLBACK;
