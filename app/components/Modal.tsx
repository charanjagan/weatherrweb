"use client";

import { useEffect } from "react";
import { chrome, type Theme } from "@/lib/weather-utils";

export default function Modal({
  open,
  onClose,
  title,
  theme,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  theme: Theme;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const c = chrome(theme);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center"
      style={{ background: c.overlay }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-[440px] max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        style={{
          background:
            theme === "dark" ? "rgba(28,34,48,0.92)" : "rgba(248,250,253,0.96)",
          backdropFilter: "blur(30px)",
          color: c.text,
          border: `1px solid ${c.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 flex items-center justify-between px-5 py-4"
          style={{
            background:
              theme === "dark" ? "rgba(28,34,48,0.92)" : "rgba(248,250,253,0.96)",
            backdropFilter: "blur(30px)",
            borderBottom: `1px solid ${c.border}`,
          }}
        >
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-xl leading-none"
            style={{ background: c.card }}
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
