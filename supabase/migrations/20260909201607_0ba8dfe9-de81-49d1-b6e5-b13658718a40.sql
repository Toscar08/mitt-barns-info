CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name text,
  pin_hash text,
  activated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_slug_format CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'),
  CONSTRAINT workspaces_slug_reserved CHECK (slug NOT IN ('admin','api','auth','app','www','login','signup','activate','buy','kop','köp','barn','support','help','status','static','assets','public','settings','account','dashboard','barnmappen','root','system','security','privacy','terms'))
);

GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_select_own ON public.workspaces FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY workspaces_update_own ON public.workspaces FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  email text,
  status text NOT NULL DEFAULT 'unused',
  provider text,
  provider_reference text,
  amount_cents integer,
  currency text,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activation_codes_status_check CHECK (status IN ('unused','used','revoked'))
);

GRANT ALL ON public.activation_codes TO service_role;
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX activation_codes_code_idx ON public.activation_codes (code);

ALTER TABLE public.children ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.entries ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX children_workspace_idx ON public.children (workspace_id);
CREATE INDEX entries_workspace_idx ON public.entries (workspace_id);
CREATE INDEX tasks_workspace_idx ON public.tasks (workspace_id);
CREATE INDEX documents_workspace_idx ON public.documents (workspace_id);