"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { METRIC_UNITS, type Units } from "@/lib/units";
import type { Theme } from "@/lib/weather-utils";

export type ThemePref = "system" | "light" | "dark";

export type Settings = {
  theme: ThemePref;
  units: Units;
};

export type SavedLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1: string;
};

export type ActiveLocation = {
  id: string;
  name: string;
  sublabel: string;
  latitude: number;
  longitude: number;
  isCurrent: boolean;
};

export type GeoStatus =
  | "idle"
  | "loading"
  | "granted"
  | "denied"
  | "unavailable";

const DEFAULT_SETTINGS: Settings = { theme: "system", units: METRIC_UNITS };

const KEY = {
  settings: "weatherrweb:settings",
  locations: "weatherrweb:locations",
  active: "weatherrweb:active",
  geo: "weatherrweb:geo",
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadArray<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

type AppContextValue = {
  ready: boolean;
  settings: Settings;
  resolvedTheme: Theme;
  setTheme: (t: ThemePref) => void;
  setUnits: (u: Partial<Units>) => void;
  savedLocations: SavedLocation[];
  addLocation: (loc: SavedLocation) => void;
  removeLocation: (id: string) => void;
  isSaved: (id: string) => boolean;
  activeId: string;
  setActive: (id: string) => void;
  activeLocation: ActiveLocation | null;
  currentGeo: { latitude: number; longitude: number } | null;
  geoStatus: GeoStatus;
  requestCurrentLocation: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [activeId, setActiveId] = useState<string>("current");
  const [currentGeo, setCurrentGeo] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const systemDark = useSystemDark();

  // Hydrate from localStorage after mount. State must start from SSR-safe
  // defaults and be populated client-side here to avoid hydration mismatch —
  // the cascading-render lint rule cannot model this necessary pattern.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSettings(load<Settings>(KEY.settings, DEFAULT_SETTINGS));
    setSavedLocations(loadArray<SavedLocation>(KEY.locations, []));
    const savedActive = window.localStorage.getItem(KEY.active);
    if (savedActive) setActiveId(savedActive);
    const geo = load<{ latitude: number; longitude: number } | null>(
      KEY.geo,
      null as never
    );
    if (geo && typeof geo.latitude === "number") {
      setCurrentGeo(geo);
      setGeoStatus("granted");
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const resolvedTheme: Theme =
    settings.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : settings.theme;

  // Reflect resolved theme on <html> for global styling hooks
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, ready]);

  // Persist
  useEffect(() => {
    if (ready) window.localStorage.setItem(KEY.settings, JSON.stringify(settings));
  }, [settings, ready]);
  useEffect(() => {
    if (ready)
      window.localStorage.setItem(KEY.locations, JSON.stringify(savedLocations));
  }, [savedLocations, ready]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(KEY.active, activeId);
  }, [activeId, ready]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(KEY.geo, JSON.stringify(currentGeo));
  }, [currentGeo, ready]);

  const setTheme = useCallback(
    (theme: ThemePref) => setSettings((s) => ({ ...s, theme })),
    []
  );
  const setUnits = useCallback(
    (u: Partial<Units>) =>
      setSettings((s) => ({ ...s, units: { ...s.units, ...u } })),
    []
  );

  const addLocation = useCallback((loc: SavedLocation) => {
    setSavedLocations((prev) =>
      prev.some((l) => l.id === loc.id) ? prev : [...prev, loc]
    );
  }, []);

  const removeLocation = useCallback(
    (id: string) => {
      setSavedLocations((prev) => {
        const next = prev.filter((l) => l.id !== id);
        setActiveId((curr) =>
          curr === id ? next[0]?.id ?? "current" : curr
        );
        return next;
      });
    },
    []
  );

  const isSaved = useCallback(
    (id: string) => savedLocations.some((l) => l.id === id),
    [savedLocations]
  );

  const requestCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentGeo({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGeoStatus("granted");
        setActiveId("current");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }, []);

  // On first load, default the active location to the user's current position.
  // If permission is denied the app falls back to the world-map view (no
  // active location), which the UI renders without a weather panel.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!ready) return;
    if (activeId === "current" && !currentGeo && geoStatus === "idle") {
      requestCurrentLocation();
    }
    // Only auto-trigger once, right after hydration.
  }, [ready]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const activeLocation: ActiveLocation | null = useMemo(() => {
    if (activeId === "current") {
      if (!currentGeo) return null;
      return {
        id: "current",
        name: "My Location",
        sublabel: `${currentGeo.latitude.toFixed(2)}°, ${currentGeo.longitude.toFixed(2)}°`,
        latitude: currentGeo.latitude,
        longitude: currentGeo.longitude,
        isCurrent: true,
      };
    }
    const loc = savedLocations.find((l) => l.id === activeId) ?? savedLocations[0];
    if (!loc) return null;
    return {
      id: loc.id,
      name: loc.name,
      sublabel: [loc.admin1, loc.country].filter(Boolean).join(", "),
      latitude: loc.latitude,
      longitude: loc.longitude,
      isCurrent: false,
    };
  }, [activeId, currentGeo, savedLocations]);

  const value: AppContextValue = {
    ready,
    settings,
    resolvedTheme,
    setTheme,
    setUnits,
    savedLocations,
    addLocation,
    removeLocation,
    isSaved,
    activeId,
    setActive: setActiveId,
    activeLocation,
    currentGeo,
    geoStatus,
    requestCurrentLocation,
  };

  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

function useSystemDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => true
  );
}
