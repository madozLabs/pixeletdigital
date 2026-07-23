"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "workspace-theme";

type Theme = "light" | "dark";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  // Lazy initializer: reads localStorage once on the client's actual first
  // render. The server always renders "light" (no window there), so this
  // one label can legitimately differ between SSR and hydration --
  // suppressHydrationWarning below is scoped to exactly that, not a
  // blanket escape hatch.
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle}>
      <span suppressHydrationWarning>
        {theme === "light" ? "🌙 Mode sombre" : "☀️ Mode clair"}
      </span>
    </button>
  );
}
