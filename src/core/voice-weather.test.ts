import { describe, expect, it } from "vitest";
import { weatherAnswer } from "./voice-weather";

const forecast = {
  place: "Lisboa",
  days: [
    { date: "2026-10-09", code: 61, max: 18.4, min: 12.2, rain: 80 },
    { date: "2026-10-10", code: 0, max: 22, min: 14, rain: 5 },
  ],
  hours: [
    { time: "2026-10-09T09:00", code: 3, temp: 13, rain: 30 },
    { time: "2026-10-09T15:00", code: 61, temp: 17, rain: 80 },
  ],
};

describe("weatherAnswer", () => {
  it("says the sky, the temperatures and when rain is most likely", () => {
    expect(weatherAnswer("2026-10-09", forecast, "pt-PT")).toBe(
      "sexta-feira, 9 de outubro em Lisboa: chuva, entre 12 e 18 graus, 80% de probabilidade de chuva, mais provável por volta das 15:00.",
    );
    expect(weatherAnswer("2026-10-10", forecast, "en")).toBe(
      "Saturday 10 October in Lisboa: sunny, between 14 and 22 degrees, no rain expected.",
    );
  });

  it("says when there is no forecast for the day, or none at all", () => {
    expect(weatherAnswer("2026-11-30", forecast, "en")).toBe(
      "There is no forecast for that day yet.",
    );
    expect(weatherAnswer("2026-10-09", null, "pt-PT")).toContain("Não há previsão");
  });
});
