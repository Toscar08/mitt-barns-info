<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Campaign entitlements live in protected account_trials and verified_payments tables, not owner-editable workspaces; restrictive RLS covers every private table and Storage.
- Account access is derived from database time, without recurring jobs; this preserves exact expiry without idle polling costs.
- Only authenticated admin RPC may save the actual first publication timestamp once; never start campaigns from page loads or republishing.
- Keep trial identity hashes in a server-only salted registry; email aliases are normalized without device fingerprinting or collection of identity documents.
- Live Stripe verification is the only paid entitlement source; test activation codes must not grant access.
- Complimentary access is stored in a separate protected grant table and checked by both access RPCs; this avoids fabricated payments or administrator privileges.
- Subscriptions: each signature-verified live `invoice.paid` stores one verified_payments row (plan monthly 3900 / yearly 34900 öre) with access_until = period end + 3 days; lifetime 49900 rows keep access_until NULL. Prices live in src/lib/pricing.ts and the payment_plan CHECK, and must change together.
