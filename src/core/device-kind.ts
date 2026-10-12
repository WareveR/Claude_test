export const DEVICE_KINDS = ["phone", "tablet", "laptop", "computer", "watch", "tv"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

export function isDeviceKind(value: unknown): value is DeviceKind {
  return DEVICE_KINDS.includes(value as DeviceKind);
}

/**
 * What kind of device a browser is on, from its user agent and its screen. A laptop and a desktop
 * computer look the same to a browser, so both start as "computer" and the Family can say which.
 */
export function guessDeviceKind(
  userAgent: string,
  screen: { touch: boolean; shortSide: number },
): DeviceKind {
  if (/Watch|Wear ?OS/i.test(userAgent)) return "watch";
  if (
    /SmartTV|SMART-TV|Tizen|Web0S|webOS.*TV|Android TV|GoogleTV|CrKey|BRAVIA|AFT[A-Z]/i.test(
      userAgent,
    )
  )
    return "tv";
  if (/iPhone|iPod/.test(userAgent)) return "phone";
  if (/iPad/.test(userAgent)) return "tablet";
  if (/Android/.test(userAgent)) return /Mobile/.test(userAgent) ? "phone" : "tablet";
  // An iPad asks for the desktop site and says it is a Mac; only its touch screen tells.
  if (/Macintosh/.test(userAgent) && screen.touch) return "tablet";
  if (screen.touch && screen.shortSide < 500) return "phone";
  return "computer";
}
