import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { addDays, formatPlainDate } from "../../core/plain-date";
import { BINS, type Bin, type WasteCollection } from "../../core/waste";
import { api, type Status } from "../api";
import { useSignedIn } from "../family";
import { formatLocale } from "../../core/languages";
import { Tick } from "../ui/Toggle";

const MONDAY = "2026-10-05";

/** The Family's rubbish collection days: a bin per row, a weekday per column. */
export function WasteSection() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (collection: WasteCollection) =>
      api("/family/waste", { method: "PUT", body: { collection } }),
    // Shows the change at once, while it saves.
    onMutate: (collection) =>
      queryClient.setQueryData<Status>(["status"], (status) =>
        status?.family
          ? { ...status, family: { ...status.family, wasteCollection: collection } }
          : status,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["status"] }),
  });
  const collection = family.wasteCollection;
  const locale = formatLocale(language);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    formatPlainDate(addDays(MONDAY, i), locale, { weekday: "short" }),
  );
  const has = (bin: Bin, day: number) =>
    collection.some((c) => c.bin === bin && c.weekdays.includes(day));
  const toggle = (bin: Bin, day: number, on: boolean) => {
    const days = collection.find((c) => c.bin === bin)?.weekdays ?? [];
    const next = on ? [...days, day].sort((a, b) => a - b) : days.filter((d) => d !== day);
    save.mutate([
      ...collection.filter((c) => c.bin !== bin),
      ...(next.length ? [{ bin, weekdays: next }] : []),
    ]);
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("waste.title")}</h2>
      <p className="text-sm text-muted">{t("waste.hint")}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th />
              {weekdays.map((name) => (
                <th key={name} className="px-1 font-medium first-letter:uppercase">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BINS.map((bin) => (
              <tr key={bin} className="border-t border-line">
                <th className="py-1 pr-2 text-left font-normal">{t(`waste.bins.${bin}`)}</th>
                {weekdays.map((name, day) => (
                  <td key={name} className="text-center">
                    <Tick
                      aria-label={`${t(`waste.bins.${bin}`)} · ${name}`}
                      checked={has(bin, day)}
                      disabled={save.isPending}
                      onChange={(e) => toggle(bin, day, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
