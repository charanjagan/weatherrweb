export type TempUnit = "c" | "f";
export type WindUnit = "kmh" | "mph" | "ms" | "kn";
export type PressureUnit = "hpa" | "inhg" | "mmhg";
export type PrecipUnit = "mm" | "in";
export type DistanceUnit = "km" | "mi";

export type Units = {
  temp: TempUnit;
  wind: WindUnit;
  pressure: PressureUnit;
  precip: PrecipUnit;
  distance: DistanceUnit;
};

export const METRIC_UNITS: Units = {
  temp: "c",
  wind: "kmh",
  pressure: "hpa",
  precip: "mm",
  distance: "km",
};

export const IMPERIAL_UNITS: Units = {
  temp: "f",
  wind: "mph",
  pressure: "inhg",
  precip: "in",
  distance: "mi",
};

// ── Conversions (from API base units: °C, km/h, hPa, mm, metres) ──────────────
export const toTemp = (c: number, u: TempUnit) => (u === "f" ? c * 1.8 + 32 : c);

export const toWind = (kmh: number, u: WindUnit) => {
  if (u === "mph") return kmh / 1.609344;
  if (u === "ms") return kmh / 3.6;
  if (u === "kn") return kmh / 1.852;
  return kmh;
};

export const toPressure = (hpa: number, u: PressureUnit) => {
  if (u === "inhg") return hpa * 0.02953;
  if (u === "mmhg") return hpa * 0.750062;
  return hpa;
};

export const toPrecip = (mm: number, u: PrecipUnit) => (u === "in" ? mm / 25.4 : mm);

/** base is metres */
export const toDistance = (m: number, u: DistanceUnit) =>
  u === "mi" ? m / 1609.344 : m / 1000;

// ── Labels ───────────────────────────────────────────────────────────────────
export const windLabel = (u: WindUnit) =>
  ({ kmh: "km/h", mph: "mph", ms: "m/s", kn: "kn" })[u];
export const pressureLabel = (u: PressureUnit) =>
  ({ hpa: "hPa", inhg: "inHg", mmhg: "mmHg" })[u];
export const precipLabel = (u: PrecipUnit) => (u === "in" ? "in" : "mm");
export const distanceLabel = (u: DistanceUnit) => (u === "mi" ? "mi" : "km");
export const tempLabel = (u: TempUnit) => (u === "f" ? "°F" : "°C");

// ── Formatters ───────────────────────────────────────────────────────────────
export const fmtTemp = (c: number, u: Units["temp"]) =>
  `${Math.round(toTemp(c, u))}°`;

export const fmtWind = (kmh: number, u: WindUnit) =>
  `${Math.round(toWind(kmh, u))} ${windLabel(u)}`;

export const fmtPressure = (hpa: number, u: PressureUnit) => {
  const v = toPressure(hpa, u);
  return `${u === "hpa" ? Math.round(v) : v.toFixed(2)} ${pressureLabel(u)}`;
};

export const fmtPrecip = (mm: number, u: PrecipUnit) => {
  const v = toPrecip(mm, u);
  return `${u === "in" ? v.toFixed(2) : v.toFixed(1)} ${precipLabel(u)}`;
};

export const fmtDistance = (m: number, u: DistanceUnit) => {
  const v = toDistance(m, u);
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${distanceLabel(u)}`;
};
