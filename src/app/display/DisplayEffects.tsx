import { useSignedIn } from "../family";
import { useOvernightReload, useWakeLock } from "./hooks";

/** What a Display Mode tablet does in the background: stay awake and reload overnight. */
export function DisplayEffects() {
  useWakeLock();
  useOvernightReload(useSignedIn().family.timeZone);
  return null;
}
