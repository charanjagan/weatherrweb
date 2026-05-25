import { normalizeGeoResult } from "@/lib/geocoding";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) return Response.json({ results: [] });

  try {
    const url = `${GEO_URL}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const json = await res.json();
    const results = Array.isArray(json.results)
      ? json.results.map(normalizeGeoResult)
      : [];
    return Response.json({ results });
  } catch {
    return Response.json({ results: [] }, { status: 502 });
  }
}
