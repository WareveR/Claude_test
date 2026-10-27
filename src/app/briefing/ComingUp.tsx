import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, RefreshCw, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { briefingSentences, type Segment } from "../../core/briefing";
import { addDays, todayIn } from "../../core/plain-date";
import { isOverdue } from "../../core/task";
import { api } from "../api";
import { EntryPopup } from "../entries/EntryPopup";
import { useSignedIn } from "../family";
import { usePersonFilter } from "../filter/model";
import { usePeriodTasks } from "../tasks/TasksAccordion";
import { TaskRow } from "../tasks/TaskRow";
import { useMoveTask, type Task } from "../tasks/model";
import { BUTTON } from "../ui/button";
import { canSpeak, speak, stopSpeaking } from "../voice/speech";

type Briefing = { segments: Segment[]; fallback: boolean; writtenAt: string } | null;

type Open = { id: string; date: string } | null;

/**
 * A phrase of the Briefing. One about an Entry opens that Entry in a popup; the rest is plain
 * text, as the Tasks are right beside it.
 */
function SegmentText({ segment, onOpen }: { segment: Segment; onOpen: (open: Open) => void }) {
  const link = segment.link;
  if (link?.kind !== "entry") return <>{segment.text}</>;
  const open = () => onOpen({ id: link.id, date: link.date });
  // Inline, not a <button> (which is always a box): a long linked phrase wraps with the sentence.
  return (
    <span
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded font-medium text-accent hover:bg-accent/10"
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      {segment.text}
    </span>
  );
}

/** "Good morning", "Good afternoon" or "Good evening" by this device's clock, as a radio host opens. */
function useGreeting() {
  const { t } = useTranslation();
  const hour = new Date().getHours();
  return t(
    hour >= 5 && hour < 12
      ? "briefing.morning"
      : hour >= 12 && hour < 20
        ? "briefing.afternoon"
        : "briefing.evening",
  );
}

/** A radio host's voice: a little higher and brisker than the device's flat default. */
const CHEERFUL = { pitch: 1.15, rate: 1.05 };

/** Play reads the Briefing aloud, greeting first; Stop, leaving or a new Briefing ends it. Keyed by its text. */
function PlayButton({ sentences }: { sentences: string[] }) {
  const { t, i18n } = useTranslation();
  const [playing, setPlaying] = useState(false);
  // Leaving the page stops what was being read; a new Briefing remounts this button, so it does too.
  useEffect(() => () => stopSpeaking(), []);
  if (!canSpeak()) return null;
  const toggle = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    void speak(sentences, i18n.language, CHEERFUL).then(() => setPlaying(false));
  };
  return (
    <button type="button" className={BUTTON} aria-pressed={playing} onClick={toggle}>
      {playing ? <Square aria-hidden size={14} /> : <Play aria-hidden size={14} />}
      {playing ? t("briefing.stop") : t("briefing.play")}
    </button>
  );
}

/**
 * "Coming up": the AI-written Briefing, told like a morning radio show, with Play to hear it. It is
 * never written on load, only by the Scheduler or Refresh; with exactly one Person filtered it is
 * that Person's, otherwise the Family's.
 */
export function ComingUp({ readOnly = false }: { readOnly?: boolean }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
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
  const data = briefing.data;
  const [open, setOpen] = useState<Open>(null);
  const greeting = useGreeting();
  const spoken = data && [greeting, ...briefingSentences(data.segments, data.fallback)];
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
        {spoken && <PlayButton key={spoken.join(" ")} sentences={spoken} />}
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
      <div data-testid="briefing" className="leading-relaxed hyphens-auto">
        {data === null && <p className="text-sm text-muted">{t("briefing.none")}</p>}
        {data && !data.fallback && (
          // The Briefing's paragraphs come as pieces starting with a blank line.
          <p className="whitespace-pre-line">
            <span className="font-semibold">{greeting} </span>
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
      {open && <EntryPopup id={open.id} occurrence={open.date} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** How many days "Still to do" looks ahead, today included, like the Summary's Entries. */
const TO_DO_DAYS = 7;

/**
 * What is left to do: the Tasks of the next seven days and every overdue one, tickable, an
 * overdue one with buttons to move it to today or tomorrow. Beside the Briefing on the Summary.
 */
export function TodayTasks() {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const today = todayIn(family.timeZone);
  const { tasks, now, persons } = usePeriodTasks(today, addDays(today, TO_DO_DAYS - 1));
  const overdue = tasks.filter((task) => isOverdue(task, now)).length;
  return (
    <section
      aria-labelledby="coming-up-tasks-title"
      data-testid="coming-up-tasks"
      className="mx-4 flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-sm"
    >
      <h2 id="coming-up-tasks-title" className="text-xl font-bold">
        {t("comingUp.toDo", { count: tasks.length })}
        {overdue > 0 && (
          <span className="text-overdue"> · {t("tasks.overdueCount", { count: overdue })}</span>
        )}
      </h2>
      {tasks.length === 0 && <p className="text-muted">{t("tasks.nothingLeft")}</p>}
      <ul className="divide-y divide-line">
        {tasks.map((task) => {
          const late = isOverdue(task, now);
          return (
            <TaskRow
              key={task.id}
              task={task}
              overdue={late}
              persons={persons}
              actions={late && !task.hidden && <MoveTask task={task} today={today} />}
            />
          );
        })}
      </ul>
    </section>
  );
}

/** "Today" and "Tomorrow": an overdue Task moved on in one tap. */
function MoveTask({ task, today }: { task: Task; today: string }) {
  const { t } = useTranslation();
  const move = useMoveTask();
  const days = [
    {
      label: t("comingUp.moveToday"),
      name: t("comingUp.moveTodayFor", { title: task.title }),
      date: today,
    },
    {
      label: t("comingUp.moveTomorrow"),
      name: t("comingUp.moveTomorrowFor", { title: task.title }),
      date: addDays(today, 1),
    },
  ];
  return (
    <>
      {days.map((day) => (
        <button
          key={day.date}
          type="button"
          aria-label={day.name}
          className={`${BUTTON} text-xs`}
          disabled={move.isPending}
          onClick={() => move.mutate({ task, dueDate: day.date })}
        >
          {day.label}
        </button>
      ))}
    </>
  );
}
