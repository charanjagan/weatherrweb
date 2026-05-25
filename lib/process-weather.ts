import type { RawWeather } from "@/lib/weather";
import { wmoToEmoji, formatHour } from "@/lib/weather-utils";

export type CurrentConditions = {
  code: number;
  temp: number;
  feels: number;
  humidity: number;
  dewPoint: number;
  wind: number;
  gusts: number;
  windDir: number;
  visibility: number; // metres
  pressure: number;
  cloud: number;
  precipProb: number;
  precip: number; // mm
  uvIndex: number;
};

export type HourPoint = {
  t: number;
  label: string;
  code: number;
  emoji: string;
  temp: number;
  precip: number; // probability %
};

export type DayPoint = {
  label: string;
  code: number;
  emoji: string;
  minTemp: number;
  maxTemp: number;
  maxPrecip: number; // probability %
};

export type WeatherModel = {
  latitude: number;
  longitude: number;
  elevation: number;
  isDay: boolean;
  current: CurrentConditions;
  todayHigh: number;
  todayLow: number;
  hourly: HourPoint[];
  daily: DayPoint[];
  overallMin: number;
  overallMax: number;
};

export function currentIndex(raw: RawWeather): number {
  const nowLocalUnix = Math.floor(Date.now() / 1000) + raw.utcOffsetSeconds;
  const idx = raw.hourly.time.findIndex((t) => t >= nowLocalUnix);
  if (idx === -1) return Math.max(0, raw.hourly.time.length - 1);
  return Math.max(0, idx - 1);
}

const at = (arr: number[], i: number) => arr[i] ?? 0;

export function computeModel(raw: RawWeather): WeatherModel {
  const h = raw.hourly;
  const idx = currentIndex(raw);

  const localHour = new Date((h.time[idx] ?? 0) * 1000).getUTCHours();
  const isDay = localHour >= 6 && localHour < 20;

  const current: CurrentConditions = {
    code: Math.round(at(h.weather_code, idx)),
    temp: at(h.temperature_2m, idx),
    feels: at(h.apparent_temperature, idx),
    humidity: at(h.relative_humidity_2m, idx),
    dewPoint: at(h.dew_point_2m, idx),
    wind: at(h.wind_speed_10m, idx),
    gusts: at(h.wind_gusts_10m, idx),
    windDir: at(h.wind_direction_10m, idx),
    visibility: at(h.visibility, idx),
    pressure: at(h.pressure_msl, idx),
    cloud: at(h.cloud_cover, idx),
    precipProb: at(h.precipitation_probability, idx),
    precip: at(h.precipitation, idx),
    uvIndex: at(h.uv_index, idx),
  };

  // Today high / low from hourly data for the current calendar day
  const todayKey = new Date((h.time[idx] ?? 0) * 1000).toISOString().slice(0, 10);
  const todayTemps: number[] = [];
  h.time.forEach((t, i) => {
    if (new Date(t * 1000).toISOString().slice(0, 10) === todayKey) {
      todayTemps.push(at(h.temperature_2m, i));
    }
  });
  const todayHigh = Math.round(Math.max(...todayTemps));
  const todayLow = Math.round(Math.min(...todayTemps));

  // Next 25 hours
  const hourly: HourPoint[] = [];
  for (let offset = 0; offset < 25; offset++) {
    const i = idx + offset;
    if (h.time[i] === undefined) break;
    const date = new Date(h.time[i] * 1000);
    const hr = date.getUTCHours();
    const code = Math.round(at(h.weather_code, i));
    hourly.push({
      t: h.time[i],
      label: offset === 0 ? "Now" : formatHour(date),
      code,
      emoji: wmoToEmoji(code, hr >= 6 && hr < 20),
      temp: at(h.temperature_2m, i),
      precip: Math.round(at(h.precipitation_probability, i)),
    });
  }

  // Group by day → 7-day forecast
  const dayMap = new Map<string, number[]>();
  h.time.forEach((t, i) => {
    const key = new Date(t * 1000).toISOString().slice(0, 10);
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(i);
  });

  const daily: DayPoint[] = Array.from(dayMap.values())
    .slice(0, 7)
    .map((idxs, di) => {
      const temps = idxs.map((i) => at(h.temperature_2m, i));
      const codes = idxs.map((i) => Math.round(at(h.weather_code, i)));
      const precips = idxs.map((i) => at(h.precipitation_probability, i));
      const noonCode = codes[Math.floor(codes.length / 2)] ?? 0;
      const date = new Date((h.time[idxs[0]] ?? 0) * 1000);
      const label =
        di === 0
          ? "Today"
          : date.toLocaleDateString("en-US", {
              weekday: "short",
              timeZone: "UTC",
            });
      return {
        label,
        code: noonCode,
        emoji: wmoToEmoji(noonCode, true),
        minTemp: Math.round(Math.min(...temps)),
        maxTemp: Math.round(Math.max(...temps)),
        maxPrecip: Math.round(Math.max(...precips)),
      };
    });

  const overallMin = Math.min(...daily.map((d) => d.minTemp));
  const overallMax = Math.max(...daily.map((d) => d.maxTemp));

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    elevation: raw.elevation,
    isDay,
    current,
    todayHigh,
    todayLow,
    hourly,
    daily,
    overallMin,
    overallMax,
  };
}
