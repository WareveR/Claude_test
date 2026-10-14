import { CalendarClock, CalendarDays, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GRID_LAYERS, setGridLayers, useGridLayers } from "./compact";

const ICONS = { both: CalendarClock, allDay: CalendarDays, timed: Clock };

/**
 * Switches what the day and week grids show, in turn: everything, only the All-day Entries (with
 * the day notes), only the Timed Entries. Its icon is what is showing now.
 */
export function LayersButton() {
  const { t } = useTranslation();
  const layers = useGridLayers();
  const Icon = ICONS[layers];
  const next = GRID_LAYERS[(GRID_LAYERS.indexOf(layers) + 1) % GRID_LAYERS.length];
  return (
    <button
      type="button"
      data-testid="grid-layers"
      data-layers={layers}
      aria-label={t("views.layers.label", { shown: t(`views.layers.${layers}`) })}
      title={t(`views.layers.${layers}`)}
      className={`rounded-md p-1.5 ${layers === "both" ? "hover:bg-line/60" : "bg-accent text-accent-ink"}`}
      onClick={() => setGridLayers(next)}
    >
      <Icon aria-hidden size={20} strokeWidth={1.75} />
    </button>
  );
}
