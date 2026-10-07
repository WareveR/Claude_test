import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Segment } from "../../core/briefing";
import { todayIn } from "../../core/plain-date";
import { isOverdue } from "../../core/task";
import { api } from "../api";
import { EntryPopup } from "../entries/EntryPopup";
import { useSignedIn } from "../family";
import { usePersonFilter } from "../filter/model";
import { usePeriodTasks } from "../tasks/TasksAccordion";
import { TaskRow } from "../tasks/TaskRow";
import { BUTTON } from "../ui/button";

type Briefing = { segments: Segment[]; fallback: boolean; writtenAt: string } | null;

type Open = { id: string; date: string } | null;

/**
 * A phrase of the Briefing. One about an Entry opens that Entry in a popup; the rest is plain
 * text, as the Tasks are right below.
 */
function SegmentText({ segment, onOpen }: { segment: Segment; onOpen: (open: Open) => void }) {
  const link = segment.link;
  if (link?.kind !== "entry") return <>{segment.text}</>;
  return (
    <button
      type="button"
      className="rounded px-0.5 text-left font-medium text-accent hover:bg-accent/10"
      onClick={() => onOpen({ id: link.id, date: link.date })}
    >
      {segment.text}
    </button>
  );
}

/**
 * "Coming up": the AI-written Briefing of the next seven days and, below it, what is left to do
 * (today's and overdue Tasks, tickable). The Briefing is never written on load, only by Refresh;
 * with exactly one Person filtered it is that Person's, otherwise the Family's.
 */
export function ComingUp({ readOnly = false }: { readOnly?: boolean }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const { family } = useSignedIn();
  const { personIds } = usePersonFilter();
  const person = personIds.length === 1 ? personIds[0] : null;
  const query = person ? `?person=${encodeURIComponent(person)}` : "";
  const key = ["briefing", person ?? "family", i18n.language];
  const briefing = useQuery({
    queryKey: key,
    queryFn: () => api<Briefing>(`/briefing${query}`),
  });
  const refresh = useMutation({
    mutationFn: () => api<Briefing>(`/briefing/refresh${query}`, { method: "POST" }),
    onSuccess: (data) => client.setQueryData(key, data),
  });
  const today = todayIn(family.timeZone);
  const { tasks, now, persons } = usePeriodTasks(today, today);
  const overdue = tasks.filter((task) => isOverdue(task, now)).length;
  const data = briefing.data;
  const [open, setOpen] = useState<Open>(null);
  return (
    <section
      aria-labelledby="coming-up-title"
      data-testid="coming-up"
      className="mx-4 flex flex-col gap-3 rounded-xl border-2 border-accent/60 bg-surface p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <h2 id="coming-up-title" className="flex-1 text-xl font-bold">
          {t("comingUp.title")}
        </h2>
        {!readOnly && (
          <button
            type="button"
            className={BUTTON}
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            <RefreshCw aria-hidden size={14} className={refresh.isPending ? "animate-spin" : ""} />
            {t("briefing.refresh")}
          </button>
        )}
      </div>
      <div data-testid="briefing" className="leading-relaxed">
        {data === null && <p className="text-sm text-muted">{t("briefing.none")}</p>}
        {data && !data.fallback && (
          <p>
            {data.segments.map((s, i) => (
              <SegmentText key={i} segment={s} onOpen={setOpen} />
            ))}
          </p>
        )}
        {data?.fallback && (
          <ul className="flex flex-col gap-1">
            {data.segments.map((s, i) => (
              <li key={i} data-testid="briefing-line">
                <SegmentText segment={s} onOpen={setOpen} />
              </li>
            ))}
          </ul>
        )}
        {refresh.isError && (
          <p role="alert" className="text-sm text-muted">
            {t("briefing.failed")}
          </p>
        )}
      </div>
      {tasks.length > 0 && (
        <section
          aria-labelledby="coming-up-tasks-title"
          data-testid="coming-up-tasks"
          className="border-t border-line pt-2"
        >
          <h3 id="coming-up-tasks-title" className="text-sm font-semibold">
            {t("comingUp.toDo", { count: tasks.length })}
            {overdue > 0 && (
              <span className="text-overdue"> · {t("tasks.overdueCount", { count: overdue })}</span>
            )}
          </h3>
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} overdue={isOverdue(task, now)} persons={persons} />
            ))}
          </ul>
        </section>
      )}
      {open && <EntryPopup id={open.id} occurrence={open.date} onClose={() => setOpen(null)} />}
    </section>
  );
}
