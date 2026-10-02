import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { api } from "../api";
import { setDisplayMode } from "../display/mode";
import { paths } from "../paths";

type DeviceState = {
  id: string;
  name: string;
  language: string;
  push: boolean;
  remindersOn: boolean;
  reminderPersonIds: string[] | null;
};

/** Settings › Display Mode: turns this tablet into a wall calendar, with Reminders off. */
export function DisplayModeSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const turnOn = useMutation({
    mutationFn: async () => {
      // A wall tablet gets no Reminders; the Persons chosen before are kept for later.
      const device = await api<DeviceState>("/device");
      return api<DeviceState>("/device/reminders", {
        method: "PUT",
        body: { remindersOn: false, reminderPersonIds: device.reminderPersonIds },
      });
    },
    onSuccess: (device) => {
      queryClient.setQueryData(["device"], device);
      setDisplayMode(true);
      void navigate(paths.display(), { replace: true });
    },
  });
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("display.title")}</h2>
      <p className="text-sm text-muted">{t("display.hint")}</p>
      <button
        type="button"
        disabled={turnOn.isPending}
        className="self-start rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        onClick={() => turnOn.mutate()}
      >
        {t("display.turnOn")}
      </button>
    </section>
  );
}
