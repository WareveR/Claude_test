import { describe, expect, it } from "vitest";
import { BUILT_IN_DEFAULTS, newEntryIcon } from "./entry-type";
import { entryValues } from "./voice";

const activity = { builtinKey: "activity", icon: BUILT_IN_DEFAULTS.activity.icon };

describe("newEntryIcon", () => {
  it("gives an Entry of a built-in type the icon its title names", () => {
    expect(newEntryIcon("Ginásio", activity)).toBe("gym");
    expect(newEntryIcon("Treino do Rui", activity)).toBe("gym");
    expect(newEntryIcon("Natação", activity)).toBe("swimming");
    expect(newEntryIcon("Gym", { builtinKey: "general", icon: "calendar" })).toBe("gym");
  });

  it("leaves the type's icon when the title names none, or names the type's own", () => {
    expect(newEntryIcon("Jantar", activity)).toBeNull();
    expect(newEntryIcon("", activity)).toBeNull();
    expect(newEntryIcon("Natação", { builtinKey: "activity", icon: "swimming" })).toBeNull();
  });

  it("leaves an Entry Type the Family made to show its own icon or picture", () => {
    expect(newEntryIcon("Ginásio", { builtinKey: null, icon: "football" })).toBeNull();
  });
});

describe("entryValues", () => {
  it("creates a gym Entry with the gym icon, not its group's", () => {
    const values = entryValues(
      {
        kind: "entry",
        title: "Ginásio",
        type: null,
        persons: [],
        date: "2026-10-12",
        time: "19:00",
        endDate: null,
        endTime: null,
        allDay: null,
        location: null,
        importance: null,
        repeat: null,
      },
      { id: "t1", defaults: BUILT_IN_DEFAULTS.activity.defaults, ...activity },
      [],
      "2026-10-12",
    );
    expect(values.icon).toBe("gym");
  });
});
