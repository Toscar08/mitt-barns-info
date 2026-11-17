import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "child-documents";

const DeleteInput = z.object({
  // Typed by hand in the dialog, so a stray click can never delete an account.
  confirm: z.enum(["RADERA", "DELETE"]),
  pin: z.string().max(8).optional(),
});

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: "pin_required" | "wrong_pin" | "locked" | "failed" };

/** Every file stored under the user's own folder in Storage, at any depth. */
async function storedFiles(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const files: string[] = [];
  const pending = [userId];
  while (pending.length) {
    const folder = pending.pop()!;
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(folder, { limit: 100, offset });
      if (error) throw new Error(error.message);
      for (const item of data) {
        // Folders come back without an id.
        if (item.id) files.push(`${folder}/${item.name}`);
        else pending.push(`${folder}/${item.name}`);
      }
      if (data.length < 100) break;
    }
  }
  return files;
}

/**
 * Deletes the signed-in account and everything in it: folders, notes, tasks, calendar links,
 * uploaded files, the private site and the login itself.
 *
 * Kept on purpose, without any folder content:
 * - verified_payments: Swedish bookkeeping law requires payment records for seven years.
 * - trial_claims: a salted hash of the e-mail, so a new account cannot claim a second free trial.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }): Promise<DeleteAccountResult> => {
    const userId = context.userId;

    // The PIN is checked here on the server, not only by the lock screen,
    // so a borrowed unlocked session is not enough to wipe the account.
    const { data: workspace } = await context.supabase
      .from("workspaces")
      .select("pin_hash")
      .eq("owner_id", userId)
      .maybeSingle();
    if (workspace?.pin_hash) {
      if (!data.pin) return { ok: false, error: "pin_required" };
      const { attemptPin } = await import("@/lib/pin-attempt.server");
      const result = await attemptPin(userId, data.pin);
      if (!result.ok) return { ok: false, error: result.locked ? "locked" : "wrong_pin" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      // Files first: once the login is gone nothing would point to them any more.
      const files = await storedFiles(userId);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await supabaseAdmin.storage.from(BUCKET).remove(files.slice(i, i + 100));
        if (error) throw new Error(error.message);
      }

      // Rows tied to the user id without a foreign key, so they would outlive the login.
      for (const table of ["child_calendars", "account_trials", "complimentary_access"] as const) {
        const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
        if (error) throw new Error(error.message);
      }

      // Removing the login cascades to children, entries, tasks, documents, workspaces and roles.
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (error) {
      console.error("account deletion failed", error);
      return { ok: false, error: "failed" };
    }
  });
