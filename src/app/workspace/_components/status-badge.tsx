const LIFECYCLE_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  IN_REVIEW: "En revue",
  SCHEDULED: "Planifié",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
};

const LIFECYCLE_TONE: Readonly<
  Record<string, "positive" | "warning" | "neutral">
> = {
  DRAFT: "neutral",
  IN_REVIEW: "warning",
  SCHEDULED: "warning",
  PUBLISHED: "positive",
  ARCHIVED: "neutral",
};

export function LifecycleBadge({ lifecycle }: Readonly<{ lifecycle: string }>) {
  const tone = LIFECYCLE_TONE[lifecycle] ?? "neutral";
  return (
    <span className={`status-badge status-badge--${tone}`}>
      {LIFECYCLE_LABEL[lifecycle] ?? lifecycle}
    </span>
  );
}

export function AbuseStatusBadge({ status }: Readonly<{ status: string }>) {
  const isFlagged = status === "FLAGGED";
  return (
    <span
      className={`status-badge ${isFlagged ? "status-badge--warning" : "status-badge--positive"}`}
    >
      {isFlagged ? "Signalé" : "Reçu"}
    </span>
  );
}
