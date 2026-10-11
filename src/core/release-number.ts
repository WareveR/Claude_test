/**
 * The app's version number, MAJOR.MINOR.FIX, worked out from the history of main: every merged
 * change is a release. A new feature adds one to the middle number and resets the last
 * (0.4.2 → 0.5.0); a fix or adjustment adds one to the last (0.5.0 → 0.5.1); planning,
 * documentation and tooling don't count. Changes made before titles told them apart are listed
 * in release-history.ts; since then a title starting with "Fix" marks a fix and any other title
 * a feature. The major number is package.json's, set by hand (0 until the app reaches v1).
 */
export type ReleaseKind = "feature" | "fix" | "none";

export function releaseKind(
  commit: { id: string; title: string },
  history: Record<string, ReleaseKind>,
): ReleaseKind {
  const listed = Object.entries(history).find(([id]) => commit.id.startsWith(id));
  if (listed) return listed[1];
  return /^fix\b/i.test(commit.title.trim()) ? "fix" : "feature";
}

export function releaseNumber(
  major: number,
  commits: { id: string; title: string }[],
  history: Record<string, ReleaseKind> = {},
): string {
  let minor = 0;
  let fix = 0;
  for (const commit of commits) {
    const kind = releaseKind(commit, history);
    if (kind === "feature") {
      minor += 1;
      fix = 0;
    } else if (kind === "fix") fix += 1;
  }
  return `${major}.${minor}.${fix}`;
}
