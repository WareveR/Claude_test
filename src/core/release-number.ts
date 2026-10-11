/**
 * The app's version number, worked out from the history of main: each merged change after the
 * commit that set package.json's version is a release. A change whose title starts with "Fix"
 * adds one to the last number (1.4.2 → 1.4.3); any other change is a new feature and adds one
 * to the middle number (1.4.3 → 1.5.0). A new major version is set by hand in package.json.
 */
export function releaseNumber(base: string, titles: string[]): string {
  const [major = 0, minor = 0, patch = 0] = base.split(".").map((n) => Number(n) || 0);
  let next = { minor, patch };
  for (const title of titles) {
    next = /^fix\b/i.test(title.trim())
      ? { minor: next.minor, patch: next.patch + 1 }
      : { minor: next.minor + 1, patch: 0 };
  }
  return `${major}.${next.minor}.${next.patch}`;
}
