type RpcClient = {
  rpc: (fn: "can_use_app" | "has_account_access") => PromiseLike<{ data: boolean | null; error: unknown }>;
};

/**
 * Whether the caller may use the app's server features: their own access, or a family they have
 * joined (migration 0009). Falls back to the account's own access before that migration exists.
 */
export async function canUseApp(supabase: RpcClient) {
  const shared = await supabase.rpc("can_use_app");
  if (!shared.error) return shared.data === true;
  const own = await supabase.rpc("has_account_access");
  return !own.error && own.data === true;
}
