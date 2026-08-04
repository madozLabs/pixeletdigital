"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  FilePlus2,
  FileText,
  Gauge,
  Globe2,
  Image,
  LayoutTemplate,
  Menu,
  Palette,
  Puzzle,
  Settings,
} from "lucide-react";
import { buildCmsWorldSwitchHref } from "./cms-navigation";

const NAVIGATION = [
  { href: "/workspace/site-content", label: "Tableau de bord", icon: Gauge },
  {
    href: "/workspace/site-content/pages",
    label: "Pages",
    icon: FileText,
  },
  {
    href: "/workspace/site-content/pages/new",
    label: "Ajouter une page",
    icon: FilePlus2,
  },
  {
    href: "/workspace/site-content/media",
    label: "Médiathèque",
    icon: Image,
  },
  {
    href: "/workspace/site-content/components",
    label: "Composants",
    icon: Puzzle,
  },
  {
    href: "/workspace/site-content/templates",
    label: "Gabarits",
    icon: LayoutTemplate,
  },
  {
    href: "/workspace/site-content/navigation",
    label: "Menus",
    icon: Menu,
  },
  {
    href: "/workspace/site-content/appearance",
    label: "Apparence",
    icon: Palette,
  },
  {
    href: "/workspace/site-content/settings",
    label: "Réglages",
    icon: Settings,
  },
] as const;

export function CmsShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const worldKey = searchParams.get("world") ?? "pixel-digital";

  function changeWorld(nextWorld: string) {
    router.push(buildCmsWorldSwitchHref(pathname, nextWorld));
  }

  return (
    <div className="cms-app-shell">
      <aside className="cms-app-sidebar">
        <div className="cms-app-brand">
          <span className="cms-app-brand__icon">
            <Globe2 size={20} />
          </span>
          <span>
            <strong>Studio du site</strong>
            <small>Pixel&amp;Digital CMS</small>
          </span>
        </div>

        <label className="cms-app-world">
          <span>Site administré</span>
          <select
            aria-label="Site administré"
            value={worldKey}
            onChange={(event) => changeWorld(event.target.value)}
          >
            <option value="pixel-digital">Pixel&amp;Digital</option>
            <option value="kwaliti-print">Kwaliti Print</option>
          </select>
        </label>

        <nav className="cms-app-nav" aria-label="Navigation du CMS">
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            const active = isActiveCmsRoute(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={`${item.href}?world=${worldKey}`}
                className={
                  active ? "cms-app-nav__item is-active" : "cms-app-nav__item"
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="cms-app-sidebar__footer">
          <a
            href={worldKey === "kwaliti-print" ? "/kwaliti-print" : "/"}
            target="_blank"
            rel="noreferrer"
            className="cms-app-site-link"
          >
            <Globe2 size={17} /> Voir le site
          </a>
          <Link href={`/workspace?world=${worldKey}`}>
            <ArrowLeft size={17} /> Retour au Workspace
          </Link>
        </div>
      </aside>
      <main className="cms-app-content" id="main-content">
        {children}
      </main>
    </div>
  );
}

function isActiveCmsRoute(pathname: string, href: string): boolean {
  if (href === "/workspace/site-content") return pathname === href;
  if (href === "/workspace/site-content/pages/new") return pathname === href;
  if (href === "/workspace/site-content/pages") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        pathname !== "/workspace/site-content/pages/new")
    );
  }
  return pathname.startsWith(href);
}
