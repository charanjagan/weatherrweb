"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, type SavedLocation } from "@/app/components/store";
import Header from "@/app/components/Header";
import SettingsModal from "@/app/components/SettingsModal";
import LocationModal from "@/app/components/LocationModal";
import WarningsBanner from "@/app/components/WarningsBanner";
import { computeModel } from "@/lib/process-weather";
import { deriveWarnings } from "@/lib/warnings";
import { wmoToCondition, wmoToEmoji, compassDir } from "@/lib/weather-utils";
import {
  fmtTemp,
  fmtWind,
  fmtDistance,
  toWind,
  windLabel,
  type Units,
} from "@/lib/units";
import type { RawWeather } from "@/lib/weather";
import type { WeatherModel, DayPoint } from "@/lib/process-weather";
import { searchLocations, type GeoLocation } from "@/lib/geocoding";

// ── Time-of-day background gradient ─────────────────────────────────────────
function timeGradient(hour: number): string {
  if (hour >= 6 && hour < 12)
    return "linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)";
  if (hour >= 12 && hour < 18)
    return "linear-gradient(160deg, #0f3460 0%, #533483 100%)";
  if (hour >= 18 && hour < 22)
    return "linear-gradient(160deg, #1a1a2e 0%, #e94560 100%)";
  return "linear-gradient(160deg, #0d0d0d 0%, #1a1a2e 100%)";
}

// ── Simple solar calculation (NOAA approximation) ───────────────────────────
function solarTimes(
  lat: number,
  lon: number,
  date: Date
): { sunrise: Date; sunset: Date } | null {
  const rad = Math.PI / 180;
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / 86400000
  );
  const B = (360 / 365) * (dayOfYear - 81) * rad;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const decl = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * rad);
  const cosHa = -Math.tan(lat * rad) * Math.tan(decl * rad);
  if (cosHa < -1 || cosHa > 1) return null;
  const ha = Math.acos(cosHa) / rad;
  const noonUTC = 720 - 4 * lon - eot;
  const startOfDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    sunrise: new Date(startOfDay + (noonUTC - 4 * ha) * 60000),
    sunset: new Date(startOfDay + (noonUTC + 4 * ha) * 60000),
  };
}

// ── Glass card wrapper ───────────────────────────────────────────────────────
function GlassCard({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`glass-card ${className}`} style={style}>
      {children}
    </div>
  );
}

function motionFadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay },
  };
}

