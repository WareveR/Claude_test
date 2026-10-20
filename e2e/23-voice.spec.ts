import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

async function say(page: Page, sentence: string) {
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  // The whole sheet is on screen, not pushed above the header.
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await dialog.getByLabel("Say or type one sentence").fill(sentence);
  await dialog.getByRole("button", { name: "Send" }).click();
  return dialog;
}

async function fakeTask(page: Page, title: string) {
  await page.route("**/api/voice", (route) =>
    route.fulfill({
      json: {
        outcome: "create",
        kind: "task",
        values: {
          title,
          notes: "",
          dueDate: "2026-10-20",
          dueTime: null,
          personIds: [],
          private: false,
          repetition: null,
          checklistId: null,
        },
        summary: `New task: ${title}, 20 October`,
      },
    }),
  );
}

test("Esc closes the sheet and a failed sentence opens the plain Entry form", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Voice Entry" }).click();
  await expect(page.getByRole("dialog", { name: "Voice Entry" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.route("**/api/voice", (route) =>
    route.fulfill({ json: { outcome: "failed", sentence: "Dentist on Tuesday at three" } }),
  );
  await say(page, "Dentist on Tuesday at three");
  await expect(page).toHaveURL(/\/entries\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Dentist on Tuesday at three");
  await expect(page.getByLabel("Type", { exact: true })).toBeVisible();
});

test("readback shows the summary, Save saves and Undo removes it", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await fakeTask(page, "Voice buy stamps");
  const dialog = await say(page, "task buy stamps");
  await expect(dialog.getByText("New task: Voice buy stamps, 20 October")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Edit" })).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  const toast = page.getByRole("status").filter({ hasText: "Saved" });
  await expect(toast).toBeVisible();
  await expect(page.getByText("Voice buy stamps")).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Voice buy stamps")).toHaveCount(0);
});

test("one sentence naming two things saves both, and Undo removes both", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  const task = (title: string) => ({
    kind: "task",
    values: {
      title,
      notes: "",
      dueDate: "2026-10-20",
      dueTime: null,
      personIds: [],
      private: false,
      repetition: null,
      checklistId: null,
    },
    summary: `New task: ${title}, 20 October`,
  });
  await page.route("**/api/voice", (route) =>
    route.fulfill({
      json: { outcome: "create", ...task("Voice call bank"), more: [task("Voice call school")] },
    }),
  );
  let dialog = await say(page, "call the bank and the school");
  await expect(dialog.getByText("New task: Voice call bank, 20 October")).toBeVisible();
  await expect(dialog.getByText("New task: Voice call school, 20 October")).toBeVisible();
  // Edit goes back to the sentence, since the form holds only one.
  await dialog.getByRole("button", { name: "Edit" }).click();
  await expect(dialog.getByLabel("Say or type one sentence")).toHaveValue(
    "call the bank and the school",
  );
  await page.keyboard.press("Escape");

  dialog = await say(page, "call the bank and the school");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Voice call bank")).toBeVisible();
  await expect(page.getByText("Voice call school")).toBeVisible();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved" })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(page.getByText("Voice call bank")).toHaveCount(0);
  await expect(page.getByText("Voice call school")).toHaveCount(0);
});

test("a Task with items saves as one with them, and Edit opens the form with them", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tasks");
  const task = {
    title: "Voice pack the car",
    notes: "",
    dueDate: "2026-10-20",
    dueTime: null,
    personIds: [],
    private: false,
    repetition: null,
    checklistId: null,
  };
  await page.route("**/api/voice", (route) =>
    route.fulfill({
      json: {
        outcome: "create",
        kind: "checklist",
        values: {
          name: task.title,
          startDate: null,
          endDate: "2026-10-20",
          repetition: null,
          remindAtStart: true,
          personIds: [],
          entryId: null,
          items: ["Voice tent", "Voice torch"],
        },
        summary: "New task: Voice pack the car, 20 October, with 2 items",
        form: { values: task, templateId: null, items: ["Voice tent", "Voice torch"] },
      },
    }),
  );
  const dialog = await say(page, "pack the car: tent and torch");
  await expect(dialog.getByText("with 2 items")).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  const toast = page.getByRole("status").filter({ hasText: "Saved" });
  await expect(toast).toBeVisible();
  await expect(page.getByText("Voice pack the car")).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Voice pack the car")).toHaveCount(0);

  const again = await say(page, "pack the car: tent and torch");
  await again.getByRole("button", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/tasks\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Voice pack the car");
  await expect(page.getByRole("switch", { name: "With items" })).toBeChecked();
  await expect(page.getByLabel("Items (one per line)")).toHaveValue("Voice tent\nVoice torch");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/checklists\//);
  await expect(page.getByRole("checkbox", { name: "Done: Voice tent" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Done: Voice torch" })).toBeVisible();
});

test("a new Person and a new predefined list by voice: Save, Undo and Edit", async ({ page }) => {
  await signIn(page);
  const person = {
    outcome: "create",
    kind: "person",
    values: {
      name: "Voice Maria",
      color: "#c5cae9",
      photoKey: null,
      dateOfBirth: "2015-05-03",
      nicknames: ["Mimi"],
    },
    summary: "New person: Voice Maria, also Mimi, born 3 May 2015",
  };
  await page.route("**/api/voice", (route) => route.fulfill({ json: person }));
  await page.goto("/settings/family");
  const dialog = await say(page, "add Maria, born 3 May 2015");
  await expect(dialog.getByText(person.summary)).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  const toast = page.getByRole("status").filter({ hasText: "Saved" });
  await expect(page.getByText("Voice Maria")).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Voice Maria")).toHaveCount(0);

  const again = await say(page, "add Maria, born 3 May 2015");
  await again.getByRole("button", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/settings\/persons\/new$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Voice Maria");
  await expect(page.getByLabel("Date of birth (optional)")).toHaveValue("2015-05-03");

  await page.unroute("**/api/voice");
  await page.route("**/api/voice", (route) =>
    route.fulfill({
      json: {
        outcome: "create",
        kind: "template",
        values: { name: "Voice picnic", items: ["Blanket", "Sandwiches"] },
        summary: "New predefined list: Voice picnic, with 2 items",
      },
    }),
  );
  const list = await say(page, "create the predefined list picnic");
  await list.getByRole("button", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/settings\/checklist-templates\/new$/);
  await expect(page.getByLabel("Template name")).toHaveValue("Voice picnic");
  await expect(page.getByLabel("Item 2")).toHaveValue("Sandwiches");
});

test("readback speaks the summary and the question as two sentences", async ({ page }) => {
  // A stand-in voice that records each sentence and finishes it at once.
  await page.addInitScript(`
    window.spoken = [];
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        cancel() {},
        speak(u) { window.spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 0); },
      },
    });
  `);
  // Only a spoken sentence is read back.
  await fakeMicrophone(page, "task post letters", undefined, false);
  await signIn(page);
  await page.goto("/tasks");
  await fakeTask(page, "Voice post letters");
  await page.getByRole("button", { name: "Voice Entry" }).click();
  await page
    .getByRole("dialog", { name: "Voice Entry" })
    .getByRole("button", { name: "Speak" })
    .click();
  await expect
    .poll(() => page.evaluate("window.spoken"))
    .toEqual(["New task: Voice post letters, 20 October.", "Save?"]);
});

test("an Entry created by voice saves with its values and can be undone", async ({ page }) => {
  await signIn(page);
  const types = await (await page.request.get("/api/entry-types")).json();
  await page.route("**/api/voice", (route) =>
    route.fulfill({
      json: {
        outcome: "create",
        kind: "entry",
        values: {
          title: "Voice dentist",
          entryTypeId: types[0].id,
          time: {
            allDay: false,
            startDate: "2026-10-20",
            startTime: "15:00",
            endDate: null,
            endTime: null,
          },
          personIds: [],
          importance: "normal",
          location: "",
          notes: "",
          icon: null,
          private: false,
          reminders: [],
          repetition: null,
          birthYearKnown: false,
        },
        summary: "New entry: Voice dentist, Tuesday, 20 October, 15:00",
      },
    }),
  );
  await page.goto("/day/2026-10-20");
  const dialog = await say(page, "dentist on Tuesday at three");
  await expect(
    dialog.getByText("New entry: Voice dentist, Tuesday, 20 October, 15:00"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("entry").filter({ hasText: "Voice dentist" })).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("entry").filter({ hasText: "Voice dentist" })).toHaveCount(0);
});

test("Edit opens the form filled in, and readback can be switched off", async ({ page }) => {
  await signIn(page);
  await fakeTask(page, "Voice call plumber");
  const dialog = await say(page, "task call plumber");
  await dialog.getByRole("button", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/tasks\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Voice call plumber");

  await page.goto("/settings/device");
  const section = page.locator("section section", {
    has: page.getByRole("heading", { name: "Voice Entry" }),
  });
  const readback = section.getByRole("switch");
  await expect(readback).toBeChecked();
  await readback.click();
  await expect(readback).not.toBeChecked();
  await page.reload();
  await expect(readback).not.toBeChecked();

  // Readback off still shows the summary first; nothing opens on its own.
  const quiet = await say(page, "task call plumber");
  await expect(quiet.getByText("New task: Voice call plumber, 20 October")).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/device$/);
  await quiet.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/settings/device");
  await readback.click();
  await expect(readback).toBeChecked();
});

/**
 * A stand-in microphone: a short burst of sound, then quiet, so the recording ends on its own;
 * Workers AI's reading of it is faked as `words`. `error` is the name getUserMedia rejects with.
 */
async function fakeMicrophone(
  page: Page,
  words: string | null,
  error?: string,
  quiet = true,
  permission: "prompt" | "denied" = "denied",
) {
  await page.route("**/api/voice/transcribe**", (route) =>
    route.fulfill({ json: { text: words } }),
  );
  await page.addInitScript(
    ({ words, error, quiet, permission }) => {
      let soundFrom = 0;
      let soundUntil = 0;
      class FakeRecorder {
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;
        start() {
          this.state = "recording";
          // Quiet while the room is measured, then half a second of speech.
          soundFrom = Date.now() + 400;
          soundUntil = words ? soundFrom + 500 : 0;
        }
        stop() {
          if (this.state === "inactive") return;
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["sound"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      }
      class FakeAudioContext {
        state = "running";
        resume() {
          return Promise.resolve();
        }
        close() {
          return Promise.resolve();
        }
        createAnalyser() {
          return {
            fftSize: 1024,
            getByteTimeDomainData(samples: Uint8Array) {
              const loud = Date.now() > soundFrom && Date.now() < soundUntil;
              samples.forEach((_, i) => (samples[i] = loud ? (i % 2 ? 200 : 56) : 128));
            },
          };
        }
        createMediaStreamSource() {
          return { connect() {} };
        }
      }
      const w = globalThis as unknown as {
        MediaRecorder: unknown;
        AudioContext: unknown;
        speechSynthesis: { speak: (u: { onend?: (() => void) | null }) => void };
      };
      w.MediaRecorder = FakeRecorder;
      w.AudioContext = FakeAudioContext;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () =>
            error
              ? Promise.reject(Object.assign(new Error(error), { name: error }))
              : Promise.resolve({ getTracks: () => [{ stop() {} }] }),
        },
      });
      Object.defineProperty(navigator, "permissions", {
        configurable: true,
        value: { query: () => Promise.resolve({ state: error ? permission : "granted" }) },
      });
      // The readback speaks; keep it instant and silent.
      if (quiet)
        w.speechSynthesis.speak = (u) => {
          setTimeout(() => u.onend?.(), 0);
        };
    },
    { words, error, quiet, permission },
  );
}

test("a typed sentence shows the summary and waits for Save or Edit", async ({ page }) => {
  await fakeMicrophone(page, null);
  await signIn(page);
  await page.goto("/tasks");
  await fakeTask(page, "Voice typed stamps");
  const dialog = await say(page, "task buy stamps");
  await expect(dialog.getByText("New task: Voice typed stamps, 20 October")).toBeVisible();
  // Nothing listens for an answer after typing, so the form never opens on its own.
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(dialog.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Edit" })).toBeVisible();
});

test("speaking into the microphone sends what was heard", async ({ page }) => {
  await fakeMicrophone(page, "task buy stamps");
  await signIn(page);
  await page.goto("/tasks");
  await fakeTask(page, "Voice spoken stamps");
  let sent = "";
  await page.route("**/api/voice", async (route) => {
    sent = (route.request().postDataJSON() as { sentence: string }).sentence;
    await route.fallback();
  });
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  await dialog.getByRole("button", { name: "Speak" }).click();
  await expect(dialog.getByText("New task: Voice spoken stamps, 20 October")).toBeVisible();
  expect(sent).toBe("task buy stamps");
  // Silence after the readback leaves the summary up.
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/tasks$/);
});

test("a blocked microphone says so", async ({ page }) => {
  await fakeMicrophone(page, null, "NotAllowedError");
  await signIn(page);
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  await dialog.getByRole("button", { name: "Speak" }).click();
  await expect(dialog.getByRole("alert")).toContainText("The microphone is blocked");
});

test("a microphone question closed without an answer asks to try again", async ({ page }) => {
  await fakeMicrophone(page, null, "NotAllowedError", true, "prompt");
  await signIn(page);
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  await dialog.getByRole("button", { name: "Speak" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Press the microphone again and choose Allow",
  );
});
