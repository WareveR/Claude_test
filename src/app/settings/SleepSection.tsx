import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DEFAULT_SLEEP_HOURS, type SleepHours } from "../../core/sleep-hours";
import { api, type Status } from "../api";
import { useSignedIn } from "../family";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** The Family's Sleeping Hours: shorter, shaded rows in the day and week views. */
export function SleepSection() {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (sleepHours: SleepHours) =>
      api("/family/sleep", { method: "PUT", body: { sleepHours } }),
    // Shows the change at once, while it saves.
    onMutate: (sleepHours) =>
      queryClient.setQueryData<Status>(["status"], (status) =>
        status?.family ? { ...status, family: { ...status.family, sleepHours } } : status,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  const sleep = family.sleepHours ?? DEFAULT_SLEEP_HOURS;
  const picker = (which: keyof SleepHours) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{t(`sleep.${which}`)}</span>
      <select
        value={sleep[which]}
        onChange={(e) => save.mutate({ ...sleep, [which]: Number(e.target.value) })}
        className="rounded-md border border-line bg-surface px-3 py-2 tabular-nums"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="flex flex-col gap-2" data-testid="sleep-section">
      <h2 className="font-semibold">{t("sleep.title")}</h2>
      <p className="text-sm text-muted">{t("sleep.hint")}</p>
      <div className="flex gap-4">
        {picker("start")}
        {picker("end")}
      </div>
    </section>
  );
}
