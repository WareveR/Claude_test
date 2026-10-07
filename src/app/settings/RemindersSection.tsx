import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { usePersons } from "../persons/model";
import { BUTTON } from "../ui/button";
import { Chip, Switch } from "../ui/Toggle";

type DeviceState = {
  id: string;
  name: string;
  language: string;
  push: boolean;
  remindersOn: boolean;
  reminderPersonIds: string[] | null;
};

function keyBytes(base64url: string) {
  const padded = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const supported = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "PushManager" in window &&
  "serviceWorker" in navigator;

const isApple = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Settings › Reminders: this device's push notifications and which Persons it hears about. */
export function RemindersSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const persons = usePersons();
  const device = useQuery({ queryKey: ["device"], queryFn: () => api<DeviceState>("/device") });
  const key = useQuery({
    queryKey: ["push-key"],
    queryFn: () => api<{ publicKey: string | null }>("/push/key"),
  });
  const [denied, setDenied] = useState(
    () => typeof Notification !== "undefined" && Notification.permission === "denied",
  );
  const store = (d: DeviceState) => queryClient.setQueryData(["device"], d);

  const allow = useMutation({
    mutationFn: async (publicKey: string) => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(permission === "denied");
        return null;
      }
      setDenied(false);
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      return api<DeviceState>("/device/push", { method: "PUT", body: subscription.toJSON() });
    },
    onSuccess: (d) => {
      if (d) store(d);
    },
  });
  const turnOff = useMutation({
    mutationFn: async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (await registration.pushManager.getSubscription())?.unsubscribe();
      } catch {
        // The server's copy is removed regardless.
      }
      return api<DeviceState>("/device/push", { method: "DELETE" });
    },
    onSuccess: store,
  });
  const save = useMutation({
    mutationFn: (body: { remindersOn: boolean; reminderPersonIds: string[] | null }) =>
      api<DeviceState>("/device/reminders", { method: "PUT", body }),
    onSuccess: store,
  });

  const d = device.data;
  const publicKey = key.data?.publicKey;
  if (!d || !key.data) return null;

  let body;
  if (!publicKey) {
    body = <p className="text-sm text-muted">{t("reminders.notSetUp")}</p>;
  } else if (!supported()) {
    body = (
      <p className="text-sm text-muted">
        {isApple() && !isStandalone() ? t("reminders.addToHome") : t("reminders.unsupported")}
      </p>
    );
  } else {
    const ids = d.reminderPersonIds;
    const people = (persons.data ?? []).filter((p) => !p.archived);
    const update = (remindersOn: boolean, reminderPersonIds: string[] | null) =>
      save.mutate({ remindersOn, reminderPersonIds });
    const toggle = (id: string) => {
      const current = ids ?? people.map((p) => p.id);
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      update(d.remindersOn, next);
    };
    body = (
      <>
        {d.push ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{t("reminders.pushOn")}</span>
            <button
              type="button"
              className={BUTTON}
              disabled={turnOff.isPending}
              onClick={() => turnOff.mutate()}
            >
              {t("reminders.turnOff")}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={allow.isPending || denied}
              className="self-start rounded-md bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-60"
              onClick={() => allow.mutate(publicKey)}
            >
              {t("reminders.allow")}
            </button>
            {denied && <p className="text-sm text-muted">{t("reminders.denied")}</p>}
            {allow.isError && <p className="text-sm text-muted">{t("reminders.failed")}</p>}
          </>
        )}
        <label className="flex items-center gap-2">
          <Switch checked={d.remindersOn} onChange={(e) => update(e.target.checked, ids)} />
          {t("reminders.switch")}
        </label>
        {d.remindersOn && (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium">{t("reminders.persons")}</legend>
            <div className="flex flex-wrap gap-2">
              <Chip
                checked={ids === null}
                onChange={(e) =>
                  update(d.remindersOn, e.target.checked ? null : people.map((p) => p.id))
                }
              >
                {t("reminders.everyone")}
              </Chip>
              {people.map((person) => (
                <Chip
                  key={person.id}
                  checked={ids === null || ids.includes(person.id)}
                  onChange={() => toggle(person.id)}
                >
                  {person.name}
                </Chip>
              ))}
            </div>
            <p className="text-sm text-muted">{t("reminders.familyWide")}</p>
          </fieldset>
        )}
      </>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("reminders.title")}</h2>
      <p className="text-sm text-muted">{t("reminders.hint")}</p>
      {body}
    </section>
  );
}
