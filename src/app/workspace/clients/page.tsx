/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { archiveProfessionalClientAction } from "./actions";
import { ClientContactForm, CreateClientForm } from "./client-forms";

const CLIENT_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"] as const;

export default async function ClientsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ world?: string }> }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (
    !context.actor?.role ||
    !CLIENT_ROLES.includes(context.actor.role as (typeof CLIENT_ROLES)[number])
  ) {
    return (
      <p role="alert">Vous n&apos;êtes pas autorisé à gérer les clients.</p>
    );
  }

  const { world } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const [clients, users, teams] = await Promise.all([
    prisma.client.findMany({
      where: { worldKey },
      include: {
        accountManager: true,
        commercialOwner: true,
        team: { include: { department: true } },
        contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
    }),
    prisma.team.findMany({
      include: { department: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const userOptions = users.map((item) => ({
    value: item.id,
    label: item.displayName ?? item.normalizedEmail ?? "Collaborateur",
  }));
  const teamOptions = teams.map((item) => ({
    value: item.id,
    label: `${item.department.name} · ${item.name}`,
  }));

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Clients</h1>
          <p className="admin-content__lede">
            Gérez les comptes, contacts, responsables et équipes affectées.
          </p>
        </div>
        <span className="admin-metric">{clients.length} clients</span>
      </div>

      <CreateClientForm
        worldKey={worldKey}
        users={userOptions}
        teams={teamOptions}
      />

      <section className="client-card-grid">
        {clients.length === 0 ? (
          <p className="admin-empty">Aucun client.</p>
        ) : null}
        {clients.map((client) => (
          <article key={client.id} className="client-card">
            <header className="client-card__header">
              <div className="client-card__identity">
                {client.logoUrl ? (
                  <img src={client.logoUrl} alt="" width={56} height={56} />
                ) : (
                  <span className="client-card__logo-placeholder">
                    {client.name.slice(0, 1)}
                  </span>
                )}
                <div>
                  <h2>{client.name}</h2>
                  <p>
                    {client.legalName ?? client.industry ?? "Compte client"}
                  </p>
                </div>
              </div>
              <span
                className={`status-badge status-badge--${client.status.toLowerCase()}`}
              >
                {client.status === "ACTIVE" ? "Actif" : "Archivé"}
              </span>
            </header>{" "}
            <dl className="client-card__meta">
              <div>
                <dt>Responsable</dt>
                <dd>{client.accountManager?.displayName ?? "Non affecté"}</dd>
              </div>
              <div>
                <dt>Commercial</dt>
                <dd>{client.commercialOwner?.displayName ?? "Non affecté"}</dd>
              </div>
              <div>
                <dt>Équipe</dt>
                <dd>
                  {client.team
                    ? `${client.team.department.name} · ${client.team.name}`
                    : "Non affectée"}
                </dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{client.email ?? client.phone ?? "Non renseigné"}</dd>
              </div>
            </dl>
            <section className="client-card__contacts">
              <h3>Contacts</h3>
              {client.contacts.length === 0 ? (
                <p className="admin-empty">Aucun contact.</p>
              ) : (
                <ul>
                  {client.contacts.map((contact) => (
                    <li key={contact.id}>
                      <strong>{contact.name}</strong>
                      {contact.role ? ` · ${contact.role}` : ""}
                      {contact.isPrimary ? " · Principal" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {client.status === "ACTIVE" ? (
              <details className="admin-user-card__details">
                <summary>Ajouter un contact</summary>
                <ClientContactForm clientId={client.id} />
              </details>
            ) : null}
            {client.status === "ACTIVE" ? (
              <form action={archiveProfessionalClientAction}>
                <input type="hidden" name="clientId" value={client.id} />
                <input
                  type="hidden"
                  name="expectedVersion"
                  value={client.version}
                />
                <button className="admin-table__action" type="submit">
                  Archiver le client
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}
