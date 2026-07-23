"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/workspace/services", label: "Services" },
  { href: "/workspace/enquiries", label: "Demandes de contact" },
] as const;

const WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
] as const;

const ROLE_LABEL: Readonly<Record<string, string>> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrateur",
  WORLD_MANAGER: "Responsable de marque",
  EDITOR: "Éditeur",
  SALES: "Commercial",
  CONTRIBUTOR: "Collaborateur",
  READER: "Lecteur",
};

export function AdminShell({
  role,
  children,
}: Readonly<{ role: string | null; children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const worldKey = searchParams.get("world") ?? WORLDS[0].key;

  function handleWorldChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams);
    params.set("world", event.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="admin-shell">
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <aside className="admin-sidebar">
        <Link href="/workspace/services" className="admin-sidebar__mark">
          Pixel<span className="admin-sidebar__mark-accent">&</span>Digital
        </Link>

        <select
          className="admin-sidebar__world"
          value={worldKey}
          onChange={handleWorldChange}
          aria-label="Univers actif"
        >
          {WORLDS.map((world) => (
            <option key={world.key} value={world.key}>
              {world.label}
            </option>
          ))}
        </select>

        <nav className="admin-nav" aria-label="Navigation Workspace">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={`${item.href}?world=${worldKey}`}
              className={
                pathname === item.href
                  ? "admin-nav__item admin-nav__item--active"
                  : "admin-nav__item"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          {role ? <span>{ROLE_LABEL[role] ?? role}</span> : null}
          <ThemeToggle />
        </div>
      </aside>
      <main className="admin-content" id="main-content">
        {children}
      </main>
    </div>
  );
}
