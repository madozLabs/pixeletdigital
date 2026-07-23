"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const WORLDS = [
  { label: "Pixel&Digital", href: "/", disabled: false },
  { label: "Kwaliti Print", href: "/kwaliti-print", disabled: false },
  { label: "Studio", href: null, disabled: true },
  { label: "Formation", href: null, disabled: true },
] as const;

export function WorldSwitcher() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="site-header__nav-wrapper" ref={rootRef}>
      <button
        type="button"
        className="world-switcher__trigger"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Nos univers <span className="world-switcher__caret">▾</span>
      </button>
      {open ? (
        <div id={menuId} role="menu" className="world-switcher__menu">
          {WORLDS.map((world) =>
            world.disabled ? (
              <span
                key={world.label}
                className="world-switcher__item world-switcher__item--disabled"
              >
                {world.label}
                <span className="world-switcher__tag">Bientôt</span>
              </span>
            ) : (
              <Link
                key={world.label}
                href={world.href}
                role="menuitem"
                className="world-switcher__item"
                onClick={() => setOpen(false)}
              >
                {world.label}
              </Link>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
