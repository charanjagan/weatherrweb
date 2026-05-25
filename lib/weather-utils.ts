export function wmoToCondition(code: number): string {
  if (code === 0) return "Clear Sky";
  if (code === 1) return "Mainly Clear";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing Drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing Rain";
  if (code >= 71 && code <= 75) return "Snow";
  if (code === 77) return "Snow Grains";
  if (code >= 80 && code <= 82) return "Rain Showers";
  if (code >= 85 && code <= 86) return "Snow Showers";
  if (code === 95) return "Thunderstorm";
  if (code >= 96 && code <= 99) return "Thunderstorm";
  return "Clear Sky";
}

export function wmoToEmoji(code: number, isDay = true): string {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code === 1) return isDay ? "🌤️" : "🌙";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 55) return "🌦️";
  if (code >= 56 && code <= 57) return "🌧️";
  if (code >= 61 && code <= 65) return "🌧️";
  if (code >= 66 && code <= 67) return "🌨️";
  if (code >= 71 && code <= 75) return "❄️";
  if (code === 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code === 95) return "⛈️";
  if (code >= 96 && code <= 99) return "⛈️";
  return isDay ? "☀️" : "🌙";
}

type GradientStop = { top: string; bottom: string };
export type Theme = "light" | "dark";

export function wmoToGradient(
  code: number,
  isDay: boolean,
  theme: Theme = "dark"
): GradientStop {
  if (theme === "light") {
    if (!isDay) return { top: "#c2d2e6", bottom: "#8fa3bd" };
    if (code === 0 || code === 1) return { top: "#aee0ff", bottom: "#6fb0ec" };
    if (code === 2) return { top: "#bcdcef", bottom: "#84b3d6" };
    if (code === 3) return { top: "#cdd6de", bottom: "#9aaab8" };
    if (code === 45 || code === 48) return { top: "#d2d8dd", bottom: "#a7b1ba" };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
      return { top: "#aec3d0", bottom: "#7995a8" };
    if (code >= 71 && code <= 77) return { top: "#dde8ef", bottom: "#b3cad9" };
    if (code >= 95) return { top: "#b9c0cc", bottom: "#8b94a4" };
    return { top: "#aee0ff", bottom: "#6fb0ec" };
  }
  if (!isDay) return { top: "#0e1f33", bottom: "#08121e" };
  if (code === 0 || code === 1) return { top: "#5ab5f7", bottom: "#1a4eb5" };
  if (code === 2) return { top: "#6aadd8", bottom: "#2a5e8a" };
  if (code === 3) return { top: "#7a8fa0", bottom: "#3a4f60" };
  if (code === 45 || code === 48) return { top: "#8a9cad", bottom: "#4a5c6d" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return { top: "#4a6878", bottom: "#1e3040" };
  if (code >= 71 && code <= 77) return { top: "#9ab5c8", bottom: "#5a7a98" };
  if (code >= 95) return { top: "#2a3040", bottom: "#0d1520" };
  return { top: "#5ab5f7", bottom: "#1a4eb5" };
}

export type ChromePalette = {
  text: string;
  sub: string;
  faint: string;
  card: string;
  cardStrong: string;
  border: string;
  track: string;
  accent: string;
  overlay: string;
};

export function chrome(theme: Theme): ChromePalette {
  if (theme === "light") {
    return {
      text: "#0f2740",
      sub: "rgba(15,39,64,0.62)",
      faint: "rgba(15,39,64,0.45)",
      card: "rgba(255,255,255,0.55)",
      cardStrong: "rgba(255,255,255,0.78)",
      border: "rgba(15,39,64,0.1)",
      track: "rgba(15,39,64,0.14)",
      accent: "#0a84ff",
      overlay: "rgba(20,30,48,0.35)",
    };
  }
  return {
    text: "#ffffff",
    sub: "rgba(255,255,255,0.7)",
    faint: "rgba(255,255,255,0.5)",
    card: "rgba(255,255,255,0.12)",
    cardStrong: "rgba(255,255,255,0.18)",
    border: "rgba(255,255,255,0.2)",
    track: "rgba(255,255,255,0.2)",
    accent: "#7dd3fc",
    overlay: "rgba(0,0,0,0.45)",
  };
}

export const severityColor = (
  severity: "advisory" | "warning" | "severe"
): string =>
  ({
    advisory: "#eab308",
    warning: "#f97316",
    severe: "#ef4444",
  })[severity];

export function formatHour(date: Date): string {
  const h = date.getUTCHours();
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

export function compassDir(degrees: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(degrees / 22.5) % 16];
}
