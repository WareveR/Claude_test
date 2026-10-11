import { describe, expect, it } from "vitest";
import { releaseList, releaseNumber } from "./release-number";

const commits = (...titles: string[]) =>
  titles.map((title, i) => ({ id: `${i}abcdef0123`, title }));

describe("releaseNumber", () => {
  it("starts at MAJOR.0.0", () => {
    expect(releaseNumber(0, [])).toBe("0.0.0");
  });

  it("counts features in the middle number and fixes in the last, oldest first", () => {
    expect(
      releaseNumber(
        0,
        commits(
          "Agenda view (#174)",
          "Fix: the week skips a day (#180)",
          "fix the readback pause (#181)",
          "Search (#178)",
          "Fix: search misses accents (#182)",
        ),
      ),
    ).toBe("0.2.1");
  });

  it("doesn't take a word that only starts with fix for a fix", () => {
    expect(releaseNumber(1, commits("Fixture data for tests"))).toBe("1.1.0");
  });

  it("goes by the listed history first, by short commit id", () => {
    const history = { "0abcdef": "none", "1abcdef": "fix", "2abcdef": "feature" } as const;
    expect(
      releaseNumber(0, commits("Add the glossary", "Open dialogs full screen", "Fix-ish"), history),
    ).toBe("0.1.0");
    expect(releaseNumber(0, commits("Add the glossary", "Open dialogs full screen"), history)).toBe(
      "0.0.1",
    );
  });
});

describe("releaseList", () => {
  const dated = (...items: [string, string?][]) =>
    items.map(([title, body = ""], i) => ({
      id: `${i}abcdef0123`,
      title,
      date: `2026-10-1${i}`,
      body,
    }));

  it("lists each version newest first, without the changes that made none", () => {
    const list = releaseList(
      0,
      dated(["Agenda view (#174)"], ["Docs"], ["Fix: the week skips a day (#180)"]),
      { "1abcdef": "none" },
    );
    expect(list.map((r) => [r.version, r.kind, r.title, r.pr, r.date])).toEqual([
      ["0.1.1", "fix", "the week skips a day", 180, "2026-10-12"],
      ["0.1.0", "feature", "Agenda view", 174, "2026-10-10"],
    ]);
  });

  it("takes the Portuguese line from the commit, else from the notes kept", () => {
    const list = releaseList(
      0,
      dated(
        ["Agenda view (#174)"],
        ["Search (#178)", "Release-Note: Pesquisa nova\n\nCo-authored-by: x"],
      ),
      {},
      { "0.1.0": "Vista Agenda" },
    );
    expect(list.map((r) => r.notePt)).toEqual(["Pesquisa nova", "Vista Agenda"]);
  });
});
