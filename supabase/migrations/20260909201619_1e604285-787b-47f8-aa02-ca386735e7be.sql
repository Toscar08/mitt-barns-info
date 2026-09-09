GRANT SELECT ON public.activation_codes TO authenticated;
CREATE POLICY activation_codes_select_own ON public.activation_codes
  FOR SELECT TO authenticated
  USING (used_by = auth.uid());