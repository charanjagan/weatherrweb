"use client";

import { useState } from "react";
import type { WeatherWarning } from "@/lib/warnings";
import { severityColor, chrome, type Theme } from "@/lib/weather-utils";

export default function WarningsBanner({
  warnings,
  theme,
  compact = false,
}: {
  warnings: WeatherWarning[];
  theme: Theme;
  compact?: boolean;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = warnings.filter((w) => !dismissed.includes(w.id));
  if (visible.length === 0) return null;
  const c = chrome(theme);

  return (
    <div
      className={
        compact
          ? "px-1 mt-3 flex flex-col gap-2"
          : "mx-auto max-w-[420px] lg:max-w-[1400px] xl:max-w-[1600px] px-4 lg:px-6 mt-3 flex flex-col gap-2 lg:grid lg:grid-cols-2"
      }
    >
      {visible.map((w) => {
        const color = severityColor(w.severity);
        return (
          <div
            key={w.id}
            className="rounded-2xl px-4 py-3 flex items-start gap-3"
            style={{
              background: c.card,
              backdropFilter: "blur(20px)",
              borderLeft: `4px solid ${color}`,
            }}
          >
            <span className="text-xl leading-none mt-[2px]">{w.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold" style={{ color: c.text }}>
                  {w.title}
                </span>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-[2px] rounded-full"
                  style={{ background: color, color: "#fff" }}
                >
                  {w.severity}
                </span>
              </div>
              <p className="text-[13px] mt-[2px]" style={{ color: c.sub }}>
                {w.detail}
              </p>
            </div>
            <button
              onClick={() => setDismissed((d) => [...d, w.id])}
              aria-label="Dismiss warning"
              className="text-lg leading-none px-1 shrink-0"
              style={{ color: c.faint }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
