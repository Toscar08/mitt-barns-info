import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, LoaderCircle, LogOut, Share2, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFamily } from "@/lib/family";
import {
  changeMemberRole,
  createInvite,
  leaveFamily,
  MAX_MEMBERS,
  removeMember,
  revokeInvite,
  type FamilyRole,
} from "@/lib/family.functions";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

const copy = {
  sv: {
    heading: "Dela med familjen",
    lead: "Bjud in den andra vårdnadshavaren, mor- och farföräldrar eller barnvakten. De loggar in med eget konto och ser samma barnmappar.",
    who: "Vem bjuder du in?",
    whoPlaceholder: "T.ex. Pappa, Mormor, Barnvakten",
    role: "Vad får de göra?",
    editor: "Kan ändra",
    editorHelp: "Lägga till, ändra och ta bort. För den andra vårdnadshavaren.",
    viewer: "Kan bara läsa",
    viewerHelp: "Se allt men inte ändra. För mor- och farföräldrar och barnvakt.",
    create: "Skapa inbjudningslänk",
    link: "Skicka länken till personen. Den fungerar en gång och i sju dagar.",
    copy: "Kopiera",
    copied: "Kopierad",
    share: "Dela",
    done: "Klar",
    members: "Med i familjen",
    pending: "Väntar på svar",
    noOne: "Ingen är inbjuden än.",
    remove: "Ta bort",
    revoke: "Dra tillbaka",
    unnamed: "Utan namn",
    full: `Du delar redan med ${MAX_MEMBERS} personer, som är max.`,
    joined: "Du är med i",
    leave: "Lämna",
    leaveConfirm: (name: string) => `Lämna ${name}? Du ser inte längre deras barnmappar.`,
    paused: "Familjens åtkomst är pausad tills ägaren betalar.",
    notReady: "Delning aktiveras när databasen är uppdaterad.",
    shareText: "Du är inbjuden till vår Barnmappen",
  },
  en: {
    heading: "Share with family",
    lead: "Invite the other guardian, grandparents or the babysitter. They sign in with their own account and see the same folders.",
    who: "Who are you inviting?",
    whoPlaceholder: "E.g. Dad, Grandma, Babysitter",
    role: "What may they do?",
    editor: "Can edit",
    editorHelp: "Add, change and remove. For the other guardian.",
    viewer: "Read only",
    viewerHelp: "See everything but change nothing. For grandparents and babysitters.",
    create: "Create invitation link",
    link: "Send the link to the person. It works once and for seven days.",
    copy: "Copy",
    copied: "Copied",
    share: "Share",
    done: "Done",
    members: "In the family",
    pending: "Waiting for reply",
    noOne: "Nobody is invited yet.",
    remove: "Remove",
    revoke: "Withdraw",
    unnamed: "Unnamed",
    full: `You already share with ${MAX_MEMBERS} people, the maximum.`,
    joined: "You are part of",
    leave: "Leave",
    leaveConfirm: (name: string) => `Leave ${name}? You will no longer see their folders.`,
    paused: "The family's access is paused until the owner pays.",
    notReady: "Sharing switches on once the database is updated.",
    shareText: "You are invited to our Barnmappen",
  },
} as const;

