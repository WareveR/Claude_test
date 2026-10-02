import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatLocale } from "../../core/languages";
import { api } from "../api";
import { useSignedIn } from "../family";

type DeviceRow = { id: string; name: string; lastUsedAt: string; current: boolean };

export function DevicesSection() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const queryClient = useQueryClient();
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => api<DeviceRow[]>("/devices") });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["devices"] }),
      queryClient.invalidateQueries({ queryKey: ["status"] }),
    ]);
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api(`/devices/${id}`, { method: "PATCH", body: { name } }),
    onSuccess: refresh,
  });
  const signOut = useMutation({
    mutationFn: (id: string) => api(`/devices/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const lastUse = new Intl.DateTimeFormat(formatLocale(language), {
    timeZone: family.timeZone,
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("devices.title")}</h2>
      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        {devices.data?.map((device) => (
          <li key={device.id} className="flex items-center gap-2 px-3 py-2">
            <div className="flex flex-1 flex-col">
              <span className="font-medium">
                {device.name}
                {device.current && (
                  <span className="ml-2 text-xs text-teal-700 dark:text-teal-400">
                    {t("devices.thisDevice")}
                  </span>
                )}
              </span>
              <span className="text-xs text-stone-500">
                {t("devices.lastUsed", { when: lastUse.format(new Date(device.lastUsedAt)) })}
              </span>
            </div>
            <button
              type="button"
              aria-label={t("devices.rename", { name: device.name })}
              className="rounded-md p-2 hover:bg-stone-200 dark:hover:bg-stone-800"
              onClick={() => {
                const name = window.prompt(t("devices.newName"), device.name);
                if (name?.trim()) rename.mutate({ id: device.id, name });
              }}
            >
              <Pencil aria-hidden size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={t("devices.signOut", { name: device.name })}
              className="rounded-md p-2 hover:bg-stone-200 dark:hover:bg-stone-800"
              onClick={() => {
                if (window.confirm(t("devices.confirmSignOut", { name: device.name }))) {
                  signOut.mutate(device.id);
                }
              }}
            >
              <LogOut aria-hidden size={18} strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
