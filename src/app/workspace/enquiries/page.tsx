import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listEnquiriesByWorld } from "@/modules/enquiries/application/list-enquiries-by-world";
import { PrismaEnquiryRepository } from "@/modules/enquiries/infrastructure/prisma-enquiry-repository";
import {
  getLeadDetail,
  listLeadsForEnquiries,
  type LeadDetail,
} from "@/modules/leads/application/lead-use-cases";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/prisma-lead-repository";

import { AbuseStatusBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  addLeadNoteAction,
  assignLeadAction,
  completeNextActionAction,
  setNextActionAction,
  updateLeadStatusAction,
} from "./actions";

const WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
];

const LEAD_STATUS_LABEL: Readonly<Record<string, string>> = {
  NEW: "Nouveau",
  IN_REVIEW: "En qualification",
  QUALIFIED: "Qualifié",
  UNQUALIFIED: "Non qualifié",
  CLOSED: "Clôturé",
};

const LEAD_STATUS_TONE: Readonly<Record<string, string>> = {
  NEW: "neutral",
  IN_REVIEW: "warning",
  QUALIFIED: "positive",
  UNQUALIFIED: "neutral",
  CLOSED: "positive",
};

function leadRepository() {
  return { leads: new PrismaLeadRepository(prisma) };
}

