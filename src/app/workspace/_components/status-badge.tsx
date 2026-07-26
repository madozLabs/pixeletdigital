const LIFECYCLE_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  IN_REVIEW: "En revue",
  SCHEDULED: "Planifié",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
};

const STATUS_LABELS = {
  user: { ACTIVE: "Actif", INACTIVE: "Suspendu" },
  project: {
    PLANNED: "Planifié",
    ACTIVE: "Actif",
    ON_HOLD: "En pause",
    COMPLETED: "Terminé",
    CANCELLED: "Annulé",
  },
  task: {
    BACKLOG: "Backlog",
    TODO: "À faire",
    IN_PROGRESS: "En cours",
    BLOCKED: "Bloquée",
    REVIEW: "En validation",
    DONE: "Terminée",
    CANCELLED: "Annulée",
  },
  quote: {
    DRAFT: "Brouillon",
    SENT: "Envoyé",
    ACCEPTED: "Accepté",
    DECLINED: "Refusé",
    EXPIRED: "Expiré",
    CONVERTED: "Converti",
    CANCELLED: "Annulé",
  },
  invoice: {
    DRAFT: "Brouillon",
    SENT: "Envoyée",
    PARTIALLY_PAID: "Partiellement payée",
    PAID: "Payée",
    OVERDUE: "En retard",
    CANCELLED: "Annulée",
  },
  service: LIFECYCLE_LABEL,
  content: LIFECYCLE_LABEL,
  editorial: {
    DRAFT: "Brouillon",
    INTERNAL_REVIEW: "Validation interne",
    CLIENT_REVIEW: "Validation client",
    APPROVED: "Approuvé",
    SCHEDULED: "Programmé",
    PUBLISHED: "Publié",
    CANCELLED: "Annulé",
  },
  lead: {
    NEW: "Nouveau",
    IN_REVIEW: "En qualification",
    QUALIFIED: "Qualifié",
    UNQUALIFIED: "Non qualifié",
    CLOSED: "Clôturé",
  },
} as const satisfies Readonly<Record<string, Readonly<Record<string, string>>>>;

export type StatusKind = keyof typeof STATUS_LABELS;

const STATUS_TONES: Readonly<Record<string, string>> = {
  ACTIVE: "positive",
  INACTIVE: "neutral",
  NEW: "neutral",
  IN_REVIEW: "warning",
  INTERNAL_REVIEW: "warning",
  CLIENT_REVIEW: "warning",
  QUALIFIED: "positive",
  UNQUALIFIED: "neutral",
  CLOSED: "positive",
};

export function getStatusLabel(kind: StatusKind, status: string): string {
  const labels = STATUS_LABELS[kind] as Readonly<Record<string, string>>;
  return labels[status] ?? status;
}

export function StatusBadge({
  kind,
  status,
}: Readonly<{ kind: StatusKind; status: string }>) {
  const tone = STATUS_TONES[status] ?? status.toLowerCase();
  return (
    <span className={`status-badge status-badge--${tone}`}>
      {getStatusLabel(kind, status)}
    </span>
  );
}

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
