export type GeoLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  admin1: string;
};

type OpenMeteoGeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};

export function normalizeGeoResult(r: OpenMeteoGeoResult): GeoLocation {
  return {
    id: String(r.id),
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country ?? "",
    countryCode: r.country_code ?? "",
    admin1: r.admin1 ?? "",
  };
}

/** Client helper — hits our own proxy route to avoid CORS/key concerns. */
export async function searchLocations(query: string): Promise<GeoLocation[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { results: GeoLocation[] };
  return json.results ?? [];
}

export function locationLabel(loc: { admin1?: string; country?: string }): string {
  return [loc.admin1, loc.country].filter(Boolean).join(", ");
}
