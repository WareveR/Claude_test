import { expect, test } from "@playwright/test";
import { lisbonDate, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("a chore takes turns: it shows whose turn it is and the turn can be swapped", async ({
  page,
}) => {
  await signIn(page);
  const person = async (name: string) =>
    (
      (await (
        await page.request.post("/api/persons", {
          headers: ORIGIN,
          data: { name, color: "#c8e6c9", nicknames: [] },
        })
      ).json()) as { id: string }
    ).id;
  const ana = await person("Ana x64");
  const rui = await person("Rui x64");
  const today = lisbonDate(0);
  await (
    await page.request.post("/api/tasks", {
      headers: ORIGIN,
      data: {
        title: "Dishes x64",
        dueDate: today,
        personIds: [],
        repetition: { frequency: "daily", interval: 1, end: { type: "never" } },
        rotation: { personIds: [ana, rui], every: "turn", turn: 0, anchor: today },
      },
    })
  ).json();
  try {
    await page.goto("/tasks");
    const row = page.getByTestId("task").filter({ hasText: "Dishes x64" });
    await expect(row.getByTestId("turn")).toContainText("Ana x64's turn");
    await row.getByLabel("Swap the turn").click();
    await row.getByRole("button", { name: "Give the turn to Rui x64" }).click();
    await expect(row.getByTestId("turn")).toContainText("Rui x64's turn");
  } finally {
    const tasks = (await (await page.request.get("/api/tasks")).json()) as {
      id: string;
      title: string;
    }[];
    for (const t of tasks.filter((t) => t.title === "Dishes x64")) {
      await page.request.delete(`/api/tasks/${t.id}`, { headers: ORIGIN });
    }
    await page.request.delete(`/api/persons/${ana}`, { headers: ORIGIN });
    await page.request.delete(`/api/persons/${rui}`, { headers: ORIGIN });
  }
});
