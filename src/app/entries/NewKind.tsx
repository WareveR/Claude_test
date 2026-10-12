import type { FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import type { ClockTime } from "../../core/entry-time";
import { guessKind, type NewKind } from "../../core/new-kind";
import type { PlainDate } from "../../core/plain-date";
import type { Repetition } from "../../core/repetition";
import type { Importance } from "../../core/entry-type";

/** What a new item keeps when it turns from an Entry into a Task or back. */
export type Carried = {
  title: string;
  notes: string;
  personIds: string[];
  private: boolean;
  importance: Importance;
  repetition: Repetition | null;
  date: PlainDate | null;
  /** Only a time the person meant: picked on the calendar or changed in the form. */
  time: ClockTime | null;
};

/** The address state a new form is opened with when it was switched from the other one. */
type SwitchedState = { values: object; switched: true };

/**
 * A new item looks like one thing to the person: the form opens as an Entry or a Task and
 * either can be picked at its top, carrying over what was already filled in. Until the person
 * picks, leaving the title for another field picks the kind the title suggests.
 */
export function useNewKind(kind: NewKind) {
  const navigate = useNavigate();
  const state = useLocation().state as Partial<SwitchedState> | null;
  // Values given by a Voice Entry or Suggestions were already sorted into a kind.
  const picked = state !== null;

  function switchTo(to: NewKind, c: Carried) {
    if (to === kind) return;
    const search = new URLSearchParams();
    if (c.date) search.set("date", c.date);
    if (to === "entry" && c.date && c.time) search.set("time", c.time);
    const shared = {
      title: c.title,
      notes: c.notes,
      personIds: c.personIds,
      private: c.private,
      importance: c.importance,
      repetition: c.repetition,
    };
    const values = to === "task" ? { ...shared, dueTime: c.date ? c.time : null } : shared;
    const query = search.size ? `?${search}` : "";
    navigate(`/${to === "entry" ? "entries" : "tasks"}/new${query}`, {
      replace: true,
      state: { values, switched: true } satisfies SwitchedState,
    });
  }

  /** On leaving the title for another field of the form, before the person has picked. */
  function onTitleBlur(e: FocusEvent<HTMLInputElement>, c: Carried) {
    if (picked) return;
    // Not on Save, Cancel or a tap outside: only when moving on to fill in the form.
    const next = e.relatedTarget;
    if (!(next instanceof HTMLElement) || !next.matches("input, select, textarea")) return;
    const guess = guessKind(c.title);
    if (guess && guess !== kind) switchTo(guess, c);
  }

  return { switchTo, onTitleBlur, switched: state?.switched === true };
}

/** The pick between Entry and Task at the top of a new item's form. */
export function KindSwitch({ kind, onPick }: { kind: NewKind; onPick: (kind: NewKind) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label={t("newItem.kind")} className="flex gap-2">
        {(["entry", "task"] as const).map((k) => (
          <label
            key={k}
            className="relative inline-flex min-h-9 cursor-pointer items-center rounded-full border border-line px-4 py-1 text-sm has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              className="sr-only"
              name="new-kind"
              checked={kind === k}
              onChange={() => onPick(k)}
            />
            {t(`newItem.${k}`)}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{t(`newItem.${kind}Hint`)}</p>
    </div>
  );
}
