import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("Settings picks one of the device's voices for the app's language, with speed and pitch", async ({
  page,
}) => {
  // The browser's voices are replaced by three, one in another language; speaking writes down
  // which voice, speed and pitch were used.
  await page.addInitScript(`
    window.spoken = [];
    const voices = [
      { voiceURI: "joana", name: "Joana", lang: "en", localService: true },
      { voiceURI: "ana", name: "Ana Natural", lang: "en", localService: false },
      { voiceURI: "luciana", name: "Luciana", lang: "fr-FR", localService: true },
    ];
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak(u) {
          window.spoken.push({ voice: u.voice && u.voice.name, rate: u.rate, pitch: u.pitch });
          setTimeout(() => u.onend && u.onend(), 0);
        },
        cancel() {},
        getVoices: () => voices,
        addEventListener() {},
        removeEventListener() {},
      },
    });
  `);
  await signIn(page);
  await page.goto("/settings/device");
  const sound = page.getByTestId("voice-sound");
  const voice = sound.getByLabel("Voice");
  await expect(voice.locator("option")).toHaveText([
    "Automatic (the most natural)",
    "Ana Natural (online)",
    "Joana",
  ]);

  await voice.selectOption("joana");
  await sound.getByLabel("Speed").fill("1.2");
  await sound.getByLabel("Pitch").fill("0.8");
  await sound.getByRole("button", { name: "Listen" }).click();
  await expect
    .poll(() => page.evaluate("window.spoken.at(-1)"))
    .toEqual({ voice: "Joana", rate: 1.2, pitch: 0.8 });

  // The choice stays on this device.
  await page.reload();
  await expect(page.getByTestId("voice-sound").getByLabel("Voice")).toHaveValue("joana");

  await page.getByTestId("voice-sound").getByRole("button", { name: "Reset" }).click();
  await page.getByTestId("voice-sound").getByRole("button", { name: "Listen" }).click();
  await expect
    .poll(() => page.evaluate("window.spoken.at(-1)"))
    .toEqual({ voice: "Ana Natural", rate: 1, pitch: 1 });
});
