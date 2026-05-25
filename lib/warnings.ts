import type { RawWeather } from "@/lib/weather";
import { currentIndex } from "@/lib/process-weather";

export type Severity = "advisory" | "warning" | "severe";

export type WeatherWarning = {
  id: string;
  severity: Severity;
  emoji: string;
  title: string;
  detail: string;
};

const SEVERITY_RANK: Record<Severity, number> = {
  severe: 3,
  warning: 2,
  advisory: 1,
};

/**
 * Open-Meteo's free tier has no official alerts feed, so warnings are derived
 * from the next 24 h of forecast data using common meteorological thresholds.
 */
export function deriveWarnings(raw: RawWeather): WeatherWarning[] {
  const h = raw.hourly;
  const start = currentIndex(raw);
  const end = Math.min(start + 24, h.time.length);

  const slice = <T>(arr: number[], map: (v: number) => T = (v) => v as T) =>
    arr.slice(start, end).map(map);

  const codes = slice(h.weather_code, (v) => Math.round(v));
  const temps = h.temperature_2m.slice(start, end);
  const gusts = h.wind_gusts_10m.slice(start, end);
  const precip = h.precipitation.slice(start, end);
  const snow = h.snowfall.slice(start, end);
  const vis = h.visibility.slice(start, end);
  const uv = h.uv_index.slice(start, end);

  const max = (a: number[]) => (a.length ? Math.max(...a) : 0);
  const min = (a: number[]) => (a.length ? Math.min(...a) : 0);

  const warnings: WeatherWarning[] = [];

  if (codes.some((c) => c >= 95)) {
    warnings.push({
      id: "thunderstorm",
      severity: "severe",
      emoji: "⛈️",
      title: "Thunderstorm",
      detail: "Thunderstorms expected within 24 hours. Seek shelter indoors.",
    });
  }

  const maxGust = max(gusts);
  if (maxGust >= 90) {
    warnings.push({
      id: "wind-severe",
      severity: "severe",
      emoji: "💨",
      title: "Damaging Winds",
      detail: `Gusts up to ${Math.round(maxGust)} km/h. Secure loose objects, avoid travel.`,
    });
  } else if (maxGust >= 60) {
    warnings.push({
      id: "wind",
      severity: "warning",
      emoji: "💨",
      title: "High Winds",
      detail: `Strong gusts up to ${Math.round(maxGust)} km/h expected.`,
    });
  }

  const maxPrecip = max(precip);
  if (maxPrecip >= 10) {
    warnings.push({
      id: "rain-heavy",
      severity: maxPrecip >= 20 ? "severe" : "warning",
      emoji: "🌧️",
      title: "Heavy Rain",
      detail: `Up to ${maxPrecip.toFixed(1)} mm/h. Localized flooding possible.`,
    });
  }

  const maxSnow = max(snow);
  if (maxSnow >= 1) {
    warnings.push({
      id: "snow",
      severity: maxSnow >= 5 ? "severe" : "warning",
      emoji: "❄️",
      title: "Snowfall",
      detail: `Up to ${maxSnow.toFixed(1)} cm/h. Hazardous travel conditions.`,
    });
  }

  const maxTemp = max(temps);
  if (maxTemp >= 35) {
    warnings.push({
      id: "heat",
      severity: maxTemp >= 40 ? "severe" : "warning",
      emoji: "🥵",
      title: "Extreme Heat",
      detail: `Temperatures up to ${Math.round(maxTemp)}°C. Stay hydrated, avoid sun.`,
    });
  }

  const minTemp = min(temps);
  if (minTemp <= -10) {
    warnings.push({
      id: "cold",
      severity: minTemp <= -20 ? "severe" : "warning",
      emoji: "🥶",
      title: "Extreme Cold",
      detail: `Temperatures down to ${Math.round(minTemp)}°C. Risk of frostbite.`,
    });
  }

  if (codes.some((c) => c === 45 || c === 48) || min(vis) < 1000) {
    warnings.push({
      id: "fog",
      severity: "advisory",
      emoji: "🌫️",
      title: "Fog / Low Visibility",
      detail: "Reduced visibility expected. Drive with caution.",
    });
  }

  if (max(uv) >= 8) {
    warnings.push({
      id: "uv",
      severity: "advisory",
      emoji: "🧴",
      title: "Very High UV",
      detail: `UV index up to ${Math.round(max(uv))}. Use sun protection.`,
    });
  }

  return warnings.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );
}
