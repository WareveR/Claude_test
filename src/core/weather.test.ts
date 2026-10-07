import { describe, expect, it } from "vitest";
import {
  compassPoint,
  forecastQuery,
  forecastSite,
  parseForecast,
  parsePlaces,
  placeClock,
  weatherKind,
} from "./weather";

describe("weatherKind", () => {
  it("maps WMO codes to the eight icons", () => {
    expect([0, 1, 2, 3, 45, 48].map(weatherKind)).toEqual([
      "sunny",
      "sunny",
      "partlyCloudy",
      "cloudy",
      "fog",
      "fog",
    ]);
    expect([51, 55, 61, 65, 66].map(weatherKind)).toEqual(Array(5).fill("rain"));
    expect([80, 82].map(weatherKind)).toEqual(["showers", "showers"]);
    expect([71, 77, 85, 86].map(weatherKind)).toEqual(Array(4).fill("snow"));
    expect([95, 96, 99].map(weatherKind)).toEqual(Array(3).fill("thunder"));
  });
});

describe("parseForecast", () => {
  it("keeps complete days and hours, rounded", () => {
    const forecast = parseForecast({
      utc_offset_seconds: 3600,
      daily: {
        time: ["2026-10-02", "2026-10-03"],
        weather_code: [3, null],
        temperature_2m_max: [21.6, 20],
        temperature_2m_min: [12.4, 11],
        precipitation_probability_max: [35.4, 10],
      },
      hourly: {
        time: ["2026-10-02T00:00", "2026-10-02T01:00"],
        weather_code: [61, 2],
        temperature_2m: [14.5, 13.2],
        precipitation_probability: [80, null],
      },
    });
    expect(forecast.utcOffset).toBe(3600);
    expect(forecast.daily).toEqual([{ date: "2026-10-02", code: 3, max: 22, min: 12, rain: 35 }]);
    expect(forecast.hourly).toEqual([
      { time: "2026-10-02T00:00", code: 61, temp: 15, rain: 80 },
      { time: "2026-10-02T01:00", code: 2, temp: 13, rain: 0 },
    ]);
  });

  it("keeps wind, humidity, UV and the current conditions when Open-Meteo has them", () => {
    const forecast = parseForecast({
      utc_offset_seconds: 3600,
      current: {
        time: "2026-10-02T14:15",
        weather_code: 2,
        temperature_2m: 19.6,
        apparent_temperature: 18.2,
        relative_humidity_2m: 64,
        wind_speed_10m: 12.4,
        wind_direction_10m: 315,
      },
      daily: {
        time: ["2026-10-02"],
        weather_code: [3],
        temperature_2m_max: [21],
        temperature_2m_min: [12],
        wind_speed_10m_max: [24.7],
        wind_direction_10m_dominant: [300],
        uv_index_max: [5.4],
      },
      hourly: {
        time: ["2026-10-02T14:00", "2026-10-02T15:00"],
        weather_code: [2, 2],
        temperature_2m: [19, 20],
        precipitation_probability: [10, 5],
        relative_humidity_2m: [65, null],
        wind_speed_10m: [12.4, 13],
        wind_direction_10m: [310, 320],
      },
    });
    expect(forecast.current).toEqual({
      time: "2026-10-02T14:15",
      code: 2,
      temp: 20,
      feels: 18,
      humidity: 64,
      wind: 12,
      windDir: 315,
    });
    expect(forecast.daily[0]).toEqual({
      date: "2026-10-02",
      code: 3,
      max: 21,
      min: 12,
      wind: 25,
      windDir: 300,
      uv: 5,
    });
    expect(forecast.hourly[0]).toMatchObject({ humidity: 65, wind: 12, windDir: 310 });
    expect(forecast.hourly[1]).not.toHaveProperty("humidity");
  });

  it("names the nearest compass point", () => {
    expect([0, 44, 46, 180, 337, 338, 359, -90].map(compassPoint)).toEqual([
      "N",
      "NE",
      "NE",
      "S",
      "NW",
      "N",
      "N",
      "W",
    ]);
  });

  it("reads the place's clock from its offset", () => {
    expect(placeClock(3600, new Date("2026-10-02T23:30:00Z"))).toBe("2026-10-03T00:30");
  });

  it("refuses an answer without days or hours", () => {
    expect(() => parseForecast({ error: true, reason: "x" })).toThrow();
  });

  it("asks for 16 days in the place's own clock", () => {
    const query = new URLSearchParams(forecastQuery({ latitude: 38.72, longitude: -9.14 }));
    expect(query.get("forecast_days")).toBe("16");
    expect(query.get("past_days")).toBe("1");
    expect(query.get("timezone")).toBe("auto");
    expect(query.get("hourly")).toContain("precipitation_probability");
    expect(query.get("hourly")).toContain("relative_humidity_2m");
    expect(query.get("current")).toContain("wind_direction_10m");
  });
});

describe("places", () => {
  it("keeps complete search results", () => {
    expect(
      parsePlaces({
        results: [
          {
            id: 2267057,
            name: "Lisboa",
            admin1: "Lisboa",
            country: "Portugal",
            country_code: "PT",
            latitude: 38.71667,
            longitude: -9.13333,
          },
          { name: "Nowhere" },
        ],
      }),
    ).toEqual([
      {
        name: "Lisboa",
        admin: "Lisboa",
        country: "Portugal",
        countryCode: "PT",
        latitude: 38.71667,
        longitude: -9.13333,
      },
    ]);
    expect(parsePlaces({ generationtime_ms: 1 })).toEqual([]);
  });

  it("links IPMA in Portugal and yr.no elsewhere", () => {
    expect(forecastSite({ countryCode: "PT", latitude: 38.7, longitude: -9.1 }).name).toBe("IPMA");
    expect(forecastSite({ countryCode: "ES", latitude: 40.4168, longitude: -3.7038 })).toEqual({
      name: "yr.no",
      url: "https://www.yr.no/en/forecast/daily-table/40.4168,-3.7038",
    });
  });
});
