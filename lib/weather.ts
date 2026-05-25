import { fetchWeatherApi } from "openmeteo";

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

const HOURLY_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "snow_depth",
  "weather_code",
  "pressure_msl",
  "surface_pressure",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",
  "wind_speed_10m",
  "wind_speed_80m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "uv_index",
] as const;

type HourlyVar = (typeof HOURLY_VARS)[number];

export type RawWeather = {
  latitude: number;
  longitude: number;
  elevation: number;
  utcOffsetSeconds: number;
  hourly: {
    /** epoch seconds, already shifted to the location's local time */
    time: number[];
  } & Record<HourlyVar, number[]>;
};

const toArray = (a: Float32Array | null): number[] => (a ? Array.from(a) : []);

export async function getWeatherData(
  latitude: number,
  longitude: number
): Promise<RawWeather> {
  const responses = await fetchWeatherApi(WEATHER_URL, {
    latitude,
    longitude,
    hourly: [...HOURLY_VARS],
    timezone: "auto",
  });
  const response = responses[0];

  const utcOffsetSeconds = response.utcOffsetSeconds();
  const hourly = response.hourly()!;

  const time = Array.from(
    {
      length:
        (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval(),
    },
    (_, i) =>
      Math.floor(Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds)
  );

  const hourlyData = { time } as RawWeather["hourly"];
  HOURLY_VARS.forEach((name, i) => {
    hourlyData[name] = toArray(hourly.variables(i)!.valuesArray());
  });

  return {
    latitude: response.latitude(),
    longitude: response.longitude(),
    elevation: response.elevation(),
    utcOffsetSeconds,
    hourly: hourlyData,
  };
}