// ── WeatherApp ───────────────────────────────────────────────────────────────
export default function WeatherApp() {
  const {
    ready,
    resolvedTheme,
    settings,
    setUnits,
    activeLocation,
    savedLocations,
    addLocation,
    setActive,
    activeId,
    currentGeo,
    geoStatus,
    requestCurrentLocation,
  } = useApp();

  const [rawWeather, setRawWeather] = useState<RawWeather | null>(null);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [aqi, setAqi] = useState<number | null>(null);
  const [locationName, setLocationName] = useState("My Location");
  const [locationCountry, setLocationCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoLocation[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [savedTemps, setSavedTemps] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Kick off geolocation on first ready
  useEffect(() => {
    if (!ready) return;
    if (!currentGeo && geoStatus === "idle") requestCurrentLocation();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fall back to Chennai if geo denied and no saved/active location
  useEffect(() => {
    if (!ready || geoStatus !== "denied") return;
    if (activeLocation || savedLocations.length > 0) return;
    const chennai: SavedLocation = {
      id: "chennai-fallback",
      name: "Chennai",
      latitude: 13.0827,
      longitude: 80.2707,
      country: "India",
      admin1: "Tamil Nadu",
    };
    addLocation(chennai);
    setActive(chennai.id);
  }, [ready, geoStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive coord key
  const lat = activeLocation?.latitude;
  const lon = activeLocation?.longitude;
  const coordKey =
    lat !== undefined && lon !== undefined
      ? `${lat.toFixed(4)},${lon.toFixed(4)}`
      : null;

  // Fetch weather + AQI when coords change
  useEffect(() => {
    if (!coordKey) return;
    const [latS, lonS] = coordKey.split(",");
    const clat = parseFloat(latS);
    const clon = parseFloat(lonS);
    let cancelled = false;

    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setFetchError(false);
    /* eslint-enable react-hooks/set-state-in-effect */

    Promise.all([
      fetch(`/api/weather?lat=${clat}&lon=${clon}`).then((r) =>
        r.ok ? (r.json() as Promise<RawWeather>) : Promise.reject()
      ),
      fetch(`/api/aqi?lat=${clat}&lon=${clon}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([weather, aqiData]) => {
        if (cancelled) return;
        setRawWeather(weather);
        setFetchedKey(coordKey);
        setAqi((aqiData as { aqi: number | null } | null)?.aqi ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [coordKey, retryTick]);

  // Reverse geocode when coords change
  useEffect(() => {
    if (!coordKey) return;
    if (activeLocation && !activeLocation.isCurrent) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setLocationName(activeLocation.name);
      setLocationCountry(activeLocation.sublabel);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const [latS, lonS] = coordKey.split(",");
    fetch(`/api/reverse?lat=${latS}&lon=${lonS}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { name?: string; country?: string } | null) => {
        if (d?.name) setLocationName(d.name);
        if (d?.country) setLocationCountry(d.country);
      })
      .catch(() => {});
  }, [coordKey, activeLocation?.isCurrent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch temps for saved location pills
  const savedLocKey = useMemo(
    () => savedLocations.map((l) => l.id).join(","),
    [savedLocations]
  );
  useEffect(() => {
    savedLocations.forEach((loc) => {
      if (savedTemps[loc.id] !== undefined) return;
      fetch(`/api/weather?lat=${loc.latitude}&lon=${loc.longitude}`)
        .then((r) => (r.ok ? (r.json() as Promise<RawWeather>) : Promise.reject()))
        .then((data) => {
          const m = computeModel(data);
          setSavedTemps((prev) => ({ ...prev, [loc.id]: m.current.temp }));
        })
        .catch(() => {});
    });
  }, [savedLocKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSearchResults([]);
      setSearchLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const id = setTimeout(async () => {
      const res = await searchLocations(q);
      if (!cancelled) {
        setSearchResults(res);
        setSearchLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [searchQuery]);

  const model = useMemo(
    () => (rawWeather && fetchedKey === coordKey ? computeModel(rawWeather) : null),
    [rawWeather, fetchedKey, coordKey]
  );

  const warnings = useMemo(
    () => (rawWeather ? deriveWarnings(rawWeather) : []),
    [rawWeather]
  );

  const solar =
    lat !== undefined && lon !== undefined
      ? solarTimes(lat, lon, clock)
      : null;

  const pickSearchResult = useCallback(
    (g: GeoLocation) => {
      const loc: SavedLocation = {
        id: g.id,
        name: g.name,
        latitude: g.latitude,
        longitude: g.longitude,
        country: g.country,
        admin1: g.admin1,
      };
      addLocation(loc);
      setActive(loc.id);
      setSearchQuery("");
      setSearchResults([]);
      setSearchFocused(false);
    },
    [addLocation, setActive]
  );

  const isStale = loading && model !== null;
  const showSkeleton = loading && model === null && !fetchError;
  const showError = fetchError && model === null;
  const showWeather = model !== null;
  const showEmpty =
    !showSkeleton && !showError && !showWeather && !loading;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Dynamic background */}
      <div
        className="fixed inset-0"
        style={{
          background: timeGradient(clock.getHours()),
          transition: "background 3s ease",
        }}
      />

      {/* Original header bar */}
      <Header theme={resolvedTheme} />

      {/* Content layer — offset by header height (h-14 = 56px) */}
      <div className="relative z-10 flex flex-col h-full pt-14">
        {/* Top bar */}
        <TopBar
          locationName={locationName}
          clock={clock}
          units={settings.units}
          onSetUnits={(temp) => setUnits({ temp })}
          onOpenLocations={() => setLocationsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Search bar */}
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="mx-auto max-w-2xl relative">
            <GlassCard className="flex items-center gap-2 px-4 py-2.5" style={{ borderRadius: 50 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Search city or place…"
                autoComplete="off"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/30"
                style={{ color: "rgba(255,255,255,0.9)" }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                  className="text-white/30 text-sm leading-none"
                >✕</button>
              )}
            </GlassCard>

            <AnimatePresence>
              {searchFocused && searchQuery.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 right-0 mt-2 glass-card z-50 overflow-hidden"
                  style={{ maxHeight: 280, overflowY: "auto" }}
                >
                  {searchLoading && (
                    <p className="px-4 py-3 text-sm text-white/40">Searching…</p>
                  )}
                  {!searchLoading && searchResults.length === 0 && (
                    <p className="px-4 py-3 text-sm text-white/40">No results</p>
                  )}
                  {searchResults.map((g, i) => (
                    <button
                      key={g.id}
                      onMouseDown={() => pickSearchResult(g)}
                      className="w-full text-left px-4 py-3 transition-colors hover:bg-white/5"
                      style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
                    >
                      <span className="text-sm font-medium text-white/90">{g.name}</span>
                      <span className="text-xs ml-2 text-white/40">
                        {[g.admin1, g.country].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Saved locations row — always visible above scroll area */}
        <div className="px-4 pb-2 flex-shrink-0">
          <SavedLocationsRow
            savedLocations={savedLocations}
            savedTemps={savedTemps}
            units={settings.units}
            activeId={activeId}
            onSelect={setActive}
            onOpenSearch={() => setLocationsOpen(true)}
          />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-8">
          <div className="mx-auto max-w-2xl space-y-3">
            {showSkeleton && <SkeletonLoader />}

            {showError && (
              <GlassCard className="p-8 text-center">
                <p className="text-4xl mb-3">⚠️</p>
                <p className="text-white/60 text-sm mb-4">
                  Couldn&apos;t load weather data
                </p>
                <button
                  onClick={() => { setFetchError(false); setRetryTick((t) => t + 1); }}
                  className="px-5 py-2 rounded-full text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                >
                  Retry
                </button>
              </GlassCard>
            )}

            {showEmpty && (
              <GlassCard className="p-10 text-center">
                <p className="text-5xl mb-4">📍</p>
                <p className="font-semibold text-white/90 mb-1">
                  {geoStatus === "loading" ? "Finding your location…" : "No location selected"}
                </p>
                <p className="text-sm text-white/40">
                  {geoStatus === "denied"
                    ? "Location access denied — search above"
                    : "Search for a city above or enable location access"}
                </p>
              </GlassCard>
            )}

            {showWeather && model && (
              <div style={{ opacity: isStale ? 0.6 : 1, transition: "opacity 0.2s" }}>
                <HeroCard
                  model={model}
                  units={settings.units}
                  locationName={locationName}
                  locationCountry={locationCountry}
                  solar={solar}
                  nowMs={clock.getTime()}
                />

                {warnings.length > 0 && (
                  <motion.div
                    {...motionFadeUp(0.05)}
                    className="mt-3"
                  >
                    <WarningsBanner warnings={warnings} theme="dark" compact />
                  </motion.div>
                )}

                <StatsRow model={model} units={settings.units} />
                <HourlyChart model={model} units={settings.units} />

                {aqi !== null && <AQICard aqi={aqi} />}

                <ForecastCard model={model} units={settings.units} />
              </div>
            )}
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LocationModal open={locationsOpen} onClose={() => setLocationsOpen(false)} />
    </div>
  );
}

// ── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({
  locationName,
  clock,
  units,
  onSetUnits,
  onOpenLocations,
  onOpenSettings,
}: {
  locationName: string;
  clock: Date;
  units: Units;
  onSetUnits: (temp: "c" | "f") => void;
  onOpenLocations: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="px-4 pt-4 pb-2 flex-shrink-0">
      <GlassCard
        className="mx-auto max-w-2xl flex items-center px-4 py-3"
        style={{ borderRadius: 50 }}
      >
        {/* Left — °C / °F toggle */}
        <div className="flex-1 flex items-center">
          <div
            className="flex items-center rounded-full p-0.5"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            {(["c", "f"] as const).map((u) => (
              <button
                key={u}
                onClick={() => onSetUnits(u)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background:
                    units.temp === u ? "rgba(255,255,255,0.88)" : "transparent",
                  color: units.temp === u ? "#111" : "rgba(255,255,255,0.5)",
                }}
              >
                °{u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Center — location (truly centered) */}
        <button
          onClick={onOpenLocations}
          className="flex items-center gap-1.5 min-w-0 flex-shrink-0 px-2"
        >
          <span className="text-base leading-none flex-shrink-0">📍</span>
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "rgba(255,255,255,0.9)", maxWidth: "180px" }}
          >
            {locationName}
          </span>
        </button>

        {/* Right — clock + settings */}
        <div className="flex-1 flex items-center justify-end gap-2">
          <span
            className="text-[13px] font-mono tabular-nums"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            {clock.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

// ── HeroCard ─────────────────────────────────────────────────────────────────
function HeroCard({
  model,
  units,
  locationName,
  locationCountry,
  solar,
  nowMs,
}: {
  model: WeatherModel;
  units: Units;
  locationName: string;
  locationCountry: string;
  solar: { sunrise: Date; sunset: Date } | null;
  nowMs: number;
}) {
  const { current } = model;
  const now = nowMs;

  let sunProgress = 0.5;
  if (solar) {
    const total = solar.sunset.getTime() - solar.sunrise.getTime();
    const elapsed = now - solar.sunrise.getTime();
    sunProgress = Math.max(0, Math.min(1, elapsed / total));
  }

  return (
    <motion.div {...motionFadeUp(0)}>
      <GlassCard className="p-6 pb-5">
        {/* Location name */}
        <div className="text-center mb-3">
          <h1 className="text-xl font-semibold text-white/90">{locationName}</h1>
          {locationCountry && (
            <p className="text-sm text-white/40 mt-0.5">{locationCountry}</p>
          )}
        </div>

        {/* Big temperature */}
        <div className="text-center">
          <div
            className="font-light leading-none text-white"
            style={{ fontSize: 80 }}
          >
            {fmtTemp(current.temp, units.temp)}
          </div>

          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-3xl leading-none">
              {wmoToEmoji(current.code, model.isDay)}
            </span>
            <span className="text-lg font-medium text-white/80">
              {wmoToCondition(current.code)}
            </span>
          </div>

          <p className="text-sm text-white/45 mt-1">
            Feels like {fmtTemp(current.feels, units.temp)}
          </p>
          <p className="text-sm text-white/40 mt-0.5">
            H:{fmtTemp(model.todayHigh, units.temp)} · L:{fmtTemp(model.todayLow, units.temp)}
          </p>
        </div>

        {/* Sunrise / Sunset progress */}
        {solar && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-white/40 mb-2">
              <span>
                🌅{" "}
                {solar.sunrise.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>
                🌇{" "}
                {solar.sunset.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div
              className="relative h-px rounded-full"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${sunProgress * 100}%`,
                  background: "rgba(255,255,255,0.55)",
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{
                  left: `calc(${sunProgress * 100}% - 6px)`,
                  background: "white",
                  boxShadow: "0 0 10px 4px rgba(255,255,255,0.55)",
                }}
              />
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

// ── StatsRow ─────────────────────────────────────────────────────────────────
function StatsRow({ model, units }: { model: WeatherModel; units: Units }) {
  const { current } = model;
  const uv = Math.round(current.uvIndex);

  const uvLabel =
    uv >= 11 ? "Extreme" : uv >= 8 ? "Very High" : uv >= 6 ? "High" : uv >= 3 ? "Moderate" : "Low";
  const uvColor =
    uv >= 11 ? "#7c3aed" : uv >= 8 ? "#a855f7" : uv >= 6 ? "#ef4444" : uv >= 3 ? "#f59e0b" : "#22c55e";

  return (
    <motion.div
      {...motionFadeUp(0.1)}
      className="grid grid-cols-2 gap-3 mt-3"
    >
      {/* Humidity */}
      <GlassCard className="p-4">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40 mb-2">
          Humidity
        </p>
        <p className="text-3xl font-semibold text-white/90">
          {Math.round(current.humidity)}%
        </p>
        <div className="mt-2 h-1 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white/55"
            style={{ width: `${current.humidity}%` }}
          />
        </div>
        <p className="text-xs text-white/40 mt-2">
          Dew pt {fmtTemp(current.dewPoint, units.temp)}
        </p>
      </GlassCard>

      {/* Wind */}
      <GlassCard className="p-4">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40 mb-2">
          Wind
        </p>
        <p className="text-3xl font-semibold text-white/90">
          {Math.round(toWind(current.wind, units.wind))}
          <span className="text-sm font-normal text-white/40 ml-1">
            {windLabel(units.wind)}
          </span>
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="inline-block text-base text-white/60"
            style={{ transform: `rotate(${current.windDir}deg)` }}
          >
            ↑
          </span>
          <span className="text-xs text-white/40">{compassDir(current.windDir)}</span>
        </div>
        <p className="text-xs text-white/40 mt-1">
          Gusts {fmtWind(current.gusts, units.wind)}
        </p>
      </GlassCard>

      {/* UV Index */}
      <GlassCard className="p-4">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40 mb-2">
          UV Index
        </p>
        <p className="text-3xl font-semibold text-white/90">{uv}</p>
        <div
          className="mt-1.5 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: `${uvColor}33`, color: uvColor, border: `1px solid ${uvColor}55` }}
        >
          {uvLabel}
        </div>
        <div className="mt-2 h-1 rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, (uv / 11) * 100)}%`, background: uvColor }}
          />
        </div>
      </GlassCard>

      {/* Visibility */}
      <GlassCard className="p-4">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40 mb-2">
          Visibility
        </p>
        <p className="text-3xl font-semibold text-white/90">
          {fmtDistance(current.visibility, units.distance)}
        </p>
        <p className="text-xs text-white/40 mt-2">
          {current.visibility >= 10000
            ? "Crystal clear"
            : current.visibility >= 5000
              ? "Good visibility"
              : current.visibility >= 1000
                ? "Reduced"
                : "Very poor"}
        </p>
      </GlassCard>
    </motion.div>
  );
}

// ── HourlyChart ───────────────────────────────────────────────────────────────
function HourlyChart({ model, units }: { model: WeatherModel; units: Units }) {
  const points = model.hourly.slice(0, 24);
  const SLOT = 52;
  const W = points.length * SLOT;
  const SVG_H = 80;
  const PAD_TOP = 22;
  const PAD_BOT = 8;
  const CHART_H = SVG_H - PAD_TOP - PAD_BOT;

  const temps = points.map((p) => p.temp);
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const tRange = maxT - minT || 1;

  const cx = (i: number) => (i + 0.5) * SLOT;
  const cy = (t: number) => PAD_TOP + (1 - (t - minT) / tRange) * CHART_H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${cy(p.temp).toFixed(1)}`)
    .join(" ");
  const areaPath =
    linePath +
    ` L${cx(points.length - 1).toFixed(1)},${SVG_H} L${cx(0).toFixed(1)},${SVG_H} Z`;

  return (
    <motion.div {...motionFadeUp(0.2)} className="mt-3">
      <GlassCard className="overflow-hidden">
        <p className="px-4 pt-3 pb-2 text-[10px] font-semibold tracking-widest uppercase text-white/40"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          Hourly Forecast
        </p>
        <div className="overflow-x-auto scrollbar-none">
          <div style={{ width: W, padding: "10px 0 6px" }}>
            <svg width={W} height={SVG_H} style={{ display: "block", overflow: "visible" }}>
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
                <filter id="lineGlow" x="-20%" y="-40%" width="140%" height="180%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path d={areaPath} fill="url(#chartFill)" />
              <path
                d={linePath}
                fill="none"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#lineGlow)"
              />
              {points.map(
                (p, i) =>
                  i % 4 === 0 && (
                    <text
                      key={i}
                      x={cx(i)}
                      y={cy(p.temp) - 7}
                      textAnchor="middle"
                      fontSize="10"
                      fill="rgba(255,255,255,0.7)"
                      fontWeight="600"
                    >
                      {fmtTemp(p.temp, units.temp)}
                    </text>
                  )
              )}
            </svg>
            <div className="flex">
              {points.map((p, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-0.5 flex-shrink-0"
                  style={{ width: SLOT }}
                >
                  <span className="text-base leading-none">{p.emoji}</span>
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color:
                        p.label === "Now"
                          ? "rgba(255,255,255,0.9)"
                          : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {p.label}
                  </span>
                  {p.precip >= 20 && (
                    <span className="text-[9px]" style={{ color: "#7dd3fc" }}>
                      {p.precip}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── AQICard ──────────────────────────────────────────────────────────────────
function AQICard({ aqi }: { aqi: number }) {
  const color =
    aqi <= 50 ? "#22c55e" : aqi <= 100 ? "#eab308" : aqi <= 150 ? "#f97316" : "#ef4444";
  const label =
    aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy for Sensitive" : "Unhealthy";
  const emoji = aqi <= 50 ? "😊" : aqi <= 100 ? "😐" : aqi <= 150 ? "😷" : "🤢";

  return (
    <motion.div {...motionFadeUp(0.25)} className="mt-3">
      <GlassCard
        className="overflow-hidden"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="p-4">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40 mb-3">
            Air Quality Index
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-semibold text-white/90">{aqi}</p>
              <p className="text-sm font-medium mt-0.5" style={{ color }}>
                {label}
              </p>
            </div>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{
                background: `${color}18`,
                border: `1.5px solid ${color}55`,
              }}
            >
              {emoji}
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (aqi / 200) * 100)}%`, background: color }}
            />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── ForecastCard ─────────────────────────────────────────────────────────────
function ForecastCard({ model, units }: { model: WeatherModel; units: Units }) {
  const tempRange = model.overallMax - model.overallMin || 1;

  return (
    <motion.div {...motionFadeUp(0.3)} className="mt-3">
      <GlassCard className="overflow-hidden">
        <p
          className="px-4 pt-3 pb-2 text-[10px] font-semibold tracking-widest uppercase text-white/40"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          {model.daily.length}-Day Forecast
        </p>
        <div>
          {model.daily.map((day: DayPoint, i: number) => {
            const barLeft = ((day.minTemp - model.overallMin) / tempRange) * 100;
            const barWidth = ((day.maxTemp - day.minTemp) / tempRange) * 100;
            return (
              <div
                key={i}
                className="flex items-center px-4 py-3 gap-3"
                style={{
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <span className="text-sm font-medium text-white/90 w-12 shrink-0">
                  {day.label}
                </span>
                <span className="text-xl w-7 text-center shrink-0">{day.emoji}</span>
                <span
                  className="text-[10px] w-8 text-right shrink-0"
                  style={{
                    color: day.maxPrecip >= 20 ? "#7dd3fc" : "transparent",
                  }}
                >
                  {day.maxPrecip}%
                </span>
                <span className="text-sm w-8 text-right shrink-0 text-white/40">
                  {fmtTemp(day.minTemp, units.temp)}
                </span>
                <div className="flex-1 h-1 rounded-full bg-white/10 relative">
                  <div
                    className="absolute h-full rounded-full"
                    style={{
                      left: `${barLeft.toFixed(1)}%`,
                      width: `${Math.max(barWidth, 8).toFixed(1)}%`,
                      background: "linear-gradient(to right, #7dd3fc, #f59e0b)",
                    }}
                  />
                </div>
                <span className="text-sm font-semibold w-8 text-left shrink-0 text-white/90">
                  {fmtTemp(day.maxTemp, units.temp)}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── SavedLocationsRow ─────────────────────────────────────────────────────────
function SavedLocationsRow({
  savedLocations,
  savedTemps,
  units,
  activeId,
  onSelect,
  onOpenSearch,
}: {
  savedLocations: SavedLocation[];
  savedTemps: Record<string, number>;
  units: Units;
  activeId: string;
  onSelect: (id: string) => void;
  onOpenSearch: () => void;
}) {
  return (
    <motion.div {...motionFadeUp(0.35)} className="mt-3">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40 mb-2 text-center">
        Saved Locations
      </p>
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 justify-center">
        {savedLocations.map((loc) => {
          const isActive = loc.id === activeId;
          return (
            <button
              key={loc.id}
              onClick={() => onSelect(loc.id)}
              className="flex-shrink-0 px-3 py-2 rounded-full flex items-center gap-1.5 transition-all"
              style={{
                background: isActive
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.07)",
                border: `1px solid ${isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.13)"}`,
                color: "rgba(255,255,255,0.9)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.transform = "scale(1.03)";
                el.style.borderColor = "rgba(255,255,255,0.35)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transform = "scale(1)";
                el.style.borderColor = isActive
                  ? "rgba(255,255,255,0.35)"
                  : "rgba(255,255,255,0.13)";
              }}
            >
              <span className="text-sm font-medium">{loc.name}</span>
              {savedTemps[loc.id] !== undefined && (
                <span className="text-xs text-white/50">
                  {fmtTemp(savedTemps[loc.id], units.temp)}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={onOpenSearch}
          className="flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.45)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
        >
          + Add
        </button>
      </div>
    </motion.div>
  );
}

// ── SkeletonLoader ────────────────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-3">
      <div className="glass-card skeleton h-52" />
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card skeleton h-28" />
        <div className="glass-card skeleton h-28" />
        <div className="glass-card skeleton h-28" />
        <div className="glass-card skeleton h-28" />
      </div>
      <div className="glass-card skeleton h-36" />
      <div className="glass-card skeleton h-44" />
    </div>
  );
}
