"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/components/Modal";
import { useApp, type SavedLocation } from "@/app/components/store";
import { searchLocations, type GeoLocation } from "@/lib/geocoding";
import { chrome } from "@/lib/weather-utils";

export default function LocationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    resolvedTheme,
    savedLocations,
    addLocation,
    removeLocation,
    isSaved,
    setActive,
    activeId,
    requestCurrentLocation,
    geoStatus,
    currentGeo,
  } = useApp();
  const c = chrome(resolvedTheme);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const id = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await searchLocations(q);
      if (!cancelled) {
        setResults(res);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const pickResult = (g: GeoLocation) => {
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
    setQuery("");
    setResults([]);
    onClose();
  };

  const useCurrent = () => {
    requestCurrentLocation();
    if (currentGeo) {
      setActive("current");
      onClose();
    }
  };

  const rowStyle = {
    background: c.card,
    border: `1px solid ${c.border}`,
  };

  return (
    <Modal open={open} onClose={onClose} title="Locations" theme={resolvedTheme}>
      {/* Search */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search city or place…"
        autoComplete="off"
        className="w-full px-4 py-3 rounded-xl text-[15px] outline-none mb-3"
        style={{
          background: c.track,
          color: c.text,
          border: `1px solid ${c.border}`,
        }}
      />

      {/* Search results */}
      {query.trim().length >= 2 && (
        <div className="mb-4 flex flex-col gap-2">
          {loading && (
            <p className="text-[13px] px-1" style={{ color: c.sub }}>
              Searching…
            </p>
          )}
          {!loading && results.length === 0 && (
            <p className="text-[13px] px-1" style={{ color: c.sub }}>
              No matches found.
            </p>
          )}
          {results.map((g) => (
            <button
              key={g.id}
              onClick={() => pickResult(g)}
              className="flex items-center justify-between text-left px-4 py-3 rounded-xl"
              style={rowStyle}
            >
              <span>
                <span className="text-[15px] font-medium" style={{ color: c.text }}>
                  {g.name}
                </span>
                <span className="text-[13px] ml-2" style={{ color: c.sub }}>
                  {[g.admin1, g.country].filter(Boolean).join(", ")}
                </span>
              </span>
              <span className="text-[13px] font-medium" style={{ color: c.accent }}>
                {isSaved(g.id) ? "Saved" : "+ Add"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Current location */}
      <button
        onClick={useCurrent}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
        style={rowStyle}
      >
        <span className="text-lg">📍</span>
        <span className="flex-1 text-left">
          <span className="block text-[15px] font-medium" style={{ color: c.text }}>
            {geoStatus === "loading" ? "Locating…" : "Use Current Location"}
          </span>
          {geoStatus === "denied" && (
            <span className="block text-[12px]" style={{ color: "#f97316" }}>
              Permission denied — enable location access.
            </span>
          )}
          {geoStatus === "unavailable" && (
            <span className="block text-[12px]" style={{ color: "#f97316" }}>
              Geolocation not available in this browser.
            </span>
          )}
          {currentGeo && geoStatus === "granted" && (
            <span className="block text-[12px]" style={{ color: c.sub }}>
              {currentGeo.latitude.toFixed(2)}°, {currentGeo.longitude.toFixed(2)}°
            </span>
          )}
        </span>
        {activeId === "current" && (
          <span className="text-[13px]" style={{ color: c.accent }}>
            Active
          </span>
        )}
      </button>

      {/* Saved locations */}
      <p
        className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-2 mt-1"
        style={{ color: c.sub }}
      >
        Saved Places
      </p>
      {savedLocations.length === 0 && (
        <p className="text-[13px] px-1 mb-2" style={{ color: c.sub }}>
          No saved places. Search above to add one.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {savedLocations.map((loc) => {
          const active = loc.id === activeId;
          return (
            <div
              key={loc.id}
              className="flex items-center px-4 py-3 rounded-xl"
              style={{
                ...rowStyle,
                outline: active ? `2px solid ${c.accent}` : "none",
              }}
            >
              <button
                onClick={() => {
                  setActive(loc.id);
                  onClose();
                }}
                className="flex-1 text-left"
              >
                <span className="block text-[15px] font-medium" style={{ color: c.text }}>
                  {loc.name}
                </span>
                <span className="block text-[12px]" style={{ color: c.sub }}>
                  {[loc.admin1, loc.country].filter(Boolean).join(", ")}
                </span>
              </button>
              {active && (
                <span className="text-[13px] mr-3" style={{ color: c.accent }}>
                  Active
                </span>
              )}
              <button
                onClick={() => removeLocation(loc.id)}
                aria-label={`Remove ${loc.name}`}
                className="w-7 h-7 rounded-full flex items-center justify-center text-base leading-none shrink-0"
                style={{ background: c.track, color: c.sub }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
