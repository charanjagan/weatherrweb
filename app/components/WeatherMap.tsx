"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L, {
  type Map as LeafletMap,
  type GeoJSON as LeafletGeoJSON,
  type TileLayer,
  type Marker,
  type LayerGroup,
  type LatLngBounds,
} from "leaflet";
import type { Theme } from "@/lib/weather-utils";

const OWM_KEY = process.env.NEXT_PUBLIC_WEATHER_API_KEY;

interface Crumb {
  name: string;
  level: "world" | "country" | "city";
}

export type MapSelection = { name: string; lat: number; lon: number };
export type MapFocus = { lat: number; lon: number; zoom?: number } | null;

const WORLD_GEOJSON =
  "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

// Natural Earth populated places — capitals + major cities worldwide.
const CITIES_GEOJSON =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson";

const MAX_CITY_MARKERS = 60;

const WEATHER_LAYERS = [
  { id: "none", label: "None" },
  { id: "precipitation_new", label: "Rain" },
  { id: "clouds_new", label: "Clouds" },
  { id: "temp_new", label: "Temp" },
  { id: "wind_new", label: "Wind" },
];

const BASE_TILES: Record<Theme, { url: string; attribution: string }> = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap · © CARTO",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap · © CARTO",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CityFeature = any;

function pinIcon(theme: Theme) {
  const color = theme === "dark" ? "#7dd3fc" : "#0a84ff";
  return L.divIcon({
    className: "",
    html: `<div style="transform:translate(-50%,-100%);font-size:30px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));color:${color}">📍</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function WeatherMap({
  theme,
  onSelectLocation,
  focus,
}: {
  theme: Theme;
  onSelectLocation: (sel: MapSelection) => void;
  focus: MapFocus;
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const geoLayerRef = useRef<LeafletGeoJSON | null>(null);
  const weatherLayerRef = useRef<TileLayer | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const cityLayerRef = useRef<LayerGroup | null>(null);
  const citiesDataRef = useRef<CityFeature[]>([]);
  const themeRef = useRef<Theme>(theme);
  const countryRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelectLocation);
  useEffect(() => {
    onSelectRef.current = onSelectLocation;
  }, [onSelectLocation]);

  const [activeWeatherLayer, setActiveWeatherLayer] = useState(
    OWM_KEY ? "precipitation_new" : "none"
  );
  const [drillStack, setDrillStack] = useState<Crumb[]>([
    { name: "World", level: "world" },
  ]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const placeMarker = useCallback((lat: number, lon: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([lat, lon], {
      icon: pinIcon(themeRef.current),
      interactive: false,
    }).addTo(map);
  }, []);

  const applyWeatherLayer = useCallback((map: LeafletMap, layerId: string) => {
    if (weatherLayerRef.current) {
      map.removeLayer(weatherLayerRef.current);
      weatherLayerRef.current = null;
    }
    if (layerId === "none" || !OWM_KEY) return;
    const wLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/${layerId}/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
      { opacity: 0.6, maxZoom: 19, attribution: "© OpenWeatherMap" }
    );
    wLayer.addTo(map);
    weatherLayerRef.current = wLayer;
  }, []);

  const styleFeature = () => ({
    fillColor: themeRef.current === "dark" ? "#7dd3fc" : "#378ADD",
    fillOpacity: 0.1,
    color: themeRef.current === "dark" ? "#7dd3fc" : "#185FA5",
    weight: 1,
    opacity: 0.6,
  });

  // Render the largest cities within the given bounds as clickable markers.
  const renderCities = useCallback(
    (bounds: LatLngBounds) => {
      const map = mapRef.current;
      if (!map) return;
      cityLayerRef.current?.clearLayers();
      if (!cityLayerRef.current) {
        cityLayerRef.current = L.layerGroup().addTo(map);
      }

      const dark = themeRef.current === "dark";
      const inView = citiesDataRef.current
        .filter((f) => {
          const [lon, lat] = f.geometry.coordinates;
          return bounds.contains([lat, lon]);
        })
        .sort((a, b) => (b.properties.pop_max ?? 0) - (a.properties.pop_max ?? 0))
        .slice(0, MAX_CITY_MARKERS);

      const fill = dark ? "#fbbf24" : "#ef4444";
      const stroke = dark ? "#0a0a0a" : "#ffffff";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:11px;height:11px;border-radius:50%;background:${fill};border:1.5px solid ${stroke};box-shadow:0 0 0 1px rgba(0,0,0,0.2)"></div>`,
        iconSize: [11, 11],
        iconAnchor: [6, 6],
      });

      for (const f of inView) {
        const [lon, lat] = f.geometry.coordinates;
        const name: string = f.properties.name ?? "City";
        const marker = L.marker([lat, lon], { icon });
        marker.bindTooltip(name, { direction: "top", offset: [0, -6] });
        marker.on("click", () => {
          map.flyTo([lat, lon], Math.max(map.getZoom(), 9), { duration: 0.6 });
          placeMarker(lat, lon);
          onSelectRef.current({ name, lat, lon });
          if (countryRef.current) {
            setDrillStack([
              { name: "World", level: "world" },
              { name: countryRef.current, level: "country" },
              { name, level: "city" },
            ]);
          }
        });
        marker.addTo(cityLayerRef.current);
      }
    },
    [placeMarker]
  );

  const loadWorld = useCallback(
    async (map: LeafletMap) => {
      setLoading(true);
      try {
        const res = await fetch(WORLD_GEOJSON);
        const data = await res.json();
        if (geoLayerRef.current) map.removeLayer(geoLayerRef.current);

        const layer = L.geoJSON(data, {
          style: styleFeature,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onEachFeature: (feature: any, featureLayer: any) => {
            const name =
              feature.properties?.name ||
              feature.properties?.ADMIN ||
              feature.properties?.NAME ||
              "Country";

            featureLayer.on({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              mouseover: (e: any) => {
                e.target.setStyle({ fillOpacity: 0.3, weight: 2 });
                setTooltip(name);
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              mouseout: (e: any) => {
                layer.resetStyle(e.target);
                setTooltip(null);
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              click: (e: any) => {
                const bounds = e.target.getBounds();
                const center = bounds.getCenter();
                map.fitBounds(bounds, { padding: [40, 40] });
                placeMarker(center.lat, center.lng);
                onSelectRef.current({
                  name,
                  lat: center.lat,
                  lon: center.lng,
                });
                countryRef.current = name;
                // Reset to a fixed depth so repeated clicks never stack.
                setDrillStack([
                  { name: "World", level: "world" },
                  { name, level: "country" },
                ]);
                renderCities(bounds);
              },
            });
          },
        });

        layer.addTo(map);
        geoLayerRef.current = layer;
      } catch (err) {
        console.error("World GeoJSON load error:", err);
      } finally {
        setLoading(false);
      }
    },
    [placeMarker, renderCities]
  );

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxBounds: [
        [-90, -180],
        [90, 180],
      ],
      maxBoundsViscosity: 1.0,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomleft" }).addTo(map);

    const base = BASE_TILES[themeRef.current];
    baseLayerRef.current = L.tileLayer(base.url, {
      attribution: base.attribution,
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    cityLayerRef.current = L.layerGroup().addTo(map);
    applyWeatherLayer(map, activeWeatherLayer);

    // Cities dataset (best-effort; map still works without it).
    fetch(CITIES_GEOJSON)
      .then((r) => r.json())
      .then((d) => {
        citiesDataRef.current = Array.isArray(d?.features) ? d.features : [];
      })
      .catch(() => {});

    loadWorld(map);

    // Refresh city markers for the visible area while inside a country.
    map.on("moveend", () => {
      if (countryRef.current) renderCities(map.getBounds());
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap base tiles + feature styling + marker color on theme change.
  useEffect(() => {
    themeRef.current = theme;
    const map = mapRef.current;
    if (!map) return;
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    const base = BASE_TILES[theme];
    baseLayerRef.current = L.tileLayer(base.url, {
      attribution: base.attribution,
      maxZoom: 19,
    });
    baseLayerRef.current.addTo(map);
    baseLayerRef.current.bringToBack();
    geoLayerRef.current?.setStyle(styleFeature);
    if (countryRef.current) renderCities(map.getBounds());
    if (markerRef.current) {
      const ll = markerRef.current.getLatLng();
      placeMarker(ll.lat, ll.lng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Re-apply weather overlay when switched.
  useEffect(() => {
    if (mapRef.current) applyWeatherLayer(mapRef.current, activeWeatherLayer);
  }, [activeWeatherLayer, applyWeatherLayer]);

  // Fly to externally-selected location (search / current / saved).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.lat, focus.lon], focus.zoom ?? 9, { duration: 0.8 });
    placeMarker(focus.lat, focus.lon);
  }, [focus, placeMarker]);

  const handleBack = () => {
    const map = mapRef.current;
    if (!map) return;
    countryRef.current = null;
    cityLayerRef.current?.clearLayers();
    setDrillStack([{ name: "World", level: "world" }]);
    map.setView([20, 0], 2);
  };

  return (
    <div className="relative w-full h-full">
      {/* Breadcrumb + back */}
      <div className="absolute top-[68px] left-3 z-[1000] flex flex-col gap-2 max-w-[60vw]">
        <div className="flex items-center gap-1 flex-wrap bg-white/85 dark:bg-neutral-900/85 backdrop-blur rounded-xl px-3 py-2 text-sm shadow-sm border border-black/5 dark:border-white/10">
          {drillStack.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-neutral-400">›</span>}
              <span
                className={
                  i === drillStack.length - 1
                    ? "font-medium text-sky-600 dark:text-sky-400"
                    : "text-neutral-500 dark:text-neutral-400"
                }
              >
                {item.name}
              </span>
            </span>
          ))}
        </div>

        {drillStack.length > 1 && (
          <button
            onClick={handleBack}
            className="self-start bg-white/85 dark:bg-neutral-900/85 backdrop-blur rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 shadow-sm border border-black/5 dark:border-white/10 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
          >
            ← Back to World
          </button>
        )}
      </div>

      {/* Weather layer switcher */}
      <div className="absolute top-[68px] right-3 z-[1000] flex rounded-xl overflow-hidden shadow-sm border border-black/5 dark:border-white/10 bg-white/85 dark:bg-neutral-900/85 backdrop-blur">
        {WEATHER_LAYERS.map((layer) => (
          <button
            key={layer.id}
            onClick={() => setActiveWeatherLayer(layer.id)}
            disabled={layer.id !== "none" && !OWM_KEY}
            className={`px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              activeWeatherLayer === layer.id
                ? "bg-sky-500 text-white"
                : "text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Hint */}
      {drillStack.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-neutral-900/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none shadow whitespace-nowrap">
          Tap a city marker for its forecast
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] bg-neutral-900/90 text-white text-sm px-3 py-1.5 rounded-lg pointer-events-none shadow whitespace-nowrap">
          {tooltip}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 dark:bg-neutral-900/90 rounded-lg px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300 shadow">
            Loading…
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
