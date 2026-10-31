import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE, pickVoice, readVoiceSettings, voicesFor } from "./voice-choice";

const v = (name: string, lang: string, localService = true) => ({
  voiceURI: name,
  name,
  lang,
  localService,
});

const voices = [
  v("Luciana", "pt-BR"),
  v("Joana", "pt-PT"),
  v("Google português de Portugal", "pt_PT", false),
  v("Microsoft Raquel Online (Natural) - Portuguese (Portugal)", "pt-PT", false),
  v("Daniel", "en-GB"),
];

describe("voicesFor", () => {
  it("keeps only exactly this language, natural first, then network, then local", () => {
    expect(voicesFor(voices, "pt-PT").map((x) => x.name)).toEqual([
      "Microsoft Raquel Online (Natural) - Portuguese (Portugal)",
      "Google português de Portugal",
      "Joana",
    ]);
  });

  it("finds nothing for a language the device lacks", () => {
    expect(voicesFor(voices, "fr-FR")).toEqual([]);
  });
});

describe("pickVoice", () => {
  it("uses the chosen voice when the device has it", () => {
    expect(pickVoice(voices, "pt-PT", "Joana")?.name).toBe("Joana");
  });

  it("falls back to the best one when the choice is gone or another language", () => {
    expect(pickVoice(voices, "pt-PT", "Luciana")?.name).toMatch(/Raquel/);
    expect(pickVoice(voices, "pt-PT", null)?.name).toMatch(/Raquel/);
  });
});

describe("readVoiceSettings", () => {
  it("defaults when nothing or garbage is stored", () => {
    expect(readVoiceSettings(null)).toEqual(DEFAULT_VOICE);
    expect(readVoiceSettings("{nope")).toEqual(DEFAULT_VOICE);
  });

  it("keeps values in range and clamps the rest", () => {
    expect(readVoiceSettings(JSON.stringify({ voice: "Joana", rate: 9, pitch: 1.2 }))).toEqual({
      voice: "Joana",
      rate: 1.5,
      pitch: 1.2,
    });
  });
});
