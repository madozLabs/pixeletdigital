import Link from "next/link";
import type { ReactNode } from "react";

export type DashboardItem = Readonly<{ title: string; meta: string }>;

type PersonalQueue = Readonly<{
  title: string;
  empty: string;
  items: readonly DashboardItem[];
  count: number;
  href: string;
}>;

export function MyWorkPanel({
  queues,
}: Readonly<{ queues: readonly PersonalQueue[] }>) {
  return (
    <section className="dashboard-panel-group" aria-labelledby="my-work-title">
      <h2 id="my-work-title" className="dashboard-panel-group__title">
        Mon travail
      </h2>
      <p className="dashboard-panel-group__lede">
        Vos priorités dans l’univers actif, assignées directement à votre
        compte.
      </p>
      <div className="dashboard-grid">
        {queues.map((queue) => (
          <DashboardList key={queue.title} {...queue} />
        ))}
      </div>
    </section>
  );
}

export function TeamMetricsSummary({
  metrics,
  children,
}: Readonly<{ metrics: ReactNode; children: ReactNode }>) {
  return (
    <details className="dashboard-overview">
      <summary>Vue d’ensemble de l’agence</summary>
      <div className="dashboard-overview__content">
        {metrics}
        {children}
      </div>
    </details>
  );
}

export function Metric({
  label,
  value,
  href,
  tone,
  icon,
}: Readonly<{
  label: string;
  value: string | number;
  href: string;
  tone: "danger" | "warning" | "info" | "violet" | "accent" | "success";
  icon: ReactNode;
}>) {
  return (
    <Link href={href} className="dashboard-metric-card">
      <span className={`metric-icon metric-icon--${tone}`}>{icon}</span>
      <span className="dashboard-metric-card__body">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </Link>
  );
}

export function DashboardList({
  title,
  empty,
  items,
  count,
  href,
}: Readonly<{
  title: string;
  empty: string;
  items: readonly DashboardItem[];
  count?: number;
  href?: string;
}>) {
  const heading = (
    <h2>
      {title}
      {count !== undefined ? (
        <span className="dashboard-panel__count">{count}</span>
      ) : null}
    </h2>
  );

  return (
    <section className="dashboard-panel">
      {href ? <Link href={href}>{heading}</Link> : heading}
      {items.length === 0 ? (
        <p className="admin-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${item.title}-${item.meta}`}>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
