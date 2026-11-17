import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { useCloseOutside } from "../ui/useCloseOutside";
import { useSwapTurn, type Task } from "./model";

/** "Vez de Rui", and a button to give this time's turn to someone else of the Rotation. */
export function TurnSwap({ task, persons }: { task: Task; persons: Person[] }) {
  const { t } = useTranslation();
  const swap = useSwapTurn();
  const ref = useCloseOutside();
  const rotation = task.rotation;
  if (!rotation) return null;
  const current = persons.find((p) => p.id === task.personIds[0]);
  const others = rotation.personIds
    .filter((id) => id !== current?.id)
    .map((id) => persons.find((p) => p.id === id))
    .filter((p) => p !== undefined);
  return (
    <span className="flex items-center gap-1 text-xs text-muted" data-testid="turn">
      {current && t("rotation.turnOf", { name: current.name })}
      <details ref={ref} className="relative">
        <summary
          aria-label={t("rotation.swap")}
          className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md hover:bg-surface"
        >
          <ArrowLeftRight aria-hidden size={14} />
        </summary>
        <div className="absolute right-0 z-20 mt-1 flex min-w-40 flex-col rounded-md border border-line bg-frame p-1 shadow-lg">
          {others.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-surface"
              onClick={(e) => {
                swap.mutate({ task, personId: p.id });
                (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              }}
            >
              <PersonAvatar person={p} size={20} />
              {t("rotation.swapWith", { name: p.name })}
            </button>
          ))}
        </div>
      </details>
    </span>
  );
}
