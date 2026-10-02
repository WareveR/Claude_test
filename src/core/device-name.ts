const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const PLATFORMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/Windows/, "Windows"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/** Names a Signed-in Device from its browser and platform, like "Chrome on Android". */
export function deviceName(userAgent: string): string {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Browser";
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return platform ? `${browser} on ${platform}` : browser;
}
