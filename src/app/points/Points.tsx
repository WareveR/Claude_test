import { Trophy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { Field, TextInput } from "../screens/form";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { usePoints, useRedeem, useSetGoal } from "./model";

/** The Wall's points board: each Person saving for something, how far they are. */
export function PointsBoard() {
  const { t } = useTranslation();
  const persons = usePersons().data ?? [];
  const standings = (usePoints().data ?? []).filter((s) => s.goal !== null);
  if (standings.length === 0) return null;
  return (
    <ul
      data-testid="points-board"
      aria-label={t("points.board")}
      className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-1 text-sm max-sm:px-2"
    >
      {standings.map((s) => {
        const person = persons.find((p) => p.id === s.personId);
        if (!person) return null;
        const goal = s.goal!;
        const reached = s.points >= goal;
        return (
          <li key={s.personId} className="flex min-w-0 items-center gap-1.5">
            <PersonAvatar person={person} size={20} />
            <span
              className="relative h-2 w-16 overflow-hidden rounded-full bg-line"
              role="meter"
              aria-label={t("points.of", { name: person.name })}
              aria-valuemin={0}
              aria-valuemax={goal}
              aria-valuenow={Math.min(s.points, goal)}
            >
              <span
                className="absolute inset-y-0 left-0 bg-accent"
                style={{ width: `${Math.min(100, (100 * Math.max(0, s.points)) / goal)}%` }}
              />
            </span>
            <span className="shrink-0 font-semibold">
              {s.points}/{goal}
            </span>
            {s.reward && (
              <span className={`min-w-0 truncate ${reached ? "font-semibold" : "text-muted"}`}>
                {reached && <Trophy aria-hidden size={14} className="mr-0.5 inline text-accent" />}
                {s.reward}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** On a Person's page: their points, what they save for, and handing over the reward. */
export function PersonPoints({ personId }: { personId: string }) {
  const { t } = useTranslation();
  const standing = (usePoints().data ?? []).find((s) => s.personId === personId);
  const setGoal = useSetGoal();
  const redeem = useRedeem();
  const [goal, setGoalText] = useState(standing?.goal ? String(standing.goal) : "");
  const [reward, setReward] = useState(standing?.reward ?? "");
  const points = standing?.points ?? 0;
  const save = () => {
    const n = Number(goal);
    setGoal.mutate({
      personId,
      goal: goal.trim() && Number.isInteger(n) && n > 0 ? n : null,
      reward,
    });
  };
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4" data-testid="person-points">
      <h2 className="font-semibold">{t("points.title")}</h2>
      <p>{t("points.have", { count: points })}</p>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <Field label={t("points.goal")}>
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            value={goal}
            onChange={(e) => setGoalText(e.target.value)}
          />
        </Field>
        <Field label={t("points.reward")}>
          <TextInput
            value={reward}
            maxLength={100}
            placeholder={t("points.rewardHint")}
            onChange={(e) => setReward(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON} onClick={save}>
          {t("points.saveGoal")}
        </button>
        {standing?.goal && (
          <button
            type="button"
            className={BUTTON_PRIMARY}
            disabled={points < standing.goal}
            onClick={() => redeem.mutate(personId)}
          >
            {t("points.redeem")}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">{t("points.hint")}</p>
    </section>
  );
}
