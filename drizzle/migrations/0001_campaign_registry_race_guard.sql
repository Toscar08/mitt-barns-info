CREATE FUNCTION public.lock_trial_registry() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN PERFORM pg_advisory_xact_lock(81726041); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.lock_trial_registry() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trial_registry_serial BEFORE INSERT ON public.trial_claims FOR EACH STATEMENT EXECUTE FUNCTION public.lock_trial_registry();
CREATE FUNCTION public.prevent_launch_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Permanent launch timestamp cannot be changed or removed'; END; $$;
REVOKE ALL ON FUNCTION public.prevent_launch_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER launch_campaign_immutable BEFORE UPDATE OR DELETE ON public.launch_campaign FOR EACH ROW EXECUTE FUNCTION public.prevent_launch_change();