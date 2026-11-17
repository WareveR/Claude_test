import { useTranslation } from "react-i18next";
import { contactsFor } from "../../core/contacts";
import { ContactLine } from "./ContactsSection";
import { useContacts } from "./model";

/** The Contacts an Entry names in its title or place, with their call buttons. */
export function EntryContacts({ title, location }: { title: string; location: string }) {
  const { t } = useTranslation();
  const found = contactsFor(useContacts().data ?? [], [title, location]);
  if (found.length === 0) return null;
  return (
    <section aria-label={t("contacts.title")} data-testid="entry-contacts">
      {found.map((c) => (
        <ContactLine key={c.id} contact={c} />
      ))}
    </section>
  );
}

/** A Person's own Contacts (their doctor, their school), on their page. */
export function PersonContacts({ personId }: { personId: string }) {
  const { t } = useTranslation();
  const own = (useContacts().data ?? []).filter((c) => c.personId === personId);
  if (own.length === 0) return null;
  return (
    <section
      className="flex flex-col gap-1 border-t border-line pt-4"
      data-testid="person-contacts"
    >
      <h2 className="font-semibold">{t("contacts.title")}</h2>
      {own.map((c) => (
        <ContactLine key={c.id} contact={c} />
      ))}
    </section>
  );
}
