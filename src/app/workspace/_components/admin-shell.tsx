"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarDays,
  FolderKanban,
  Globe,
  Inbox,
  LayoutDashboard,
  Layers,
  Network,
  ReceiptText,
  SquareKanban,
  UserCog,
  Users,
} from "lucide-react";

import { Avatar } from "./avatar";
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
        <Link href="/workspace" className="admin-sidebar__mark">
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
                >
                  <span className="admin-nav__icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          {roleLabel ? (
            <span className="admin-sidebar__user">
              <Avatar name={roleLabel} size="sm" />
              <span>{roleLabel}</span>
            </span>
          ) : null}
          <ThemeToggle />
        </div>
      </aside>
      <main className="admin-content" id="main-content">
        {children}
      </main>
    </div>
  );
}
