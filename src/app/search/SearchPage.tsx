import { CalendarDays, CheckSquare, ListChecks, Search } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { overlaps } from "../../core/entry-time";
import { formatLocale } from "../../core/languages";
import { addDays, daysBetween, formatPlainDate, isPlainDate, todayIn } from "../../core/plain-date";
import type { PlainDate } from "../../core/plain-date";
import { occurrenceDates } from "../../core/repetition";
import {
  excerpt,
  highlight,
  highlightTerms,
  isEmptyQuery,
  parseQuery,
  scoreItem,
} from "../../core/search";
import { useChecklists } from "../checklists/model";
import { entryPath, useEntries } from "../entries/model";
import { typeName, useEntryTypes } from "../entry-types/model";
import { useSignedIn } from "../family";
import { usePersons, type Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { useTasks } from "../tasks/model";
import { Switch } from "../ui/Toggle";

const INPUT = "rounded-md border border-line bg-surface px-3 py-2 text-base text-ink";
const KINDS = ["all", "entries", "tasks", "checklists"] as const;
const PERIODS = ["any", "past", "next30", "year", "custom"] as const;
/** More than this many results only says how many more there are. */
const SHOWN = 100;

type Result = {
  key: string;
  kind: "entry" | "task" | "checklist";
  title: string;
  /** The longer text searched besides the title, for the excerpt. */
  detail: string;
  date: PlainDate | null;
  label: string;
  color?: string;
  personIds: string[];
  href: string;
  done: boolean;
  score: number;
};

/**
 * One box for every Entry, Task and Checklist, by name, notes, place, section or Person, with
 * filters for Person, kind or Entry Type, period and done Tasks. Everything is in the address.
 */
export function SearchPage() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const locale = formatLocale(language);
  const today = todayIn(family.timeZone);
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const person = params.get("person") ?? "";
  const kind = (KINDS as readonly string[]).includes(params.get("kind") ?? "")
    ? (params.get("kind") as (typeof KINDS)[number])
    : "all";
  const typeId = params.get("type") ?? "";
  const period = (PERIODS as readonly string[]).includes(params.get("period") ?? "")
    ? (params.get("period") as (typeof PERIODS)[number])
    : "any";
  const done = params.get("done") === "1";
  const set = (patch: Record<string, string>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  const fromParam = params.get("from");
  const toParam = params.get("to");
  const range = useMemo(
    () => periodWindow(period, today, fromParam, toParam),
    [period, today, fromParam, toParam],
  );
  const entries = useEntries("1900-01-01", "2199-12-31").data;
  const tasks = useTasks().data;
  const checklists = useChecklists().data;
  const personList = usePersons().data;
  const typeList = useEntryTypes().data;
  const persons = useMemo(() => personList ?? [], [personList]);
  const types = useMemo(() => typeList ?? [], [typeList]);
  const query = useMemo(() => parseQuery(q), [q]);
  const filtered = Boolean(person || kind !== "all" || typeId || period !== "any" || done);
  const terms = highlightTerms(query);
  const loading = !entries || !tasks || !checklists;

  const results = useMemo(() => {
    if (isEmptyQuery(query) && !filtered) return [];
    const names = (ids: string[]) =>
      ids.map((id) => persons.find((p) => p.id === id)?.name ?? "").filter(Boolean);
    const list: Result[] = [];
    const add = (result: Omit<Result, "score">, other: string[]) => {
      if (person && !result.personIds.includes(person)) return;
      const score = scoreItem({ title: result.title, other }, query);
      if (score !== null) list.push({ ...result, score });
    };
    const inWindow = (date: PlainDate | null) =>
      !range || (date !== null && range.from <= date && date <= range.to);

    if (kind === "all" || kind === "entries") {
      for (const entry of entries ?? []) {
        if (typeId && entry.entryTypeId !== typeId) continue;
        // A repeating Entry shows its next Occurrence, or its first if all are past.
        const next = entry.repetition
          ? (occurrenceDates(
              entry.time.startDate,
              entry.repetition,
              today,
              addDays(today, 800),
            )[0] ?? null)
          : null;
        if (range) {
          const hit = entry.repetition
            ? occurrenceDates(entry.time.startDate, entry.repetition, range.from, range.to).length >
              0
            : overlaps(entry.time, range.from, range.to);
          if (!hit) continue;
        }
        const type = types.find((ty) => ty.id === entry.entryTypeId);
        const label = type ? typeName(type, t) : t("search.kinds.entries");
        const date = next ?? entry.time.startDate;
        add(
          {
            key: `e-${entry.id}`,
            kind: "entry",
            title: entry.title,
            detail: [entry.location, entry.notes].filter(Boolean).join(" · "),
            date,
            label,
            color: type?.color,
            personIds: entry.personIds,
            href: entryPath(next ? { ...entry, occurrenceDate: next } : entry),
            done: false,
          },
          [entry.location, entry.notes, label, ...names(entry.personIds)],
        );
      }
    }
    if ((kind === "all" || kind === "tasks") && !typeId) {
      for (const task of tasks ?? []) {
        if (task.doneAt && !done) continue;
        if (!inWindow(task.dueDate)) continue;
        const checklist = checklists?.find((c) => c.id === task.checklistId);
        add(
          {
            key: `t-${task.id}`,
            kind: "task",
            title: task.title,
            detail: task.notes,
            date: task.dueDate,
            label: checklist ? checklist.name : t("search.kinds.tasks"),
            personIds: task.personIds,
            href: checklist ? `/checklists/${checklist.id}` : `/tasks/${task.id}`,
            done: Boolean(task.doneAt),
          },
          [
            task.notes,
            tasks?.find((parent) => parent.id === task.parentId)?.title ?? "",
            checklist?.name ?? "",
            ...names(task.personIds),
          ],
        );
      }
    }
    if ((kind === "all" || kind === "checklists") && !typeId) {
      for (const checklist of checklists ?? []) {
        const date = checklist.startDate ?? checklist.endDate;
        if (range) {
          const start = checklist.startDate ?? checklist.endDate;
          const end = checklist.endDate ?? checklist.startDate;
          if (!start || !end || end < range.from || start > range.to) continue;
        }
        add(
          {
            key: `c-${checklist.id}`,
            kind: "checklist",
            title: checklist.name,
            detail: "",
            date,
            label: t("search.kinds.checklists"),
            personIds: checklist.personIds,
            href: `/checklists/${checklist.id}`,
            done: false,
          },
          names(checklist.personIds),
        );
      }
    }
    // Best matches first; then the nearest to today, undated last.
    const distance = (date: PlainDate | null) =>
      date === null ? Infinity : Math.abs(daysBetween(today, date));
    return list.sort((a, b) => b.score - a.score || distance(a.date) - distance(b.date));
  }, [
    query,
    filtered,
    entries,
    tasks,
    checklists,
    persons,
    types,
    person,
    kind,
    typeId,
    done,
    range,
    today,
    t,
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4">
      <h1 className="text-xl font-semibold">{t("search.title")}</h1>
      <label className="relative flex items-center">
        <Search aria-hidden size={18} className="pointer-events-none absolute left-3 text-muted" />
        <input
          type="search"
          autoFocus
          aria-label={t("search.box")}
          placeholder={t("search.placeholder")}
          className={`${INPUT} w-full pl-10`}
          value={q}
          onChange={(e) => set({ q: e.target.value })}
        />
      </label>
      <p className="text-xs text-muted">{t("search.hint")}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          aria-label={t("search.person")}
          className={INPUT}
          value={person}
          onChange={(e) => set({ person: e.target.value })}
        >
          <option value="">{t("search.anyone")}</option>
          {persons
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <select
          aria-label={t("search.kind")}
          className={INPUT}
          value={typeId ? `type:${typeId}` : kind}
          onChange={(e) =>
            e.target.value.startsWith("type:")
              ? set({ kind: "entries", type: e.target.value.slice(5) })
              : set({ kind: e.target.value === "all" ? "" : e.target.value, type: "" })
          }
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`search.kinds.${k}`)}
            </option>
          ))}
          <optgroup label={t("search.entryTypes")}>
            {types.map((ty) => (
              <option key={ty.id} value={`type:${ty.id}`}>
                {typeName(ty, t)}
              </option>
            ))}
          </optgroup>
        </select>
        <select
          aria-label={t("search.period")}
          className={INPUT}
          value={period}
          onChange={(e) => set({ period: e.target.value === "any" ? "" : e.target.value })}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {t(`search.periods.${p}`)}
            </option>
          ))}
        </select>
        {period === "custom" && (
          <>
            <input
              type="date"
              aria-label={t("search.from")}
              className={INPUT}
              value={params.get("from") ?? ""}
              onChange={(e) => set({ from: e.target.value })}
            />
            <input
              type="date"
              aria-label={t("search.to")}
              className={INPUT}
              value={params.get("to") ?? ""}
              onChange={(e) => set({ to: e.target.value })}
            />
          </>
        )}
        <label className="flex items-center gap-2">
          <Switch checked={done} onChange={(e) => set({ done: e.target.checked ? "1" : "" })} />
          {t("search.done")}
        </label>
      </div>

      {isEmptyQuery(query) && !filtered ? (
        <p className="text-muted">{t("search.start")}</p>
      ) : loading ? null : results.length === 0 ? (
        <p className="text-muted">{t("search.none")}</p>
      ) : (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {t("search.count", { count: results.length })}
          </p>
          <ul className="flex flex-col divide-y divide-line" data-testid="search-results">
            {results.slice(0, SHOWN).map((r) => (
              <ResultRow key={r.key} result={r} terms={terms} persons={persons} locale={locale} />
            ))}
          </ul>
          {results.length > SHOWN && (
            <p className="text-sm text-muted">
              {t("search.more", { count: results.length - SHOWN })}
            </p>
          )}
        </>
      )}
    </main>
  );
}

