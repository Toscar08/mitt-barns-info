CREATE TABLE public.launch_campaign (
 id boolean PRIMARY KEY DEFAULT true CONSTRAINT launch_campaign_singleton CHECK (id),
 started_at timestamptz, started_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.launch_campaign TO authenticated;
GRANT ALL ON public.launch_campaign TO service_role;
ALTER TABLE public.launch_campaign ENABLE ROW LEVEL SECURITY;
CREATE POLICY launch_campaign_read ON public.launch_campaign FOR SELECT TO authenticated USING (true);

CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role public.app_role NOT NULL, UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_read_own ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;

CREATE TABLE public.trial_claims (
 identity_hash text PRIMARY KEY, claimed_user_id uuid NOT NULL, claimed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.trial_claims TO service_role;
ALTER TABLE public.trial_claims ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.account_trials (
 user_id uuid PRIMARY KEY, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT trial_exact_duration CHECK(ends_at=starts_at+interval '720 hours')
);
GRANT SELECT ON public.account_trials TO authenticated;
GRANT ALL ON public.account_trials TO service_role;
ALTER TABLE public.account_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_trials_read_own ON public.account_trials FOR SELECT TO authenticated USING(user_id=auth.uid());

CREATE TABLE public.verified_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 provider text NOT NULL CONSTRAINT verified_provider CHECK(provider='stripe'),
 provider_reference text NOT NULL UNIQUE, amount_cents integer NOT NULL CONSTRAINT payment_amount CHECK(amount_cents=49900),
 currency text NOT NULL CONSTRAINT payment_currency CHECK(currency='SEK'),
 environment text NOT NULL CONSTRAINT payment_live CHECK(environment='live'),
 verified_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
GRANT SELECT ON public.verified_payments TO authenticated;
GRANT ALL ON public.verified_payments TO service_role;
ALTER TABLE public.verified_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY verified_payments_read_own ON public.verified_payments FOR SELECT TO authenticated USING(user_id=auth.uid());
COMMENT ON TABLE public.verified_payments IS 'Trusted live Stripe verification only. No client writes. Populate only after provider verification; no test purchases.';

CREATE FUNCTION public.trial_window_eligible(registered_at timestamptz,launch_at timestamptz) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(launch_at IS NOT NULL AND registered_at>=launch_at AND registered_at<launch_at+interval '720 hours',false);
$$;
CREATE FUNCTION public.campaign_access_status(launch_at timestamptz,trial_end timestamptz,verified_paid boolean,at_time timestamptz) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN verified_paid THEN 'paid' WHEN trial_end IS NOT NULL AND at_time<trial_end THEN 'trial' WHEN launch_at IS NULL THEN 'launch_pending' ELSE 'paused' END;
$$;
REVOKE ALL ON FUNCTION public.trial_window_eligible(timestamptz,timestamptz), public.campaign_access_status(timestamptz,timestamptz,boolean,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.trial_window_eligible(timestamptz,timestamptz), public.campaign_access_status(timestamptz,timestamptz,boolean,timestamptz) TO authenticated,service_role;

CREATE FUNCTION public.claim_launch_trial(target_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE launch_at timestamptz; registered_at timestamptz; confirmed_at timestamptz; user_email text; identity_key text;
BEGIN
 SELECT started_at INTO launch_at FROM public.launch_campaign WHERE id=true;
 SELECT created_at,email,email_confirmed_at INTO registered_at,user_email,confirmed_at FROM auth.users WHERE id=target_user;
 IF confirmed_at IS NULL OR user_email IS NULL OR NOT public.trial_window_eligible(registered_at,launch_at) THEN RETURN; END IF;
 -- Salt is a server-only random value in the protected registry. It is never returned to clients.
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
CREATE UNIQUE INDEX trial_registry_one_salt ON public.trial_claims(claimed_user_id) WHERE claimed_user_id='00000000-0000-0000-0000-000000000000'::uuid;

CREATE FUNCTION public.on_launch_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.claim_launch_trial(NEW.id); RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.on_launch_registration() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER launch_trial_registration AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.on_launch_registration();

CREATE FUNCTION public.has_account_access() RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (
 EXISTS(SELECT 1 FROM public.account_trials WHERE user_id=auth.uid() AND clock_timestamp()<ends_at)
 OR EXISTS(SELECT 1 FROM public.verified_payments WHERE user_id=auth.uid() AND revoked_at IS NULL)
 );
$$;
REVOKE ALL ON FUNCTION public.has_account_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_account_access() TO authenticated,service_role;

CREATE FUNCTION public.get_my_campaign_access() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE launch_at timestamptz; trial_row public.account_trials; paid boolean; server_now timestamptz; status text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 PERFORM public.claim_launch_trial(auth.uid());
 SELECT started_at INTO launch_at FROM public.launch_campaign WHERE id=true;
 SELECT * INTO trial_row FROM public.account_trials WHERE user_id=auth.uid();
 SELECT EXISTS(SELECT 1 FROM public.verified_payments WHERE user_id=auth.uid() AND revoked_at IS NULL) INTO paid;
 server_now:=clock_timestamp();
 status:=public.campaign_access_status(launch_at,trial_row.ends_at,paid,server_now);
 RETURN jsonb_build_object('status',status,'serverNow',server_now,'launchStartedAt',launch_at,'trialStartsAt',trial_row.starts_at,'trialEndsAt',trial_row.ends_at,'remainingSeconds',CASE WHEN trial_row.ends_at IS NULL THEN 0 ELSE greatest(0,extract(epoch FROM trial_row.ends_at-server_now)) END,'isAdmin',public.has_role(auth.uid(),'admin'));
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_campaign_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_campaign_access() TO authenticated;

CREATE FUNCTION public.start_launch_campaign(launch_at timestamptz) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved_at timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF launch_at IS NULL OR launch_at>clock_timestamp() THEN RAISE EXCEPTION 'Launch time must be the actual first publication time'; END IF;
 INSERT INTO public.launch_campaign(id,started_at,started_by) VALUES(true,launch_at,auth.uid()) ON CONFLICT(id) DO NOTHING RETURNING started_at INTO saved_at;
 IF saved_at IS NULL THEN RAISE EXCEPTION 'Launch already started; cannot restart'; END IF;
 RETURN saved_at;
END;
$$;
REVOKE ALL ON FUNCTION public.start_launch_campaign(timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_launch_campaign(timestamptz) TO authenticated;

CREATE FUNCTION public.provision_my_workspace(new_slug text,new_name text DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing_slug text; ws_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 PERFORM public.claim_launch_trial(auth.uid());
 IF NOT public.has_account_access() THEN RAISE EXCEPTION 'access_required' USING ERRCODE='42501'; END IF;
 SELECT slug INTO existing_slug FROM public.workspaces WHERE owner_id=auth.uid();
 IF existing_slug IS NOT NULL THEN RETURN existing_slug; END IF;
 IF new_slug !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' OR length(coalesce(new_name,''))>80 THEN RAISE EXCEPTION 'format'; END IF;
 INSERT INTO public.workspaces(owner_id,slug,display_name) VALUES(auth.uid(),new_slug,nullif(new_name,'')) RETURNING id INTO ws_id;
 UPDATE public.children SET workspace_id=ws_id WHERE user_id=auth.uid() AND workspace_id IS NULL;
 UPDATE public.entries SET workspace_id=ws_id WHERE user_id=auth.uid() AND workspace_id IS NULL;
 UPDATE public.tasks SET workspace_id=ws_id WHERE user_id=auth.uid() AND workspace_id IS NULL;
 UPDATE public.documents SET workspace_id=ws_id WHERE user_id=auth.uid() AND workspace_id IS NULL;
 RETURN new_slug;
END;
$$;
REVOKE ALL ON FUNCTION public.provision_my_workspace(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.provision_my_workspace(text,text) TO authenticated;

CREATE POLICY children_active_access ON public.children AS RESTRICTIVE FOR ALL TO authenticated USING(public.has_account_access()) WITH CHECK(public.has_account_access());
CREATE POLICY entries_active_access ON public.entries AS RESTRICTIVE FOR ALL TO authenticated USING(public.has_account_access()) WITH CHECK(public.has_account_access());
CREATE POLICY tasks_active_access ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated USING(public.has_account_access()) WITH CHECK(public.has_account_access());
CREATE POLICY documents_active_access ON public.documents AS RESTRICTIVE FOR ALL TO authenticated USING(public.has_account_access()) WITH CHECK(public.has_account_access());
CREATE POLICY child_docs_active_access ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING(bucket_id<>'child-documents' OR public.has_account_access()) WITH CHECK(bucket_id<>'child-documents' OR public.has_account_access());