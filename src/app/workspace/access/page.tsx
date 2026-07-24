import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  AssignRoleForm,
  CreateEmployeeForm,
  RevokeRoleForm,
  UserStatusForm,
} from "./access-forms";

const ROLE_LABEL: Readonly<Record<string, string>> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrateur",
  WORLD_MANAGER: "Responsable de marque",
  EDITOR: "Éditeur",
  SALES: "Commercial",
  CONTRIBUTOR: "Collaborateur",
  READER: "Lecteur",
};

export default async function WorkspaceAccessPage() {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (context.actor?.role !== "SUPER_ADMIN") {
    return (
      <>
        <h1 className="admin-content__title">Utilisateurs et accès</h1>
        <p role="alert">
          Seul un Super Admin peut gérer les profils et les rôles.
        </p>
      </>
    );
  }

  const users = await prisma.user.findMany({
    include: {
      roleAssignments: {
        include: { world: { select: { displayName: true, key: true } } },
        orderBy: { validFrom: "desc" },
      },
    },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
  });
  const now = new Date();
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Utilisateurs et accès</h1>
          <p className="admin-content__lede">
            Créez les profils, suspendez les comptes et gérez les rôles par
            univers.
          </p>
        </div>
        <span className="admin-metric">{users.length} profils</span>
      </div>

      <CreateEmployeeForm />

      <div className="admin-user-list">
        {users.map((user) => {
          const activeAssignments = user.roleAssignments.filter(
            (assignment) =>
              assignment.validFrom <= now &&
              (!assignment.validUntil || assignment.validUntil > now),
          );
          return (
            <article key={user.id} className="admin-user-card">
              <header className="admin-user-card__header">
                <div>
                  <h2>{user.displayName ?? "Profil sans nom"}</h2>
                  <p>{user.normalizedEmail ?? "Aucun e-mail"}</p>
                </div>
                <div className="admin-user-card__status">
                  <span
                    className={`status-badge status-badge--${user.status.toLowerCase()}`}
                  >
                    {user.status === "ACTIVE" ? "Actif" : "Suspendu"}
                  </span>
                  <UserStatusForm
                    userId={user.id}
                    currentStatus={user.status}
                  />
                </div>
              </header>

              <div className="admin-user-card__assignments">
                <h3>Rôles actifs</h3>
                {activeAssignments.length === 0 ? (
                  <p className="admin-empty">Aucun rôle actif.</p>
                ) : (
                  <ul>
                    {activeAssignments.map((assignment) => (
                      <li key={assignment.id}>
                        <span>
                          <strong>
                            {ROLE_LABEL[assignment.role] ?? assignment.role}
                          </strong>
                          {assignment.scopeType === "GLOBAL"
                            ? " · Toute l'organisation"
                            : ` · ${assignment.world?.displayName ?? assignment.world?.key ?? "Univers"}`}
                        </span>
                        <RevokeRoleForm assignmentId={assignment.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <details className="admin-user-card__details">
                <summary>Ajouter un rôle</summary>
                <AssignRoleForm userId={user.id} />
              </details>
            </article>
          );
        })}
      </div>
    </>
  );
}
