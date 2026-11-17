import { ExternalLink, Gift, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  GIFT_OCCASIONS,
  giftsFor,
  MAX_GIFT_TEXT,
  seesGiftsFor,
  type GiftIdea,
  type GiftOccasion,
} from "../../core/gifts";
import { todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { useDeleteGift, useGifts, useSaveGift } from "./model";

/** One idea: ticked when given, its occasion, its shop link and a delete button. */
function GiftLine({ gift }: { gift: GiftIdea }) {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const save = useSaveGift();
  const remove = useDeleteGift();
  const given = gift.givenOn !== null;
  return (
    <li className="flex items-center gap-2 py-1.5" data-testid="gift">
      <input
        type="checkbox"
        checked={given}
        aria-label={t("gifts.givenFor", { text: gift.text })}
        onChange={() =>
          save.mutate({
            ...gift,
            givenOn: given ? null : todayIn(family.timeZone),
          })
        }
      />
      <span className={`min-w-0 flex-1 ${given ? "text-muted line-through" : ""}`}>
        {gift.text}
        {gift.occasion !== "any" && (
          <span className="text-sm text-muted"> · {t(`gifts.occasions.${gift.occasion}`)}</span>
        )}
      </span>
      {gift.link && (
        <a
          href={gift.link}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t("gifts.openLink", { text: gift.text })}
          className="text-muted"
        >
          <ExternalLink aria-hidden size={16} />
        </a>
      )}
      <button
        type="button"
        aria-label={t("gifts.delete", { text: gift.text })}
        className="text-muted"
        onClick={() => remove.mutate(gift.id)}
      >
        <Trash2 aria-hidden size={16} />
      </button>
    </li>
  );
}

/** On a Person's page: the ideas for them and adding one; not on one's own page. */
export function PersonGifts({ personId }: { personId: string }) {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const gifts = (useGifts().data ?? []).filter((g) => g.personId === personId);
  const save = useSaveGift();
  const [text, setText] = useState("");
  const [occasion, setOccasion] = useState<GiftOccasion>("any");
  const [link, setLink] = useState("");
  if (!seesGiftsFor(account, personId)) return null;
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4" data-testid="person-gifts">
      <h2 className="flex items-center gap-2 font-semibold">
        <Gift aria-hidden size={18} />
        {t("gifts.title")}
      </h2>
      <p className="text-xs text-muted">{t("gifts.hint")}</p>
      {gifts.length > 0 && (
        <ul className="divide-y divide-line">
          {[...gifts]
            .sort((a, b) => Number(a.givenOn !== null) - Number(b.givenOn !== null))
            .map((g) => (
              <GiftLine key={g.id} gift={g} />
            ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(
            { personId, text, occasion, link, givenOn: null },
            {
              onSuccess: () => {
                setText("");
                setLink("");
              },
            },
          );
        }}
      >
        <input
          required
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base"
          aria-label={t("gifts.idea")}
          placeholder={t("gifts.idea")}
          maxLength={MAX_GIFT_TEXT}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select
          aria-label={t("gifts.occasion")}
          value={occasion}
          onChange={(e) => setOccasion(e.target.value as GiftOccasion)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-base"
        >
          {GIFT_OCCASIONS.map((o) => (
            <option key={o} value={o}>
              {t(`gifts.occasions.${o}`)}
            </option>
          ))}
        </select>
        <input
          type="url"
          className="min-w-0 basis-full rounded-md border border-line bg-surface px-3 py-2 text-base"
          aria-label={t("gifts.link")}
          placeholder={t("gifts.link")}
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button type="submit" className={BUTTON_PRIMARY} disabled={save.isPending}>
          {t("gifts.add")}
        </button>
      </form>
    </section>
  );
}

/** On a Birthday Entry: the ideas for its Person not yet given; never to that Person. */
export function BirthdayGifts({ personId }: { personId: string }) {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const gifts = giftsFor(
    (useGifts().data ?? []).filter((g) => g.personId === personId && g.givenOn === null),
    "birthday",
  );
  if (!seesGiftsFor(account, personId) || gifts.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3" data-testid="birthday-gifts">
      <h3 className="flex items-center gap-1.5 font-semibold">
        <Gift aria-hidden size={18} className="text-muted" />
        {t("gifts.title")}
      </h3>
      <ul className="divide-y divide-line">
        {gifts.map((g) => (
          <GiftLine key={g.id} gift={g} />
        ))}
      </ul>
    </div>
  );
}

/** Settings › Family: the Christmas list, each Person's ideas for Christmas not yet given. */
export function ChristmasGifts() {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const persons = (usePersons().data ?? []).filter(
    (p) => !p.archived && seesGiftsFor(account, p.id),
  );
  const gifts = useGifts().data ?? [];
  const [open, setOpen] = useState(false);
  const rows = persons
    .map((person) => ({
      person,
      ideas: giftsFor(
        gifts.filter((g) => g.personId === person.id && g.givenOn === null),
        "christmas",
      ),
    }))
    .filter((r) => r.ideas.length > 0);
  return (
    <section className="flex flex-col gap-2" data-testid="christmas-gifts">
      <h2 className="flex items-center gap-2 font-semibold">
        <Gift aria-hidden size={18} />
        {t("gifts.christmas")}
      </h2>
      {rows.length === 0 && <p className="text-sm text-muted">{t("gifts.none")}</p>}
      {rows.length > 0 && (
        <button
          type="button"
          className={`${BUTTON} self-start`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? t("gifts.hide") : t("gifts.show", { count: rows.length })}
        </button>
      )}
      {open && (
        <ul className="flex flex-col gap-3">
          {rows.map(({ person, ideas }) => (
            <li key={person.id}>
              <Link
                to={`/settings/persons/${person.id}`}
                className="flex items-center gap-2 font-medium"
              >
                <PersonAvatar person={person} size={20} />
                {person.name}
              </Link>
              <ul className="divide-y divide-line pl-7">
                {ideas.map((g) => (
                  <GiftLine key={g.id} gift={g} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
