-- Family sharing. The owner of a workspace can let other people into it: a second guardian who
-- may change things ("editor"), or grandparents and a babysitter who may only read ("viewer").
-- Shared rows keep belonging to the owner (user_id = owner), so nothing is lost if a member
-- leaves or deletes their own account. The owner's subscription covers everyone in the family.

CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CONSTRAINT member_role CHECK (role IN ('editor', 'viewer')),
  label text CONSTRAINT member_label CHECK (label IS NULL OR length(label) <= 60),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user ON public.workspace_members (user_id);
REVOKE ALL ON public.workspace_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Single-use invitation links. Only a hash of the link's secret is stored. Server-only.
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  role text NOT NULL CONSTRAINT invite_role CHECK (role IN ('editor', 'viewer')),
  label text CONSTRAINT invite_label CHECK (label IS NULL OR length(label) <= 60),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX workspace_invites_workspace ON public.workspace_invites (workspace_id);
REVOKE ALL ON public.workspace_invites FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.workspace_invites TO service_role;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- The caller's place in the family that `owner` runs: 'owner', 'editor', 'viewer' or NULL.
CREATE OR REPLACE FUNCTION public.family_role(owner uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE
   WHEN auth.uid() IS NULL OR owner IS NULL THEN NULL
   WHEN auth.uid() = owner THEN 'owner'
   ELSE (SELECT m.role FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
         WHERE w.owner_id = owner AND m.user_id = auth.uid())
 END;
$$;
REVOKE ALL ON FUNCTION public.family_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_role(uuid) TO authenticated, service_role;

-- True when the caller belongs to that family and the family's owner has access (trial, payment
-- or grant). Answers nothing about families the caller is not part of.
CREATE OR REPLACE FUNCTION public.family_open(owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.family_role(owner) IS NOT NULL AND (
   EXISTS(SELECT 1 FROM public.account_trials WHERE user_id = owner AND clock_timestamp() < ends_at)
   OR EXISTS(SELECT 1 FROM public.verified_payments WHERE user_id = owner AND revoked_at IS NULL AND (access_until IS NULL OR clock_timestamp() < access_until))
   OR EXISTS(SELECT 1 FROM public.complimentary_access WHERE user_id = owner AND revoked_at IS NULL)
 );
$$;
REVOKE ALL ON FUNCTION public.family_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_open(uuid) TO authenticated, service_role;

-- Files live under "<owner id>/<child id>/<file>". Reads the owner id, or NULL for anything else.
CREATE OR REPLACE FUNCTION public.storage_owner(object_name text) RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN split_part(object_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$' THEN split_part(object_name, '/', 1)::uuid END;
$$;
GRANT EXECUTE ON FUNCTION public.storage_owner(text) TO authenticated, service_role;

-- The families the caller has joined, for the app to show and to let members in.
CREATE OR REPLACE FUNCTION public.my_families() RETURNS TABLE (workspace_id uuid, owner_id uuid, family_name text, role text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT w.id, w.owner_id, coalesce(w.display_name, w.slug), m.role, public.family_open(w.owner_id)
 FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
 WHERE m.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_families() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_families() TO authenticated;

-- The app may be used when the caller's own account has access, or a family they joined has.
CREATE OR REPLACE FUNCTION public.can_use_app() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.has_account_access() OR EXISTS(SELECT 1 FROM public.my_families() f WHERE f.active);
$$;
REVOKE ALL ON FUNCTION public.can_use_app() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_app() TO authenticated;

-- Members see who else is in their family; the owner sees everyone in theirs.
CREATE POLICY workspace_members_read ON public.workspace_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS(SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

-- Notes, tasks and documents always belong to the child's owner, whoever writes them, so a
-- member's work stays in the family folder. Moving a row to another child re-checks the owner.
CREATE OR REPLACE FUNCTION public.owner_from_child() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  SELECT c.user_id, c.workspace_id INTO NEW.user_id, NEW.workspace_id FROM public.children c WHERE c.id = NEW.child_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_from_child() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER entries_a_owner_from_child BEFORE INSERT OR UPDATE OF child_id ON public.entries FOR EACH ROW EXECUTE FUNCTION public.owner_from_child();
CREATE TRIGGER tasks_a_owner_from_child BEFORE INSERT OR UPDATE OF child_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.owner_from_child();
CREATE TRIGGER documents_a_owner_from_child BEFORE INSERT OR UPDATE OF child_id ON public.documents FOR EACH ROW EXECUTE FUNCTION public.owner_from_child();

-- What members may do. These add to the owner's own policies; viewers only read.
CREATE POLICY children_family_read ON public.children FOR SELECT TO authenticated USING (public.family_role(user_id) IN ('editor', 'viewer'));
CREATE POLICY children_family_edit ON public.children FOR UPDATE TO authenticated USING (public.family_role(user_id) = 'editor') WITH CHECK (public.family_role(user_id) = 'editor');

CREATE POLICY entries_family_read ON public.entries FOR SELECT TO authenticated USING (public.family_role(user_id) IN ('editor', 'viewer'));
CREATE POLICY entries_family_add ON public.entries FOR INSERT TO authenticated WITH CHECK (public.family_role(user_id) = 'editor');
CREATE POLICY entries_family_edit ON public.entries FOR UPDATE TO authenticated USING (public.family_role(user_id) = 'editor') WITH CHECK (public.family_role(user_id) = 'editor');
CREATE POLICY entries_family_remove ON public.entries FOR DELETE TO authenticated USING (public.family_role(user_id) = 'editor');

CREATE POLICY tasks_family_read ON public.tasks FOR SELECT TO authenticated USING (public.family_role(user_id) IN ('editor', 'viewer'));
CREATE POLICY tasks_family_add ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.family_role(user_id) = 'editor');
CREATE POLICY tasks_family_edit ON public.tasks FOR UPDATE TO authenticated USING (public.family_role(user_id) = 'editor') WITH CHECK (public.family_role(user_id) = 'editor');
CREATE POLICY tasks_family_remove ON public.tasks FOR DELETE TO authenticated USING (public.family_role(user_id) = 'editor');

CREATE POLICY documents_family_read ON public.documents FOR SELECT TO authenticated USING (public.family_role(user_id) IN ('editor', 'viewer'));
CREATE POLICY documents_family_add ON public.documents FOR INSERT TO authenticated WITH CHECK (public.family_role(user_id) = 'editor');
CREATE POLICY documents_family_remove ON public.documents FOR DELETE TO authenticated USING (public.family_role(user_id) = 'editor');

CREATE POLICY child_docs_family_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'child-documents' AND public.family_role(public.storage_owner(name)) IN ('editor', 'viewer'));
CREATE POLICY child_docs_family_add ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'child-documents' AND public.family_role(public.storage_owner(name)) = 'editor');
CREATE POLICY child_docs_family_remove ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'child-documents' AND public.family_role(public.storage_owner(name)) = 'editor');

