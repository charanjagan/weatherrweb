"use client";

import Modal from "@/app/components/Modal";
import { useApp, type ThemePref } from "@/app/components/store";
import { chrome } from "@/lib/weather-utils";

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings, setTheme, setUnits, resolvedTheme } = useApp();
  const c = chrome(resolvedTheme);

  return (
    <Modal open={open} onClose={onClose} title="Settings" theme={resolvedTheme}>
      <Section label="Appearance" theme={resolvedTheme}>
        <Segmented
          theme={resolvedTheme}
          value={settings.theme}
          onChange={(v) => setTheme(v as ThemePref)}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Section>

      <Section label="Temperature" theme={resolvedTheme}>
        <Segmented
          theme={resolvedTheme}
          value={settings.units.temp}
          onChange={(v) => setUnits({ temp: v as never })}
          options={[
            { value: "c", label: "°C" },
            { value: "f", label: "°F" },
          ]}
        />
      </Section>

      <Section label="Wind Speed" theme={resolvedTheme}>
        <Segmented
          theme={resolvedTheme}
          value={settings.units.wind}
          onChange={(v) => setUnits({ wind: v as never })}
          options={[
            { value: "kmh", label: "km/h" },
            { value: "mph", label: "mph" },
            { value: "ms", label: "m/s" },
            { value: "kn", label: "kn" },
          ]}
        />
      </Section>

      <Section label="Pressure" theme={resolvedTheme}>
        <Segmented
          theme={resolvedTheme}
          value={settings.units.pressure}
          onChange={(v) => setUnits({ pressure: v as never })}
          options={[
            { value: "hpa", label: "hPa" },
            { value: "inhg", label: "inHg" },
            { value: "mmhg", label: "mmHg" },
          ]}
        />
      </Section>

      <Section label="Precipitation" theme={resolvedTheme}>
        <Segmented
          theme={resolvedTheme}
          value={settings.units.precip}
          onChange={(v) => setUnits({ precip: v as never })}
          options={[
            { value: "mm", label: "mm" },
            { value: "in", label: "inch" },
          ]}
        />
      </Section>

      <Section label="Distance / Visibility" theme={resolvedTheme}>
        <Segmented
          theme={resolvedTheme}
          value={settings.units.distance}
          onChange={(v) => setUnits({ distance: v as never })}
          options={[
            { value: "km", label: "km" },
            { value: "mi", label: "mi" },
          ]}
        />
      </Section>

      <p className="text-[12px] mt-2" style={{ color: c.faint }}>
        Weather data from Open-Meteo. Warnings are derived from forecast data.
      </p>
    </Modal>
  );
}

function Section({
  label,
  theme,
  children,
}: {
  label: string;
  theme: "light" | "dark";
  children: React.ReactNode;
}) {
  const c = chrome(theme);
  return (
    <div className="mb-4">
      <p
        className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-2"
        style={{ color: c.sub }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
  theme,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  theme: "light" | "dark";
}) {
  const c = chrome(theme);
  return (
    <div
      className="flex gap-1 p-1 rounded-xl"
      style={{ background: c.track }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex-1 py-2 px-2 rounded-lg text-[14px] font-medium transition-all"
            style={{
              background: active
                ? theme === "dark"
                  ? "rgba(255,255,255,0.9)"
                  : "#ffffff"
                : "transparent",
              color: active ? "#0f2740" : c.text,
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
