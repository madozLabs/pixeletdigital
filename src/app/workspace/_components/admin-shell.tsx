"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  FolderKanban,
  Globe,
  Inbox,
  LayoutDashboard,
  Layers,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ReceiptText,
  Search,
  SquareKanban,
  UserCog,
  Users,
} from "lucide-react";

import { Avatar } from "./avatar";
import {
  CommandPalette,
  type CommandPaletteHandle,
  type CommandPaletteItem,
} from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

type NavItem = Readonly<{ href: string; label: string; icon: ReactNode }>;
type NavGroup = Readonly<{ label: string; items: readonly NavItem[] }>;

const BILLING_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"] as const;

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

const ICON_SIZE = 17;
const SIDEBAR_COLLAPSE_KEY = "wk-sidebar-collapsed";

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
}

function buildNavGroups(role: string | null): readonly NavGroup[] {
  const isSuperAdmin = role === "SUPER_ADMIN";
  const canBill = Boolean(
    role && BILLING_ROLES.includes(role as (typeof BILLING_ROLES)[number]),
  );

  const groups: NavGroup[] = [
    {
      label: "",
      items: [
        {
          href: "/workspace",
          label: "Tableau de bord",
          icon: <LayoutDashboard size={ICON_SIZE} />,
        },
      ],
    },
    {
      label: "Clients & facturation",
      items: [
        {
          href: "/workspace/clients",
          label: "Clients",
          icon: <Users size={ICON_SIZE} />,
        },
        ...(canBill
          ? [
              {
                href: "/workspace/billing",
                label: "Facturation",
                icon: <ReceiptText size={ICON_SIZE} />,
              },
            ]
          : []),
      ],
    },
    {
      label: "Production",
      items: [
        {
          href: "/workspace/projects",
          label: "Projets",
          icon: <FolderKanban size={ICON_SIZE} />,
        },
        {
          href: "/workspace/tasks",
          label: "Tâches",
          icon: <SquareKanban size={ICON_SIZE} />,
        },
        {
          href: "/workspace/editorial",
          label: "Calendrier éditorial",
          icon: <CalendarDays size={ICON_SIZE} />,
        },
      ],
    },
    {
      label: "Site & contact",
      items: [
        {
          href: "/workspace/services",
          label: "Services",
          icon: <Layers size={ICON_SIZE} />,
        },
        {
          href: "/workspace/site-content",
          label: "Site & contenus",
          icon: <Globe size={ICON_SIZE} />,
        },
        {
          href: "/workspace/enquiries",
          label: "Demandes de contact",
          icon: <Inbox size={ICON_SIZE} />,
        },
      ],
    },
  ];

  if (isSuperAdmin) {
    groups.push({
      label: "Administration",
      items: [
        {
          href: "/workspace/access",
          label: "Utilisateurs et accès",
          icon: <UserCog size={ICON_SIZE} />,
        },
        {
          href: "/workspace/organization",
          label: "Organisation",
          icon: <Network size={ICON_SIZE} />,
        },
      ],
    });
  }

  return groups;
}

function buildCommandPaletteItems(
  navGroups: readonly NavGroup[],
  worldKey: string,
): readonly CommandPaletteItem[] {
  const navItems: CommandPaletteItem[] = navGroups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.href,
      label: item.label,
      href: `${item.href}?world=${worldKey}`,
      group: "Aller à",
      icon: item.icon,
    })),
  );

  const quickActions: CommandPaletteItem[] = [
    {
      id: "quick-project",
      label: "Nouveau projet",
      href: `/workspace/projects?world=${worldKey}`,
      group: "Actions rapides",
      icon: <PlusCircle size={ICON_SIZE} />,
    },
    {
      id: "quick-task",
      label: "Nouvelle tâche",
      href: `/workspace/tasks?world=${worldKey}`,
      group: "Actions rapides",
      icon: <PlusCircle size={ICON_SIZE} />,
    },
    {
      id: "quick-client",
      label: "Nouveau client",
      href: `/workspace/clients?world=${worldKey}`,
      group: "Actions rapides",
      icon: <PlusCircle size={ICON_SIZE} />,
    },
  ];

  return [...quickActions, ...navItems];
}

export function AdminShell({
  role,
  children,
}: Readonly<{ role: string | null; children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const worldKey = searchParams.get("world") ?? WORLDS[0].key;
  const navGroups = buildNavGroups(role);
  const roleLabel = role ? (ROLE_LABEL[role] ?? role) : null;
  const commandPaletteRef = useRef<CommandPaletteHandle>(null);
  const commandPaletteItems = useMemo(
    () => buildCommandPaletteItems(navGroups, worldKey),
    [navGroups, worldKey],
  );
  // Lazy initializer: reads localStorage once on the client's actual first
  // render, same rationale/pattern as ThemeToggle's readStoredTheme().
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readStoredCollapsed(),
  );

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function handleWorldChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams);
    params.set("world", event.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className="admin-shell"
      data-world={worldKey}
      data-sidebar-collapsed={collapsed}
      suppressHydrationWarning
    >
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <aside className="admin-sidebar">
        <div className="admin-sidebar__top">
          <Link href="/workspace" className="admin-sidebar__mark">
            <span className="admin-sidebar__mark-full">
              Pixel<span className="admin-sidebar__mark-accent">&</span>
              Digital
            </span>
            <span className="admin-sidebar__mark-mini" aria-hidden="true">
              P<span className="admin-sidebar__mark-accent">&</span>D
            </span>
          </Link>
          <button
            type="button"
            className="admin-sidebar__collapse-toggle"
            onClick={toggleCollapsed}
            aria-label={
              collapsed
                ? "Déplier la barre latérale"
                : "Réduire la barre latérale"
            }
            title={collapsed ? "Déplier" : "Réduire"}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
        </div>

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

        <button
          type="button"
          className="command-palette-trigger"
          onClick={() => commandPaletteRef.current?.open()}
        >
          <span className="command-palette-trigger__label">
            <Search size={15} aria-hidden="true" />
            {!collapsed ? "Rechercher…" : null}
          </span>
          {!collapsed ? <kbd>Ctrl K</kbd> : null}
        </button>

        <nav className="admin-nav" aria-label="Navigation Workspace">
          {navGroups.map((group) => (
            <div className="admin-nav__group" key={group.label || "root"}>
              {group.label ? (
                <span className="admin-nav__group-label">{group.label}</span>
              ) : null}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={`${item.href}?world=${worldKey}`}
                  className={
                    pathname === item.href
                      ? "admin-nav__item admin-nav__item--active"
                      : "admin-nav__item"
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <span className="admin-nav__icon">{item.icon}</span>
                  <span className="admin-nav__label">{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          {roleLabel ? (
            <span className="admin-sidebar__user" title={roleLabel}>
              <Avatar name={roleLabel} size="sm" />
              <span className="admin-sidebar__user-label">{roleLabel}</span>
            </span>
          ) : null}
          <ThemeToggle />
        </div>
      </aside>
      <main className="admin-content" id="main-content">
        {children}
      </main>
      <CommandPalette ref={commandPaletteRef} items={commandPaletteItems} />
    </div>
  );
}