export default async function WorkspaceEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string; lead?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world, lead: selectedLeadId } = await searchParams;
  const worldKey = world ?? WORLDS[0]!.key;

  const result = await listEnquiriesByWorld(
    { enquiries: new PrismaEnquiryRepository(prisma) },
    context,
    { worldKey },
  );

  const enquiries = result.ok ? result.value : [];

  const leadsResult = await listLeadsForEnquiries(leadRepository(), context, {
    worldKey,
    enquiryIds: enquiries.map((enquiry) => enquiry.id),
  });
  const leadsByEnquiryId = leadsResult.ok ? leadsResult.value : new Map();

  const detail = selectedLeadId
    ? await getLeadDetail(leadRepository(), context, { id: selectedLeadId })
    : null;

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { displayName: "asc" },
  });

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Demandes de contact</h1>
          <p className="admin-content__lede">
            Messages reçus via les formulaires publics du site.
          </p>
        </div>
        <span className="admin-metric">
          {enquiries.length} demande{enquiries.length > 1 ? "s" : ""}
        </span>
      </div>

      {!result.ok ? (
        <p role="alert">{result.error.message}</p>
      ) : enquiries.length === 0 ? (
        <p className="admin-empty">Aucune demande reçue pour cet univers.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reçu le</th>
                <th>Nom</th>
                <th>E-mail</th>
                <th>Téléphone</th>
                <th>Message</th>
                <th>Service</th>
                <th>Statut</th>
                <th>Lead</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((enquiry) => {
                const lead = leadsByEnquiryId.get(enquiry.id);
                return (
                  <tr key={enquiry.id}>
                    <td>{formatDateTime(enquiry.submittedAt)}</td>
                    <td>{enquiry.name}</td>
                    <td>{enquiry.email}</td>
                    <td>{enquiry.phone ?? "—"}</td>
                    <td>{enquiry.message}</td>
                    <td>{enquiry.serviceId ?? "—"}</td>
                    <td>
                      <AbuseStatusBadge status={enquiry.abuseStatus} />
                    </td>
                    <td>
                      {lead ? (
                        <Link
                          className="admin-table__action"
                          href={`/workspace/enquiries?world=${worldKey}&lead=${lead.id}`}
                        >
                          <span
                            className={`status-badge status-badge--${LEAD_STATUS_TONE[lead.status]}`}
                          >
                            {LEAD_STATUS_LABEL[lead.status] ?? lead.status}
                          </span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail ? (
        detail.ok ? (
          <LeadDetailPanel
            worldKey={worldKey}
            detail={detail.value}
            users={users}
          />
        ) : (
          <p role="alert">{detail.error.message}</p>
        )
      ) : null}
    </>
  );
}

function LeadDetailPanel({
  worldKey,
  detail,
  users,
}: Readonly<{
  worldKey: string;
  detail: LeadDetail;
  users: readonly {
    id: string;
    displayName: string | null;
    normalizedEmail: string | null;
  }[];
}>) {
  const { lead, notes, nextActions, activities } = detail;
  const nextStatuses = ALLOWED_NEXT_STATUSES[lead.status] ?? [];

  return (
    <section className="admin-form-card" aria-label="Détail du lead">
      <div className="admin-page-heading">
        <div>
          <h2 className="admin-content__subtitle">
            Lead — {lead.name} ({lead.email})
          </h2>
          <p className="admin-table__note">
            Source : {lead.source} · Créé le {formatDateTime(lead.createdAt)}
          </p>
        </div>
        <span
          className={`status-badge status-badge--${LEAD_STATUS_TONE[lead.status]}`}
        >
          {LEAD_STATUS_LABEL[lead.status] ?? lead.status}
        </span>
      </div>

      <div className="admin-form-grid">
        {nextStatuses.length > 0 ? (
          <form action={updateLeadStatusAction} className="billing-inline-form">
            <input type="hidden" name="worldKey" value={worldKey} />
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="expectedVersion" value={lead.version} />
            <label>
              Nouveau statut
              <select name="status" defaultValue={nextStatuses[0]}>
                {nextStatuses.map((status) => (
                  <option key={status} value={status}>
                    {LEAD_STATUS_LABEL[status] ?? status}
                  </option>
                ))}
              </select>
            </label>
            {nextStatuses.includes("CLOSED") ? (
              <label>
                Résultat de la clôture
                <input name="closedOutcome" maxLength={500} />
              </label>
            ) : null}
            <button className="admin-table__action" type="submit">
              Changer le statut
            </button>
          </form>
        ) : (
          <p className="admin-table__note">Ce lead est clôturé.</p>
        )}

        <form action={assignLeadAction} className="billing-inline-form">
          <input type="hidden" name="worldKey" value={worldKey} />
          <input type="hidden" name="leadId" value={lead.id} />
          <input type="hidden" name="expectedVersion" value={lead.version} />
          <label>
            Assigner à
            <select name="ownerUserId" defaultValue={lead.ownerUserId ?? ""}>
              <option value="" disabled>
                Choisir un collaborateur
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName ?? user.normalizedEmail}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-table__action" type="submit">
            Assigner
          </button>
        </form>
      </div>

      <div className="cms-overview__grid">
        <section className="dashboard-panel">
          <h3>Notes</h3>
          {notes.length === 0 ? (
            <p className="admin-empty">Aucune note.</p>
          ) : (
            <ul>
              {notes.map((note) => (
                <li key={note.id}>
                  <span>{formatDateTime(note.createdAt)}</span>
                  <p>{note.body}</p>
                </li>
              ))}
            </ul>
          )}
          <form action={addLeadNoteAction} className="billing-inline-form">
            <input type="hidden" name="worldKey" value={worldKey} />
            <input type="hidden" name="leadId" value={lead.id} />
            <label>
              Ajouter une note
              <textarea name="body" maxLength={2000} required />
            </label>
            <button className="admin-table__action" type="submit">
              Enregistrer la note
            </button>
          </form>
        </section>

        <section className="dashboard-panel">
          <h3>Prochaines actions</h3>
          {nextActions.length === 0 ? (
            <p className="admin-empty">Aucune prochaine action.</p>
          ) : (
            <ul>
              {nextActions.map((nextAction) => (
                <li key={nextAction.id}>
                  <strong>{nextAction.description}</strong>
                  <span>
                    Échéance {formatDateTime(nextAction.dueDate)} ·{" "}
                    {nextAction.status === "PENDING"
                      ? "En attente"
                      : nextAction.status === "COMPLETED"
                        ? "Terminée"
                        : "Annulée"}
                  </span>
                  {nextAction.status === "PENDING" ? (
                    <form action={completeNextActionAction}>
                      <input type="hidden" name="worldKey" value={worldKey} />
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input
                        type="hidden"
                        name="nextActionId"
                        value={nextAction.id}
                      />
                      <button className="admin-table__action" type="submit">
                        Marquer terminée
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <form action={setNextActionAction} className="billing-inline-form">
            <input type="hidden" name="worldKey" value={worldKey} />
            <input type="hidden" name="leadId" value={lead.id} />
            <label>
              Description
              <input name="description" maxLength={500} required />
            </label>
            <label>
              Responsable
              <select name="ownerUserId" defaultValue={lead.ownerUserId ?? ""}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName ?? user.normalizedEmail}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Échéance
              <input name="dueDate" type="date" required />
            </label>
            <button className="admin-table__action" type="submit">
              Planifier
            </button>
          </form>
        </section>

        <section className="dashboard-panel">
          <h3>Historique</h3>
          {activities.length === 0 ? (
            <p className="admin-empty">Aucune activité.</p>
          ) : (
            <ul>
              {activities.map((activity) => (
                <li key={activity.id}>
                  <strong>
                    {ACTIVITY_LABEL[activity.type] ?? activity.type}
                  </strong>
                  <span>
                    {formatDateTime(activity.occurredAt)}
                    {activity.detail ? ` · ${activity.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

const ALLOWED_NEXT_STATUSES: Readonly<Record<string, readonly string[]>> = {
  NEW: ["IN_REVIEW"],
  IN_REVIEW: ["QUALIFIED", "UNQUALIFIED"],
  QUALIFIED: ["CLOSED"],
  UNQUALIFIED: ["CLOSED"],
  CLOSED: [],
};

const ACTIVITY_LABEL: Readonly<Record<string, string>> = {
  CREATED: "Lead créé",
  STATUS_CHANGED: "Statut modifié",
  ASSIGNED: "Assigné",
  NOTE_ADDED: "Note ajoutée",
  NEXT_ACTION_SET: "Prochaine action planifiée",
  NEXT_ACTION_COMPLETED: "Prochaine action terminée",
};

function formatDateTime(date: Date): string {
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
