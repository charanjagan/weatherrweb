const AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const url = `${AQI_URL}?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto&forecast_days=1`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    const data = await res.json();

    const times: string[] = data.hourly?.time ?? [];
    const aqis: (number | null)[] = data.hourly?.us_aqi ?? [];

    // Find the index closest to current UTC time
    const nowISO = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
    let idx = times.findIndex((t) => t.replace(" ", "T").slice(0, 13) === nowISO);
    if (idx === -1) idx = 0;

    // Walk forward to find first non-null value near current time
    let aqi = aqis[idx];
    for (let offset = 0; offset < 3 && (aqi === null || aqi === undefined); offset++) {
      aqi = aqis[idx + offset] ?? aqis[Math.max(0, idx - offset)];
    }

    return Response.json(
      { aqi: aqi !== null && aqi !== undefined ? Math.round(Number(aqi)) : null },
      { headers: { "Cache-Control": "public, max-age=1800, s-maxage=1800" } }
    );
  } catch {
    return Response.json({ aqi: null }, { status: 502 });
  }
}
