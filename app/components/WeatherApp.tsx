"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp, type SavedLocation } from "@/app/components/store";
import Header from "@/app/components/Header";
import WeatherView from "@/app/components/WeatherView";
import WarningsBanner from "@/app/components/WarningsBanner";
import SettingsModal from "@/app/components/SettingsModal";
import LocationModal from "@/app/components/LocationModal";
import MapWrapper from "@/app/components/MapWrapper";
import type { MapFocus, MapSelection } from "@/app/components/WeatherMap";
import { computeModel } from "@/lib/process-weather";
import { deriveWarnings } from "@/lib/warnings";
import { wmoToGradient, chrome } from "@/lib/weather-utils";
import type { RawWeather } from "@/lib/weather";

type Target = {
  name: string;
  sublabel: string;
  latitude: number;
  longitude: number;
};

export default function WeatherApp() {
  const {
    ready,
    resolvedTheme,
    settings,
    activeLocation,
    setActive,
    addLocation,
    isSaved,
    currentGeo,
    geoStatus,
    requestCurrentLocation,
  } = useApp();

  const [result, setResult] = useState<{ key: string; data: RawWeather } | null>(
    null
  );
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);

  const [mapSelection, setMapSelection] = useState<Target | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const c = chrome(resolvedTheme);

  // A location chosen from the store (search / saved / current) drives the map
  // and opens the drawer. A point picked directly on the map takes priority and
  // is held separately so it doesn't mutate the user's saved selection.
  const activeId = activeLocation?.id;
  const activeLat = activeLocation?.latitude;
  const activeLon = activeLocation?.longitude;
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (activeLat === undefined || activeLon === undefined) return;
    setMapSelection(null);
    setMapFocus({ lat: activeLat, lon: activeLon, zoom: 9 });
    setDrawerOpen(true);
  }, [activeId, activeLat, activeLon]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const target: Target | null = mapSelection ?? activeLocation ?? null;
  const lat = target?.latitude;
  const lon = target?.longitude;
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

  useEffect(() => {
    document.body.style.background =
      resolvedTheme === "dark" ? "#0a0a0a" : "#eef2f6";
  }, [resolvedTheme]);

  const handleMapSelect = useCallback((sel: MapSelection) => {
    setMapSelection({
      name: sel.name,
      sublabel: `${sel.lat.toFixed(2)}°, ${sel.lon.toFixed(2)}°`,
      latitude: sel.lat,
      longitude: sel.lon,
    });
    setDrawerOpen(true);
  }, []);

  const handleLocate = useCallback(() => {
    if (currentGeo) {
      setActive("current");
      setMapSelection(null);
      setMapFocus({ lat: currentGeo.latitude, lon: currentGeo.longitude, zoom: 10 });
      setDrawerOpen(true);
    } else {
      requestCurrentLocation();
    }
  }, [currentGeo, setActive, requestCurrentLocation]);

  const pointId = mapSelection
    ? `pt-${mapSelection.latitude.toFixed(3)}_${mapSelection.longitude.toFixed(3)}`
    : null;

  const saveCurrentPoint = useCallback(() => {
    if (!mapSelection || !pointId) return;
    const loc: SavedLocation = {
      id: pointId,
      name: mapSelection.name,
      latitude: mapSelection.latitude,
      longitude: mapSelection.longitude,
      country: "",
      admin1: "",
    };
    addLocation(loc);
    setMapSelection(null);
    setActive(loc.id);
  }, [mapSelection, pointId, addLocation, setActive]);

  const showGeoLoading =
    ready && geoStatus === "loading" && !mapSelection && !activeLocation;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ color: c.text }}>
      <Header
        theme={resolvedTheme}
        onOpenLocations={() => setLocationsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onLocate={handleLocate}
      />

      {/* Map fills the screen */}
      <div className="absolute inset-0 pt-14">
        <MapWrapper
          theme={resolvedTheme}
          onSelectLocation={handleMapSelect}
          focus={mapFocus}
        />
      </div>

      {/* Geolocation loading chip */}
      {showGeoLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1100] flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur shadow-lg border border-black/5 dark:border-white/10">
          <Spinner color={resolvedTheme === "dark" ? "#fff" : "#0f2740"} />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Finding your location…
          </span>
        </div>
      )}

      {/* Reopen tab when a target exists but drawer is closed */}
      {target && !drawerOpen && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-4 lg:translate-x-0 z-[1100] px-4 py-2.5 rounded-full text-sm font-medium shadow-lg backdrop-blur border"
          style={{
            background: c.cardStrong,
            color: c.text,
            borderColor: c.border,
          }}
        >
          Show weather · {target.name}
        </button>
      )}

      {/* Weather drawer */}
      <div
        className={`fixed z-[1200] transition-transform duration-300 ease-out
          inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl
          lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[440px] lg:max-h-none lg:rounded-none lg:rounded-l-3xl
          ${
            drawerOpen && target
              ? "translate-y-0 lg:translate-x-0"
              : "translate-y-full lg:translate-y-0 lg:translate-x-full"
          }`}
        style={{
          background: `linear-gradient(to bottom, ${grad.top} 0%, ${grad.bottom} 100%)`,
          boxShadow:
            resolvedTheme === "dark"
              ? "0 -8px 40px rgba(0,0,0,0.5)"
              : "0 -8px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div className="flex flex-col h-full max-h-[88vh] lg:max-h-screen overflow-y-auto scrollbar-none">
          {/* Drawer header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 backdrop-blur-md"
            style={{
              background:
                resolvedTheme === "dark"
                  ? "rgba(0,0,0,0.15)"
                  : "rgba(255,255,255,0.18)",
              borderBottom: `1px solid ${c.border}`,
            }}
          >
            <span className="text-[15px] font-semibold truncate">
              {target?.name ?? "Weather"}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {mapSelection && pointId && !isSaved(pointId) && (
                <button
                  onClick={saveCurrentPoint}
                  className="px-3 py-1.5 rounded-full text-[13px] font-medium"
                  style={{ background: c.cardStrong, color: c.text }}
                >
                  + Save
                </button>
              )}
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center text-xl leading-none"
                style={{ background: c.card, color: c.text }}
              >
                ×
              </button>
            </div>
          </div>

          <div className="px-3 pb-8">
            {warnings.length > 0 && (
              <WarningsBanner warnings={warnings} theme={resolvedTheme} compact />
            )}

            {isError ? (
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
            ) : model && isFresh ? (
              <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <WeatherView
                  model={model}
                  units={settings.units}
                  theme={resolvedTheme}
                  locationName={target?.name ?? ""}
                  sublabel={target?.sublabel ?? ""}
                  compact
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
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LocationModal open={locationsOpen} onClose={() => setLocationsOpen(false)} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      {children}
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full animate-spin"
      style={{ border: `3px solid ${color}`, borderTopColor: "transparent" }}
    />
  );
}
