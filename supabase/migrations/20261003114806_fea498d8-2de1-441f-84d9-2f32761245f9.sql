CREATE OR REPLACE FUNCTION public.set_workspace_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT id INTO NEW.workspace_id FROM public.workspaces WHERE owner_id = NEW.user_id;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_workspace_id() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER children_set_workspace BEFORE INSERT ON public.children FOR EACH ROW EXECUTE FUNCTION public.set_workspace_id();
CREATE TRIGGER entries_set_workspace BEFORE INSERT ON public.entries FOR EACH ROW EXECUTE FUNCTION public.set_workspace_id();
CREATE TRIGGER tasks_set_workspace BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_workspace_id();
CREATE TRIGGER documents_set_workspace BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_workspace_id();