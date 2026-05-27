"use client";

import { chrome, type Theme } from "@/lib/weather-utils";

const GITHUB_URL = "https://github.com/charanjagan";

export default function Header({ theme }: { theme: Theme }) {
  const c = chrome(theme);
  const btn =
    "flex items-center justify-center w-9 h-9 rounded-full transition-colors";

  return (
    <header
      className="fixed top-0 inset-x-0 z-[1300] h-14 flex items-center justify-between px-4 lg:px-6"
      style={{
        background:
          theme === "dark" ? "rgba(10,10,10,0.6)" : "rgba(255,255,255,0.6)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${c.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">⛅</span>
        <span
          className="text-[17px] font-semibold tracking-tight"
          style={{ color: c.text }}
        >
          Weatherr<span style={{ color: c.accent }}>Web</span>
        </span>
      </div>

      <a
        className={btn}
        style={{ background: c.card, color: c.text }}
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        title="GitHub"
      >
        <GitHubIcon />
      </a>
    </header>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}
