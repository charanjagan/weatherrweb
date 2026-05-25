import type { WeatherModel } from "@/lib/process-weather";
import { wmoToCondition, compassDir, chrome, type Theme } from "@/lib/weather-utils";
import {
  fmtTemp,
  fmtWind,
  fmtPressure,
  fmtDistance,
  toWind,
  windLabel,
  type Units,
} from "@/lib/units";

export default function WeatherView({
  model,
  units,
  theme,
  locationName,
  sublabel,
}: {
  model: WeatherModel;
  units: Units;
  theme: Theme;
  locationName: string;
  sublabel: string;
}) {
  const c = chrome(theme);
  const { current } = model;
  const range = model.overallMax - model.overallMin || 1;
  const uv = Math.round(current.uvIndex);

  const uvDesc =
    uv >= 8 ? "Very High" : uv >= 6 ? "High" : uv >= 3 ? "Moderate" : "Low";

  const feelsDesc =
    current.feels < current.temp - 2
      ? "Feels colder than the actual temperature."
      : current.feels > current.temp + 2
        ? "Feels warmer than the actual temperature."
        : "Similar to the actual temperature.";

  return (
    <div
      className="mx-auto w-full max-w-[420px] lg:max-w-[1400px] xl:max-w-[1600px]"
      style={{ color: c.text }}
    >
      {/* Hero */}
      <div className="pt-6 pb-4 lg:pt-10 lg:pb-6 px-5 text-center">
        <h1 className="text-3xl font-medium tracking-tight">{locationName}</h1>
        <p className="text-sm tracking-wide" style={{ color: c.sub }}>
          {sublabel}
        </p>
        <div className="text-[92px] font-thin leading-none mt-1 mb-1">
          {fmtTemp(current.temp, units.temp)}
        </div>
        <p className="text-xl font-normal">{wmoToCondition(current.code)}</p>
        <p className="text-base mt-1" style={{ color: c.sub }}>
          H:{fmtTemp(model.todayHigh, units.temp)}&nbsp;&nbsp;L:
          {fmtTemp(model.todayLow, units.temp)}
        </p>
      </div>

      {/* Hourly */}
      <Card theme={theme} className="mb-3 overflow-hidden">
        <CardLabel theme={theme}>
          {current.precipProb >= 20
            ? `${current.precipProb}% chance of rain · Hourly forecast`
            : "Hourly forecast"}
        </CardLabel>
        <div className="flex overflow-x-auto scrollbar-none px-1 py-2">
          {model.hourly.map((item) => (
            <div
              key={item.t}
              className="flex flex-col items-center gap-[3px] min-w-[58px] px-1 py-2"
              style={
                item.label === "Now"
                  ? { background: c.cardStrong, borderRadius: "12px" }
                  : undefined
              }
            >
              <span className="text-[13px] font-semibold">{item.label}</span>
              <span
                className="text-[10px] font-medium"
                style={{ color: item.precip >= 20 ? c.accent : "transparent" }}
              >
                {item.precip}%
              </span>
              <span className="text-[22px] leading-none">{item.emoji}</span>
              <span className="text-[15px] font-semibold">
                {fmtTemp(item.temp, units.temp)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Daily + details (side-by-side on desktop) */}
      <div className="lg:flex lg:gap-3 lg:items-start">
      <Card
        theme={theme}
        className="mb-3 lg:mb-0 overflow-hidden lg:w-[400px] lg:shrink-0"
      >
        <CardLabel theme={theme}>{model.daily.length}-Day Forecast</CardLabel>
        <div>
          {model.daily.map((day, i) => {
            const barLeft = ((day.minTemp - model.overallMin) / range) * 100;
            const barWidth = ((day.maxTemp - day.minTemp) / range) * 100;
            return (
              <div
                key={i}
                className="flex items-center px-4 py-[11px] gap-2"
                style={{
                  borderTop: i === 0 ? undefined : `1px solid ${c.border}`,
                }}
              >
                <span className="text-[17px] font-medium w-[54px] shrink-0">
                  {day.label}
                </span>
                <span className="text-xl w-7 text-center shrink-0">
                  {day.emoji}
                </span>
                <span
                  className="text-[12px] font-medium w-7 text-center shrink-0"
                  style={{ color: day.maxPrecip >= 20 ? c.accent : "transparent" }}
                >
                  {day.maxPrecip}%
                </span>
                <span
                  className="text-[15px] w-9 text-right shrink-0"
                  style={{ color: c.sub }}
                >
                  {fmtTemp(day.minTemp, units.temp)}
                </span>
                <div
                  className="flex-1 h-[6px] rounded-full relative mx-1"
                  style={{ background: c.track }}
                >
                  <div
                    className="absolute h-full rounded-full"
                    style={{
                      left: `${barLeft.toFixed(1)}%`,
                      width: `${barWidth.toFixed(1)}%`,
                      background: "linear-gradient(to right, #7ac8f5, #f5a020)",
                    }}
                  />
                </div>
                <span className="text-[15px] font-semibold w-9 text-left shrink-0">
                  {fmtTemp(day.maxTemp, units.temp)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detail grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pb-2 lg:flex-1">
        <StatCard theme={theme} label="Feels Like">
          <BigValue>{fmtTemp(current.feels, units.temp)}</BigValue>
          <Sub theme={theme}>{feelsDesc}</Sub>
        </StatCard>

        <StatCard theme={theme} label="Humidity">
          <BigValue>{Math.round(current.humidity)}%</BigValue>
          <Bar theme={theme} pct={current.humidity} color={c.accent} />
          <Sub theme={theme}>
            Dew point {fmtTemp(current.dewPoint, units.temp)}
          </Sub>
        </StatCard>

        <StatCard theme={theme} label="Wind">
          <p className="text-[32px] font-semibold leading-none">
            {Math.round(toWind(current.wind, units.wind))}
            <span className="text-base font-normal ml-1" style={{ color: c.sub }}>
              {windLabel(units.wind)}
            </span>
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block text-[15px]"
              style={{ transform: `rotate(${current.windDir + 180}deg)` }}
            >
              ↑
            </span>
            <span className="text-[15px]">{compassDir(current.windDir)}</span>
          </div>
          <Sub theme={theme}>Gusts {fmtWind(current.gusts, units.wind)}</Sub>
        </StatCard>

        <StatCard theme={theme} label="UV Index">
          <BigValue>{uv}</BigValue>
          <Bar theme={theme} pct={(uv / 11) * 100} color={uvColor(uv)} />
          <Sub theme={theme}>{uvDesc}</Sub>
        </StatCard>

        <StatCard theme={theme} label="Visibility">
          <BigValue>{fmtDistance(current.visibility, units.distance)}</BigValue>
          <Sub theme={theme}>
            {current.visibility >= 10000
              ? "Perfectly clear."
              : current.visibility >= 5000
                ? "Good visibility."
                : current.visibility >= 1000
                  ? "Reduced visibility."
                  : "Very poor visibility."}
          </Sub>
        </StatCard>

        <StatCard theme={theme} label="Cloud Cover">
          <BigValue>{Math.round(current.cloud)}%</BigValue>
          <Bar theme={theme} pct={current.cloud} color={c.text} />
          <Sub theme={theme}>
            {current.cloud < 25
              ? "Clear skies"
              : current.cloud < 60
                ? "Partly cloudy"
                : "Overcast"}
          </Sub>
        </StatCard>

        <StatCard theme={theme} label="Pressure">
          <BigValue>{fmtPressure(current.pressure, units.pressure)}</BigValue>
          <Sub theme={theme}>
            {current.pressure > 1013
              ? "High pressure · stable"
              : current.pressure < 1000
                ? "Low pressure · unsettled"
                : "Near average"}
          </Sub>
        </StatCard>

        <StatCard theme={theme} label="Precipitation">
          <BigValue>{current.precipProb}%</BigValue>
          <Bar theme={theme} pct={current.precipProb} color={c.accent} />
          <Sub theme={theme}>Chance in the current hour</Sub>
        </StatCard>
      </div>
      </div>
    </div>
  );
}

function uvColor(uv: number): string {
  if (uv >= 8) return "#a855f7";
  if (uv >= 6) return "#ef4444";
  if (uv >= 3) return "#f59e0b";
  return "#22c55e";
}

function Card({
  theme,
  className = "",
  children,
}: {
  theme: Theme;
  className?: string;
  children: React.ReactNode;
}) {
  const c = chrome(theme);
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: c.card, backdropFilter: "blur(20px)" }}
    >
      {children}
    </div>
  );
}

function CardLabel({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  const c = chrome(theme);
  return (
    <p
      className="px-4 pt-3 pb-2 text-[11px] font-semibold tracking-[0.15em] uppercase"
      style={{ color: c.sub, borderBottom: `1px solid ${c.border}` }}
    >
      {children}
    </p>
  );
}

function StatCard({
  theme,
  label,
  children,
}: {
  theme: Theme;
  label: string;
  children: React.ReactNode;
}) {
  const c = chrome(theme);
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: c.card, backdropFilter: "blur(20px)" }}
    >
      <p
        className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-2"
        style={{ color: c.sub }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function BigValue({ children }: { children: React.ReactNode }) {
  return <p className="text-[32px] font-semibold leading-none">{children}</p>;
}

function Sub({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const c = chrome(theme);
  return (
    <p className="text-[13px] mt-2" style={{ color: c.sub }}>
      {children}
    </p>
  );
}

function Bar({
  theme,
  pct,
  color,
}: {
  theme: Theme;
  pct: number;
  color: string;
}) {
  const c = chrome(theme);
  return (
    <div
      className="mt-3 h-[6px] rounded-full w-full"
      style={{ background: c.track }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  );
}