/** Settings panel: invite people into this family, see who is in it, and families one has joined. */
export function FamilySharing({ isOwner }: { isOwner: boolean }) {
  const { lang } = usePrefs();
  const c = copy[lang];
  const family = useFamily();
  const queryClient = useQueryClient();
  const invite = useServerFn(createInvite);
  const revoke = useServerFn(revokeInvite);
  const remove = useServerFn(removeMember);
  const change = useServerFn(changeMemberRole);
  const leave = useServerFn(leaveFamily);

  const [label, setLabel] = useState("");
  const [role, setRole] = useState<FamilyRole>("editor");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["family"] });
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { token } = await invite({ data: { role, label: label.trim() || undefined } });
      setLink(`${window.location.origin}/inbjudan/${token}`);
      setCopied(false);
      setLabel("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast.error(lang === "sv" ? "Kunde inte kopiera." : "Couldn't copy.");
    }
  }

  const data = family.data;
  if (!data) return null;
  const owned = data.owned;
  const taken = (owned?.members.length ?? 0) + (owned?.invites.length ?? 0);
  const roleName = (r: FamilyRole) => (r === "editor" ? c.editor : c.viewer);

  return (
    <section className="surface space-y-4 p-6">
      <h2 className="flex items-center gap-3 text-xl">
        <span className="grid size-9 shrink-0 place-content-center rounded-full bg-accent/15 text-accent">
          <Users className="size-4.5" aria-hidden />
        </span>
        {c.heading}
      </h2>

      {!data.ready && <p className="text-sm text-muted-foreground">{c.notReady}</p>}

      {data.ready && isOwner && owned && (
        <>
          <p className="text-sm text-muted-foreground">{c.lead}</p>

          {link ? (
            <div className="well pop space-y-3 p-4">
              <p className="text-sm">{c.link}</p>
              <p className="rounded-xl bg-[var(--glass-field)] px-3 py-2 font-mono text-xs break-all">{link}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="pop" onClick={() => void copyLink()}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? c.copied : c.copy}
                </Button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <Button size="sm" variant="outline" onClick={() => void navigator.share({ title: "Barnmappen", text: c.shareText, url: link }).catch(() => undefined)}>
                    <Share2 aria-hidden />
                    {c.share}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
                  {c.done}
                </Button>
              </div>
            </div>
          ) : taken >= MAX_MEMBERS ? (
            <p className="text-sm text-muted-foreground">{c.full}</p>
          ) : (
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-label">{c.who}</Label>
                <Input id="invite-label" value={label} maxLength={60} placeholder={c.whoPlaceholder} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm leading-none font-medium">{c.role}</legend>
                <div className="grid gap-2 pt-1 sm:grid-cols-2" role="radiogroup">
                  {(["editor", "viewer"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={role === option}
                      onClick={() => setRole(option)}
                      className={cn(
                        "pressable cursor-pointer rounded-2xl border p-3.5 text-left transition-colors duration-200 ease-out",
                        role === option ? "border-accent bg-accent/8 shadow-[0_0_0_1px_var(--accent)]" : "border-input bg-[var(--glass-field)] hover:border-accent/60",
                      )}
                    >
                      <span className="block font-medium">{roleName(option)}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{option === "editor" ? c.editorHelp : c.viewerHelp}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
                {c.create}
              </Button>
            </form>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-medium">{c.members}</h3>
            {owned.members.length === 0 && owned.invites.length === 0 && <p className="text-sm text-muted-foreground">{c.noOne}</p>}
            <ul className="divide-y divide-border">
              {owned.members.map((member) => (
                <li key={member.userId} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-medium">{member.label || c.unnamed}</span>
                  <select
                    value={member.role}
                    aria-label={c.role}
                    onChange={(e) => void run(() => change({ data: { userId: member.userId, role: e.target.value as FamilyRole } }))}
                    className="field h-9 cursor-pointer rounded-full px-3 text-[13px] font-medium"
                  >
                    <option value="editor">{c.editor}</option>
                    <option value="viewer">{c.viewer}</option>
                  </select>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => void run(() => remove({ data: { userId: member.userId } }))}>
                    {c.remove}
                  </Button>
                </li>
              ))}
              {owned.invites.map((pending) => (
                <li key={pending.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{pending.label || c.unnamed}</span>
                    <span className="block text-xs text-muted-foreground">{c.pending} · {roleName(pending.role)}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void run(() => revoke({ data: { id: pending.id } }))}>
                    <X aria-hidden />
                    {c.revoke}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {data.ready && data.joined.length > 0 && (
        <div className={cn("space-y-2", isOwner && owned && "border-t border-border pt-4")}>
          {data.joined.map((f) => (
            <div key={f.workspaceId} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm">
                  {c.joined} <span className="font-medium">{f.name}</span> · {roleName(f.role)}
                </span>
                {!f.active && <span className="block text-xs text-destructive">{c.paused}</span>}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(c.leaveConfirm(f.name))) void run(() => leave({ data: { workspaceId: f.workspaceId } }));
                }}
              >
                <LogOut aria-hidden />
                {c.leave}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
