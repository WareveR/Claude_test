import { Mail, Phone, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { MAX_CONTACT_FIELD, MAX_CONTACT_NOTES, telHref } from "../../core/contacts";
import { ApiError } from "../api";
import { usePersons } from "../persons/model";
import { ErrorText, Field, TextInput } from "../screens/form";
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY } from "../ui/button";
import { useContacts, useDeleteContact, useSaveContact, type Contact } from "./model";

/** Call and email buttons for a Contact, as big as a finger. */
export function ContactActions({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const icon =
    "flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface";
  return (
    <>
      {contact.phone && (
        <a
          href={telHref(contact.phone)}
          aria-label={t("contacts.call", { name: contact.name })}
          className={icon}
        >
          <Phone aria-hidden size={18} />
        </a>
      )}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          aria-label={t("contacts.write", { name: contact.name })}
          className={icon}
        >
          <Mail aria-hidden size={18} />
        </a>
      )}
    </>
  );
}

/** One Contact's line: name, what they are and whose, then call and email. */
export function ContactLine({ contact, onOpen }: { contact: Contact; onOpen?: () => void }) {
  const persons = usePersons().data ?? [];
  const whose = persons.find((p) => p.id === contact.personId)?.name;
  const detail = [contact.role, whose].filter(Boolean).join(" · ");
  const text = (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">{contact.name}</span>
      {detail && <span className="text-xs text-muted">{detail}</span>}
    </span>
  );
  return (
    <div className="flex items-center gap-2 py-1.5" data-testid="contact">
      {onOpen ? (
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          {text}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{text}</div>
      )}
      <ContactActions contact={contact} />
    </div>
  );
}

/** Settings › Family: the useful Contacts, each opened to change it. */
export function ContactsSection() {
  const { t } = useTranslation();
  const contacts = useContacts().data ?? [];
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="contacts-title">
      <h2 id="contacts-title" className="font-semibold">
        {t("contacts.title")}
      </h2>
      <ul className="divide-y divide-line rounded-md border border-line px-3">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <ContactLine contact={contact} onOpen={() => setEditing(contact)} />
          </li>
        ))}
        <li>
          <button
            type="button"
            className="flex w-full items-center gap-3 py-2"
            onClick={() => setEditing("new")}
          >
            <Plus aria-hidden size={20} strokeWidth={1.75} />
            {t("contacts.add")}
          </button>
        </li>
      </ul>
      {editing && (
        <ContactDialog
          contact={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function ContactDialog({ contact, onClose }: { contact?: Contact; onClose: () => void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const persons = (usePersons().data ?? []).filter(
    (p) => !p.archived || p.id === contact?.personId,
  );
  const save = useSaveContact();
  const remove = useDeleteContact();
  const [form, setForm] = useState({
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    personId: contact?.personId ?? null,
    notes: contact?.notes ?? "",
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const field = (key: "name" | "role" | "phone" | "email", type = "text") => (
    <Field label={t(`contacts.${key}`)}>
      <TextInput
        type={type}
        required={key === "name"}
        value={form[key]}
        maxLength={key === "phone" ? 30 : MAX_CONTACT_FIELD}
        placeholder={key === "role" ? t("contacts.roleHint") : undefined}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );
  const bad = save.error instanceof ApiError ? save.error.body.field : undefined;
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ id: contact?.id, ...form }, { onSuccess: onClose });
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {contact ? contact.name : t("contacts.add")}
        </h2>
        {field("name")}
        {field("role")}
        {field("phone", "tel")}
        {field("email", "email")}
        <Field label={t("contacts.person")}>
          <select
            value={form.personId ?? ""}
            onChange={(e) => setForm({ ...form, personId: e.target.value || null })}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base"
          >
            <option value="">{t("contacts.everyone")}</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("contacts.notes")}>
          <textarea
            rows={2}
            value={form.notes}
            maxLength={MAX_CONTACT_NOTES}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base"
          />
        </Field>
        {save.error && (
          <ErrorText>
            {bad ? t(`contacts.bad.${bad}`, t("errors.unexpected")) : t("errors.unexpected")}
          </ErrorText>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {contact && (
            <button
              type="button"
              className={`${BUTTON_DANGER} mr-auto`}
              onClick={() => remove.mutate(contact.id, { onSuccess: onClose })}
            >
              {t("contacts.delete")}
            </button>
          )}
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button type="submit" className={BUTTON_PRIMARY} disabled={save.isPending}>
            {t("contacts.save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
