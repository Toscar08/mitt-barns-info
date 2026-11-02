CREATE OR REPLACE FUNCTION public.claim_launch_trial(target_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE registered_at timestamptz; confirmed_at timestamptz; user_email text; identity_key text;
BEGIN
 SELECT created_at,email,email_confirmed_at INTO registered_at,user_email,confirmed_at FROM auth.users WHERE id=target_user;
 IF confirmed_at IS NULL OR user_email IS NULL THEN RETURN; END IF;
 SELECT identity_hash INTO identity_key FROM public.trial_claims WHERE claimed_user_id='00000000-0000-0000-0000-000000000000'::uuid;
 IF identity_key IS NULL THEN
   INSERT INTO public.trial_claims(identity_hash,claimed_user_id) VALUES ('salt:'||gen_random_uuid()::text,'00000000-0000-0000-0000-000000000000') ON CONFLICT DO NOTHING;
   SELECT identity_hash INTO identity_key FROM public.trial_claims WHERE claimed_user_id='00000000-0000-0000-0000-000000000000'::uuid ORDER BY claimed_at LIMIT 1;
 END IF;
 user_email:=lower(trim(user_email));
 IF split_part(user_email,'@',2) IN ('gmail.com','googlemail.com') THEN
   user_email:=replace(split_part(split_part(user_email,'@',1),'+',1),'.','')||'@gmail.com';
 END IF;
 identity_key:=encode(digest(identity_key||':'||user_email,'sha256'),'hex');
 INSERT INTO public.trial_claims(identity_hash,claimed_user_id) VALUES(identity_key,target_user) ON CONFLICT DO NOTHING;
 IF EXISTS(SELECT 1 FROM public.trial_claims WHERE identity_hash=identity_key AND claimed_user_id=target_user) THEN
   INSERT INTO public.account_trials(user_id,starts_at,ends_at) VALUES(target_user,registered_at,registered_at+interval '720 hours') ON CONFLICT DO NOTHING;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_launch_trial(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_launch_trial(uuid) TO service_role;