-- Access follows the row's family: open when that family's owner has access and the caller
-- belongs to it. For the owner's own rows this is exactly the old has_account_access() rule.
DROP POLICY children_active_access ON public.children;
DROP POLICY entries_active_access ON public.entries;
DROP POLICY tasks_active_access ON public.tasks;
DROP POLICY documents_active_access ON public.documents;
DROP POLICY child_docs_active_access ON storage.objects;
CREATE POLICY children_active_access ON public.children AS RESTRICTIVE FOR ALL TO authenticated USING (public.family_open(user_id)) WITH CHECK (public.family_open(user_id));
CREATE POLICY entries_active_access ON public.entries AS RESTRICTIVE FOR ALL TO authenticated USING (public.family_open(user_id)) WITH CHECK (public.family_open(user_id));
CREATE POLICY tasks_active_access ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated USING (public.family_open(user_id)) WITH CHECK (public.family_open(user_id));
CREATE POLICY documents_active_access ON public.documents AS RESTRICTIVE FOR ALL TO authenticated USING (public.family_open(user_id)) WITH CHECK (public.family_open(user_id));
CREATE POLICY child_docs_active_access ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id <> 'child-documents' OR public.family_open(public.storage_owner(name)))
  WITH CHECK (bucket_id <> 'child-documents' OR public.family_open(public.storage_owner(name)));
