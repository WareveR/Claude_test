import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Laptop,
  LogOut,
  Monitor,
  Pencil,
  Smartphone,
  Tablet,
  Tv,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { DEVICE_KINDS, type DeviceKind } from "../../core/device-kind";
import { useTranslation } from "react-i18next";
import { formatLocale } from "../../core/languages";
import { api } from "../api";
import { useSignedIn } from "../family";

type DeviceRow = {
  id: string;
  name: string;
  kind: DeviceKind | null;
  model: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
};

const KIND_ICONS: Record<DeviceKind, LucideIcon> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  computer: Monitor,
  watch: Watch,
  tv: Tv,
};

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
    mutationFn: ({ id, ...body }: { id: string; name?: string; kind?: DeviceKind }) =>
      api(`/devices/${id}`, { method: "PATCH", body }),
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
      <ul className="divide-y divide-line rounded-md border border-line">
        {devices.data?.map((device) => (
          <li
            key={device.id}
            data-testid="device-row"
            className="flex items-center gap-3 px-3 py-2"
          >
            <DeviceIcon kind={device.kind} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">
                {device.name}
                {device.current && (
                  <span className="ml-2 text-xs text-accent">{t("devices.thisDevice")}</span>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <select
                  aria-label={t("devices.kind", { name: device.name })}
                  value={device.kind ?? ""}
                  onChange={(e) =>
                    rename.mutate({ id: device.id, kind: e.target.value as DeviceKind })
                  }
                  className="rounded border border-line bg-surface py-0.5 text-xs text-ink"
                >
                  {!device.kind && <option value="">{t("devices.kinds.unknown")}</option>}
                  {DEVICE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`devices.kinds.${kind}`)}
                    </option>
                  ))}
                </select>
                {device.model && <span>{device.model}</span>}
                <span className="font-mono">
                  {t("devices.id", { id: device.id.slice(0, 6).toUpperCase() })}
                </span>
              </span>
              <span className="text-xs text-muted">
                {t("devices.signedInAt", { when: lastUse.format(new Date(device.createdAt)) })}
                {" · "}
                {t("devices.lastUsed", { when: lastUse.format(new Date(device.lastUsedAt)) })}
              </span>
            </div>
            <button
              type="button"
              aria-label={t("devices.rename", { name: device.name })}
              className="rounded-md p-2 hover:bg-line/60"
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
              className="rounded-md p-2 hover:bg-line/60"
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

function DeviceIcon({ kind }: { kind: DeviceKind | null }) {
  const Icon = kind ? KIND_ICONS[kind] : Monitor;
  return <Icon aria-hidden size={24} strokeWidth={1.5} className="shrink-0 text-muted" />;
}
