"use client";

import { useRouter } from "next/navigation";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";

export type CommandPaletteItem = Readonly<{
  id: string;
  label: string;
  href: string;
  group: string;
  icon?: ReactNode;
}>;

export type CommandPaletteHandle = Readonly<{ open: () => void }>;

export const CommandPalette = forwardRef<
  CommandPaletteHandle,
  Readonly<{ items: readonly CommandPaletteItem[] }>
>(function CommandPalette({ items }, ref) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  function normalizeSearchValue(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  const filtered = useMemo(() => {
    const needle = normalizeSearchValue(query.trim());
    if (!needle) return items;
    return items.filter((item) =>
      normalizeSearchValue(item.label).includes(needle),
    );
  }, [items, query]);

  function openPalette() {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }

  useImperativeHandle(ref, () => ({ open: openPalette }), []);

  // Global Cmd/Ctrl+K opens the palette from anywhere in the Workspace.
  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Wait for the dialog to mount before focusing its input.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  }

  function select(item: CommandPaletteItem | undefined) {
    if (!item) return;
    close();
    router.push(item.href);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      select(filtered[activeIndex]);
      return;
    }
    if (event.key === "Tab") {
      // Simple focus trap: the input is the only focusable element besides
      // the list items, which aren't tab targets -- keep focus on it.
      event.preventDefault();
    }
  }

  if (!open) return null;

  let currentGroup = "";

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="command-palette__search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Aller à… ou créer…"
            aria-label="Rechercher une page ou une action"
            aria-controls="command-palette-options"
            aria-activedescendant={
              filtered[activeIndex]
                ? `command-palette-option-${filtered[activeIndex].id}`
                : undefined
            }
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            autoComplete="off"
          />
          <kbd>Échap</kbd>
        </div>
        <ul
          id="command-palette-options"
          className="command-palette__list"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="command-palette__empty">Aucun résultat.</li>
          ) : (
            filtered.map((item, index) => {
              const showGroupLabel = item.group !== currentGroup;
              currentGroup = item.group;
              return (
                <li key={item.id}>
                  {showGroupLabel ? (
                    <p className="command-palette__group-label">{item.group}</p>
                  ) : null}
                  <button
                    id={`command-palette-option-${item.id}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === activeIndex}
                    className={
                      index === activeIndex
                        ? "command-palette__item command-palette__item--active"
                        : "command-palette__item"
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(item)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
});
