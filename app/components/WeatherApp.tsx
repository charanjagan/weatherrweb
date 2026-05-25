"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/app/components/store";
import Header from "@/app/components/Header";
import WeatherView from "@/app/components/WeatherView";
import WarningsBanner from "@/app/components/WarningsBanner";
import SettingsModal from "@/app/components/SettingsModal";
import LocationModal from "@/app/components/LocationModal";
import { computeModel } from "@/lib/process-weather";
import { deriveWarnings } from "@/lib/warnings";
import { wmoToGradient, chrome } from "@/lib/weather-utils";
import type { RawWeather } from "@/lib/weather";

export default function WeatherApp() {
  const {
    ready,
    resolvedTheme,
    settings,
    activeLocation,
    activeId,
    setActive,
    savedLocations,
    currentGeo,
    requestCurrentLocation,
  } = useApp();

  const [result, setResult] = useState<{ key: string; data: RawWeather } | null>(
    null
  );
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);

  const lat = activeLocation?.latitude;
  const lon = activeLocation?.longitude;
  const key = lat !== undefined && lon !== undefined ? `${lat},${lon}` : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetch(`/api/weather?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((data: RawWeather) => !cancelled && setResult({ key, data }))
      .catch(() => !cancelled && setErrorKey(key));
    return () => {
      cancelled = true;
    };
  }, [key, lat, lon, reloadTick]);

  const model = useMemo(
    () => (result ? computeModel(result.data) : null),
    [result]
  );
  const warnings = useMemo(
    () => (result ? deriveWarnings(result.data) : []),
    [result]
  );

  const isFresh = result?.key === key;
  const isError = errorKey === key && !isFresh;
  const loading = key !== null && !isFresh && !isError;

  const grad = model
    ? wmoToGradient(model.current.code, model.isDay, resolvedTheme)
    : wmoToGradient(0, true, resolvedTheme);

  const c = chrome(resolvedTheme);

  useEffect(() => {
    document.body.style.background = grad.bottom;
  }, [grad.bottom]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(to bottom, ${grad.top} 0%, ${grad.bottom} 100%)`,
        fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif",
        color: c.text,
      }}
    >
      <Header
        theme={resolvedTheme}
        onOpenLocations={() => setLocationsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Location tabs */}
      <div className="mx-auto max-w-[420px] lg:max-w-[1400px] xl:max-w-[1600px] px-3 lg:px-6 pt-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <Pill
            theme={resolvedTheme}
            active={activeId === "current"}
            onClick={() => {
              if (currentGeo) setActive("current");
              else requestCurrentLocation();
            }}
          >
            📍 {currentGeo ? "My Location" : "Current"}
          </Pill>
          {savedLocations.map((loc) => (
            <Pill
              key={loc.id}
              theme={resolvedTheme}
              active={activeId === loc.id}
              onClick={() => setActive(loc.id)}
            >
              {loc.name}
            </Pill>
          ))}
          <Pill theme={resolvedTheme} active={false} onClick={() => setLocationsOpen(true)}>
            +
          </Pill>
        </div>
      </div>

      {warnings.length > 0 && (
        <WarningsBanner warnings={warnings} theme={resolvedTheme} />
      )}

      {/* Body */}
      <div className="px-3 lg:px-6 pb-10 pt-3">
        {!ready ? (
          <Centered>
            <Spinner color={c.text} />
            <p className="mt-3 text-[15px]" style={{ color: c.sub }}>
              Loading weather…
            </p>
          </Centered>
        ) : !activeLocation ? (
          <Centered>
            <p className="text-[15px]" style={{ color: c.sub }}>
              No location selected.
            </p>
            <button
              onClick={() => setLocationsOpen(true)}
              className="mt-3 px-4 py-2 rounded-full text-[15px] font-medium"
              style={{ background: c.cardStrong, color: c.text }}
            >
              Add a location
            </button>
          </Centered>
        ) : isError ? (
          <Centered>
            <p className="text-[15px]" style={{ color: c.sub }}>
              Couldn&apos;t load weather for this location.
            </p>
            <button
              onClick={() => {
                setErrorKey(null);
                setReloadTick((t) => t + 1);
              }}
              className="mt-3 px-4 py-2 rounded-full text-[15px] font-medium"
              style={{ background: c.cardStrong, color: c.text }}
            >
              Retry
            </button>
          </Centered>
        ) : model ? (
          <div
            style={{
              opacity: loading ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}
          >
            <WeatherView
              model={model}
              units={settings.units}
              theme={resolvedTheme}
              locationName={activeLocation.name}
              sublabel={activeLocation.sublabel}
            />
          </div>
        ) : (
          <Centered>
            <Spinner color={c.text} />
            <p className="mt-3 text-[15px]" style={{ color: c.sub }}>
              Loading weather…
            </p>
          </Centered>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LocationModal open={locationsOpen} onClose={() => setLocationsOpen(false)} />
    </div>
  );
}

function Pill({
  active,
  onClick,
  theme,
  children,
}: {
  active: boolean;
  onClick: () => void;
  theme: "light" | "dark";
  children: React.ReactNode;
}) {
  const c = chrome(theme);
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-4 py-[7px] rounded-full text-[14px] font-medium whitespace-nowrap transition-colors"
      style={{
        background: active ? c.cardStrong : c.card,
        color: c.text,
        border: `1px solid ${active ? c.accent : c.border}`,
      }}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[420px] flex flex-col items-center justify-center text-center py-24">
      {children}
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full animate-spin"
      style={{
        border: `3px solid ${color}`,
        borderTopColor: "transparent",
      }}
    />
  );
}
