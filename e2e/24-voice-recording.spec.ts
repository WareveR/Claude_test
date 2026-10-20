import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/** A stand-in voice for Chromium's fake microphone: half a second of quiet, a tone, then quiet. */
function speechFile() {
  const rate = 16000;
  const samples = rate * 6;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const v = t > 0.5 && t < 2 ? 0.3 * Math.sin(2 * Math.PI * 220 * t) : 0;
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  const path = join(tmpdir(), "voice-recording-test.wav");
  writeFileSync(path, Buffer.concat([header, data]));
  return path;
}

// The browser's real recorder and level meter, fed by Chromium's fake microphone.
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${speechFile()}%noloop`,
    ],
  },
  permissions: ["microphone"],
});

test("a real recording ends when the speaker falls quiet and is sent to be read", async ({
  page,
}) => {
  let sent = 0;
  await page.route("**/api/voice/transcribe**", async (route) => {
    sent = route.request().postDataBuffer()?.length ?? 0;
    await route.fulfill({ json: { text: "Dentist on Tuesday at three" } });
  });
  await page.route("**/api/voice", (route) =>
    route.fulfill({ json: { outcome: "failed", sentence: "Dentist on Tuesday at three" } }),
  );
  await signIn(page);
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  await dialog.getByRole("button", { name: "Speak" }).click();
  // The sheet shows it waits for the voice, then that it hears it.
  const status = dialog.getByTestId("voice-status");
  await expect(status).toHaveAttribute("data-activity", /waiting|hearing/);
  await expect(status).toHaveAttribute("data-activity", "hearing", { timeout: 4000 });
  await expect(status).toHaveText("Listening…");
  // The tone ends at two seconds; well before the 20-second limit the recording goes off.
  await expect(page).toHaveURL(/\/entries\/new$/, { timeout: 8000 });
  expect(sent).toBeGreaterThan(0);
  await expect(page.getByLabel("Title")).toHaveValue("Dentist on Tuesday at three");
});

test("a failing transcription shows its error instead of nothing", async ({ page }) => {
  await page.route("**/api/voice/transcribe**", (route) =>
    route.fulfill({ status: 502, json: { error: "speech model: bad audio" } }),
  );
  await signIn(page);
  await page.getByRole("button", { name: "Voice Entry" }).click();
  const dialog = page.getByRole("dialog", { name: "Voice Entry" });
  await dialog.getByRole("button", { name: "Speak" }).click();
  await expect(dialog.getByRole("alert")).toContainText("server-502", { timeout: 8000 });
});
