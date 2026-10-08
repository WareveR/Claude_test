import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { shiftTime, type EntryTime } from "../../core/entry-time";
import { daysBetween, formatPlainDate, type PlainDate } from "../../core/plain-date";
import { api } from "../api";
import { occurrenceValues, saveEntry, type Entry, type Shown } from "../entries/model";
import { ScopeDialog, type Scope } from "../entries/ScopeDialog";
import { usePointerDrag } from "../ui/usePointerDrag";

/** A spot in the calendar: a day, and in the time grid also the minute of that day. */
export type Spot = { date: PlainDate; minutes: number | null };

/** Where a drag picked an Entry up: which Occurrence, and the spot under the pointer. */
type Grab = { key: string; from: Spot };

type Move = { shown: Shown; time: EntryTime };

const SPOT = "[data-drop-date]";

/** Rounding the pointer's minute keeps the drag from re-rendering on every pixel. */
const SPOT_MINUTES = 5;

/**
 * The spot under the pointer. Days carry `data-drop-date`; a time grid column also carries
 * `data-drop-hour-px`, the height of one hour, so the pointer's height gives the minute.
 */
export function spotAt(x: number, y: number): Spot | null {
  const el = document.elementsFromPoint(x, y).find((e) => e.matches(SPOT)) as
    HTMLElement | undefined;
  if (!el) return null;
  const hourPx = Number(el.dataset.dropHourPx);
  if (!hourPx) return { date: el.dataset.dropDate!, minutes: null };
  const raw = ((y - el.getBoundingClientRect().top) / hourPx) * 60;
  const minutes = Math.min(24 * 60 - 1, Math.max(0, raw));
  return {
    date: el.dataset.dropDate!,
    minutes: Math.round(minutes / SPOT_MINUTES) * SPOT_MINUTES,
  };
}

/** Whether an Occurrence can be dragged: Checklist bars and synced Birthdays can't. */
export function isMovable(entry: Shown): boolean {
  return !entry.href && !entry.birthdayPersonId;
}

/** The new time of an Occurrence picked up at one spot and held over another. */
function movedTime(shown: Shown, from: Spot, to: Spot): EntryTime {
  const minutes =
    !shown.time.allDay && from.minutes !== null && to.minutes !== null
      ? to.minutes - from.minutes
      : 0;
  return shiftTime(shown.time, daysBetween(from.date, to.date), minutes);
}

function sameTime(a: EntryTime, b: EntryTime) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Dragging Entries to another day or time in the day, week and month views. A repeating
 * Entry asks whether the move is for this Occurrence, the following or all of them. While it
 * saves, the Occurrence already shows at its new time.
 */
export function useEntryDrag({
  entries,
  locale,
  enabled = true,
  scroller,
}: {
  entries: Shown[];
  locale: string;
  enabled?: boolean;
  scroller?: RefObject<HTMLElement | null>;
}) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<Move | null>(null);
  const [pending, setPending] = useState<{ key: string; time: EntryTime } | null>(null);

  const save = useMutation({
    mutationFn: async ({ shown, time, scope }: Move & { scope: Scope | null }) => {
      // The Occurrence on screen carries a shown title (a Birthday's age), so start from the Entry.
      const entry = await api<Entry>(`/entries/${shown.id}`);
      if (!entry.repetition || !scope) return saveEntry(entry, { ...entry, time }, null);
      const values = occurrenceValues(entry, shown.occurrenceDate) ?? entry;
      return saveEntry(entry, { ...values, time }, { date: shown.occurrenceDate, scope });
    },
    onMutate: ({ shown, time }) => setPending({ key: shown.key, time }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["entries"] });
      setPending(null);
    },
  });

  const { dragging, over, zone, ghost, ghostStyle } = usePointerDrag<Grab, Spot>({
    pick: (target, x, y) => {
      if (!enabled) return null;
      const key = target.closest<HTMLElement>("[data-drag-entry]")?.dataset.dragEntry;
      const from = key ? spotAt(x, y) : null;
      return key && from ? { key, from } : null;
    },
    locate: (x, y) => spotAt(x, y),
    onDrop: ({ key, from }, to) => {
      const shown = entries.find((e) => e.key === key);
      if (!shown) return;
      const time = movedTime(shown, from, to);
      if (sameTime(time, shown.time)) return;
      if (shown.repetition) setAsking({ shown, time });
      else save.mutate({ shown, time, scope: null });
    },
    scroller,
  });

  const dragged = dragging && entries.find((e) => e.key === dragging.key);
  const preview = dragged && over ? movedTime(dragged, dragging.from, over) : null;
  const label =
    preview &&
    `${formatPlainDate(preview.startDate, locale, { weekday: "short", day: "numeric", month: "short" })}${preview.allDay ? "" : ` · ${preview.startTime}`}`;

  return {
    zone,
    /** The Occurrence being dragged, and where it would land. */
    dragged: dragged || null,
    preview,
    /** The Occurrences with one being saved already at its new time. */
    shown: (list: Shown[]) =>
      pending ? list.map((e) => (e.key === pending.key ? { ...e, time: pending.time } : e)) : list,
    /** The floating label and the scope question; render once beside the grid. */
    overlay: (
      <>
        {dragged &&
          createPortal(
            <div
              ref={ghost}
              aria-hidden
              data-testid="drag-ghost"
              style={ghostStyle}
              className="pointer-events-none fixed top-0 left-0 z-30 max-w-64 rounded-md border border-accent bg-surface px-3 py-2 text-sm shadow-lg"
            >
              <div className="truncate font-semibold">{dragged.title}</div>
              {label && <div className="text-muted first-letter:uppercase">{label}</div>}
            </div>,
            document.body,
          )}
        {asking && (
          <ScopeDialog
            action="save"
            allowThis
            onCancel={() => setAsking(null)}
            onPick={(scope) => {
              setAsking(null);
              save.mutate({ ...asking, scope });
            }}
          />
        )}
      </>
    ),
  };
}
