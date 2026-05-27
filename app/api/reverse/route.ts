export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    // Prefer OWM reverse geocoding when key is available
    const key = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
    if (key) {
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${key}`,
        { next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return Response.json(
            { name: data[0].name as string, country: data[0].country as string },
            { headers: { "Cache-Control": "public, max-age=86400" } }
          );
        }
      }
    }

    // Fallback: Nominatim (free, no key required)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      {
        headers: { "User-Agent": "WeatherrWeb/1.0 (weather app)" },
        next: { revalidate: 86400 },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const name: string =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        data.name ||
        "My Location";
      const country: string = data.address?.country ?? "";
      return Response.json(
        { name, country },
        { headers: { "Cache-Control": "public, max-age=86400" } }
      );
    }
  } catch {
    // fall through to default
  }

  return Response.json({ name: "My Location", country: "" });
}
