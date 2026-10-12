import { guessDeviceKind } from "../../core/device-kind";
import { api, type Device } from "../api";

type UserAgentData = {
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }>;
};

/**
 * Tells the Worker what kind of device this is, and its model when the browser says, once: a
 * device the Family already set a kind for is left as it is.
 */
let reported = false;

export async function reportDeviceDetails(device: Device): Promise<void> {
  if (device.kind || reported) return;
  reported = true;
  const kind = guessDeviceKind(navigator.userAgent, {
    touch: navigator.maxTouchPoints > 1,
    shortSide: Math.min(screen.width, screen.height),
  });
  const data = (navigator as { userAgentData?: UserAgentData }).userAgentData;
  const model = await data
    ?.getHighEntropyValues?.(["model"])
    .then((v) => v.model?.trim() || undefined)
    .catch(() => undefined);
  await api("/device", { method: "PATCH", body: { kind, model } });
}
