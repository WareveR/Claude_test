import { expect, test } from "@playwright/test";
import { leaveWall, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("a child earns points from a Task, saves for a reward on the Wall and gets it", async ({
  page,
}) => {
  await signIn(page);
  const bia = (
    (await (
      await page.request.post("/api/persons", {
        headers: ORIGIN,
        data: { name: "Bia x65", color: "#c8e6c9", nicknames: [] },
      })
    ).json()) as { id: string }
  ).id;
  const task = (
    (await (
      await page.request.post("/api/tasks", {
        headers: ORIGIN,
        data: { title: "Make the bed x65", personIds: [bia], points: 10 },
      })
    ).json()) as { id: string }
  ).id;
  try {
    await page.goto(`/settings/persons/${bia}`);
    const section = page.getByTestId("person-points");
    await section.getByLabel("Goal").fill("10");
    await section.getByLabel("Reward").fill("Cinema x65");
    await section.getByRole("button", { name: "Save goal" }).click();
    await expect(section.getByRole("button", { name: "Reward given" })).toBeDisabled();

    await page.goto("/tasks");
    const row = page.getByTestId("task").filter({ hasText: "Make the bed x65" });
    await expect(row.getByTestId("task-points")).toHaveText("+10 points");
    await row.getByRole("checkbox").click();
    await expect(row).toHaveCount(0);

    await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
    await expect(page.getByTestId("points-board")).toContainText("10/10");
    await expect(page.getByTestId("points-board")).toContainText("Cinema x65");
    await leaveWall(page);

    await page.goto(`/settings/persons/${bia}`);
    await section.getByRole("button", { name: "Reward given" }).click();
    await expect(section).toContainText("Has 0 points.");
  } finally {
    await page.request.delete(`/api/tasks/${task}`, { headers: ORIGIN });
    await page.request.delete(`/api/persons/${bia}`, { headers: ORIGIN });
  }
});