function ResultRow({
  result: r,
  terms,
  persons,
  locale,
}: {
  result: Result;
  terms: string[];
  persons: Person[];
  locale: string;
}) {
  const Icon = r.kind === "entry" ? CalendarDays : r.kind === "task" ? CheckSquare : ListChecks;
  const detail = r.detail ? excerpt(r.detail, terms) : "";
  return (
    <li>
      <Link to={r.href} className="flex items-start gap-3 py-2.5" data-testid="search-result">
        <Icon
          aria-hidden
          size={18}
          className="mt-0.5 shrink-0"
          style={r.color ? { color: r.color } : undefined}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`break-words font-medium ${r.done ? "text-muted line-through" : ""}`}>
            <Marked text={r.title} terms={terms} />
          </span>
          <span className="text-xs text-muted">
            {[
              r.date &&
                formatPlainDate(r.date, locale, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              r.label,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {detail && (
            <span className="text-sm break-words text-muted">
              <Marked text={detail} terms={terms} />
            </span>
          )}
        </span>
        <span className="flex shrink-0 -space-x-1">
          {r.personIds.map((id) => {
            const p = persons.find((person) => person.id === id);
            return p ? <PersonAvatar key={id} person={p} size={22} /> : null;
          })}
        </span>
      </Link>
    </li>
  );
}

function Marked({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-sm bg-accent/25 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** The dates a period covers, or null for any time. */
function periodWindow(
  period: (typeof PERIODS)[number],
  today: PlainDate,
  from: string | null,
  to: string | null,
): { from: PlainDate; to: PlainDate } | null {
  switch (period) {
    case "past":
      return { from: "1900-01-01", to: addDays(today, -1) };
    case "next30":
      return { from: today, to: addDays(today, 29) };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "custom":
      return {
        from: from && isPlainDate(from) ? from : "1900-01-01",
        to: to && isPlainDate(to) ? to : "2199-12-31",
      };
    default:
      return null;
  }
}
