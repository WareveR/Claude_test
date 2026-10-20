import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError, type Role } from "../api";
import { useSignedIn } from "../family";
import { usePersons, type Person } from "../persons/model";
import { ErrorText, Field, SubmitButton, TextInput } from "../screens/form";
import { BUTTON, BUTTON_DANGER } from "../ui/button";

type Member = {
  id: string;
  email: string;
  role: Role;
  dev: boolean;
  personId: string | null;
  /** Invited, but the invite link was not used yet. */
  pending: boolean;
};

const SELECT = "rounded-md border border-line bg-surface px-3 py-2";

function errorKey(error: Error) {
  if (!(error instanceof ApiError)) return "errors.network";
  const code = error.body.error;
  if (code === "email_taken") return "recovery.emailTaken";
  if (code === "person_taken") return "account.personTaken";
  if (code === "email_failed") return "members.emailFailed";
  if (code === "invalid" && error.body.field === "email") return "setup.invalid.email";
  return "errors.unexpected";
}

/** The Persons an Account can be for: active ones without another Account. */
function freePersons(persons: Person[], members: Member[], keep: string | null) {
  const taken = new Set(members.map((m) => m.personId).filter((id) => id && id !== keep));
  return persons.filter((p) => (!p.archived || p.id === keep) && !taken.has(p.id));
}

/** Settings › Família › Membros: the adults who sign in, for the Owner and Admins. */
export function MembersSection() {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const members = useQuery({
    queryKey: ["members"],
    queryFn: () => api<Member[]>("/members"),
    enabled: account.role !== "member",
  });
  const persons = usePersons();
  if (account.role === "member") return null;
  const list = members.data ?? [];
  const everyone = persons.data ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("members.title")}</h2>
      <p className="text-sm text-muted">{t("members.hint")}</p>
      <ul className="flex flex-col gap-2">
        {list.map((m) => (
          <MemberRow key={m.id} member={m} members={list} persons={everyone} />
        ))}
      </ul>
      <InviteForm members={list} persons={everyone} />
    </section>
  );
}

function MemberRow({
  member,
  members,
  persons,
}: {
  member: Member;
  members: Member[];
  persons: Person[];
}) {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const queryClient = useQueryClient();
  const [sent, setSent] = useState(false);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["members"] });
    if (member.id === account.id) queryClient.invalidateQueries({ queryKey: ["status"] });
  };
  const change = useMutation({
    mutationFn: (body: Partial<Member>) => api(`/members/${member.id}`, { method: "PATCH", body }),
    onSuccess: refresh,
  });
  const reset = useMutation({
    mutationFn: () => api(`/members/${member.id}/reset`, { method: "POST", body: {} }),
    onSuccess: () => setSent(true),
  });
  const remove = useMutation({
    mutationFn: () => api(`/members/${member.id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const handOver = useMutation({
    mutationFn: () => api(`/members/${member.id}/owner`, { method: "POST", body: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });
  const person = persons.find((p) => p.id === member.personId);
  const isMe = member.id === account.id;
  const isOwner = member.role === "owner";
  // Only the Owner changes the Owner's Account.
  const editable = !isOwner || account.role === "owner";
  const error = change.error ?? reset.error ?? remove.error ?? handOver.error;

  return (
    <li data-testid="member" className="rounded-md border border-line">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
          <ChevronDown
            aria-hidden
            size={16}
            className="-rotate-90 transition-transform group-open:rotate-0"
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{person?.name ?? member.email}</span>
            {person && <span className="text-muted"> · {member.email}</span>}
          </span>
          <span className="text-muted">
            {member.pending ? t("members.pending") : t(`account.roles.${member.role}`)}
            {member.dev && " · Dev"}
          </span>
        </summary>
        {editable && (
          <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
            <Field label={t("account.person")}>
              <select
                className={SELECT}
                value={member.personId ?? ""}
                onChange={(e) => change.mutate({ personId: e.target.value || null })}
              >
                <option value="">{t("members.noPerson")}</option>
                {freePersons(persons, members, member.personId).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {!isOwner && !isMe && (
              <Field label={t("members.role")}>
                <select
                  className={SELECT}
                  value={member.role}
                  onChange={(e) => change.mutate({ role: e.target.value as Role })}
                >
                  <option value="member">{t("account.roles.member")}</option>
                  <option value="admin">{t("account.roles.admin")}</option>
                </select>
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={member.dev}
                onChange={(e) => change.mutate({ dev: e.target.checked })}
              />
              {t("members.dev")}
            </label>
            {!isMe && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BUTTON}
                  disabled={reset.isPending}
                  onClick={() => reset.mutate()}
                >
                  {member.pending ? t("members.resendInvite") : t("members.sendReset")}
                </button>
                {account.role === "owner" && !member.pending && (
                  <button
                    type="button"
                    className={BUTTON}
                    onClick={() => {
                      if (window.confirm(t("members.confirmOwner", { email: member.email }))) {
                        handOver.mutate();
                      }
                    }}
                  >
                    {t("members.makeOwner")}
                  </button>
                )}
                {!isOwner && (
                  <button
                    type="button"
                    className={BUTTON_DANGER}
                    onClick={() => {
                      if (window.confirm(t("members.confirmRemove", { email: member.email }))) {
                        remove.mutate();
                      }
                    }}
                  >
                    {t("members.remove")}
                  </button>
                )}
              </div>
            )}
            {sent && (
              <p role="status" className="text-sm text-muted">
                {t("members.sent", { email: member.email })}
              </p>
            )}
            {error && <ErrorText>{t(errorKey(error))}</ErrorText>}
          </div>
        )}
      </details>
    </li>
  );
}

function InviteForm({ members, persons }: { members: Member[]; persons: Person[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [dev, setDev] = useState(false);
  const [invited, setInvited] = useState<{ email: string; emailSent: boolean } | null>(null);
  const invite = useMutation({
    mutationFn: () =>
      api<Member & { emailSent: boolean }>("/members", {
        method: "POST",
        body: { email, personId: personId || null, role, dev },
      }),
    onSuccess: (member) => {
      setInvited(member);
      setEmail("");
      setPersonId("");
      setRole("member");
      setDev(false);
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setInvited(null);
    invite.mutate();
  }

  return (
    <form
      onSubmit={submit}
      aria-label={t("members.invite")}
      className="flex flex-col gap-3 rounded-md border border-line p-3"
    >
      <h3 className="text-sm font-semibold">{t("members.invite")}</h3>
      <Field label={t("members.email")}>
        <TextInput
          required
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label={t("account.person")}>
        <select className={SELECT} value={personId} onChange={(e) => setPersonId(e.target.value)}>
          <option value="">{t("members.noPerson")}</option>
          {freePersons(persons, members, null).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("members.role")}>
        <select className={SELECT} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="member">{t("account.roles.member")}</option>
          <option value="admin">{t("account.roles.admin")}</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={dev} onChange={(e) => setDev(e.target.checked)} />
        {t("members.dev")}
      </label>
      {invite.error && <ErrorText>{t(errorKey(invite.error))}</ErrorText>}
      {invited && (
        <p role="status" className="text-sm text-muted">
          {invited.emailSent
            ? t("members.invited", { email: invited.email })
            : t("members.emailFailed")}
        </p>
      )}
      <SubmitButton busy={invite.isPending}>{t("members.sendInvite")}</SubmitButton>
    </form>
  );
}
