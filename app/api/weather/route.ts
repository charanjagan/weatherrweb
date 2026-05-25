import { getWeatherData } from "@/lib/weather";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const data = await getWeatherData(lat, lon);
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=600, s-maxage=600" },
    });
  } catch {
    return Response.json({ error: "Failed to fetch weather" }, { status: 502 });
  }
}
