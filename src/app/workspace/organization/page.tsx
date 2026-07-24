import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { endMembershipAction } from "./actions";
import {
  DepartmentForm,
  MembershipForm,
  PositionForm,
  TeamForm,
} from "./organization-forms";

export default async function OrganizationPage() {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (context.actor?.role !== "SUPER_ADMIN") {
    return (
      <p role="alert">Seul un Super Admin peut gérer l&apos;organisation.</p>
    );
  }

  const [departments, positions, users] = await Promise.all([
    prisma.department.findMany({
      include: {
        teams: {
          include: {
            memberships: {
              include: { user: true, jobPosition: true },
              where: { endedAt: null },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.jobPosition.findMany({ orderBy: { title: "asc" } }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const departmentOptions = departments.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const teamOptions = departments.flatMap((department) =>
    department.teams.map((team) => ({
      value: team.id,
      label: `${department.name} · ${team.name}`,
    })),
  );
  const positionOptions = positions.map((item) => ({
    value: item.id,
    label: item.title,
  }));
  const userOptions = users.map((item) => ({
    value: item.id,
    label: item.displayName ?? item.normalizedEmail ?? "Collaborateur",
  }));

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Organisation</h1>
          <p className="admin-content__lede">
            Structurez les départements, équipes, postes et affectations.
          </p>
        </div>
        <span className="admin-metric">
          {users.length} collaborateur{users.length > 1 ? "s" : ""} actif
          {users.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="organization-form-grid">
        <DepartmentForm />
        <PositionForm />
      </div>
      <TeamForm departments={departmentOptions} />
      <MembershipForm
        users={userOptions}
        teams={teamOptions}
        positions={positionOptions}
      />
      <section className="organization-chart">
        {departments.length === 0 ? (
          <p className="admin-empty">Aucun département créé.</p>
        ) : (
          departments.map((department) => (
            <article key={department.id} className="organization-department">
              <header>
                <h2>{department.name}</h2>
                {department.description ? (
                  <p>{department.description}</p>
                ) : null}
              </header>
              <div className="organization-team-grid">
                {department.teams.map((team) => (
                  <section key={team.id} className="organization-team-card">
                    <h3>{team.name}</h3>
                    {team.description ? <p>{team.description}</p> : null}
                    {team.memberships.length === 0 ? (
                      <p className="admin-empty">Aucun membre actif.</p>
                    ) : (
                      <ul>
                        {team.memberships.map((membership) => (
                          <li key={membership.id}>
                            <span>
                              <strong>
                                {membership.user.displayName ??
                                  membership.user.normalizedEmail}
                              </strong>
                              {membership.jobPosition
                                ? ` · ${membership.jobPosition.title}`
                                : ""}
                              {membership.isPrimary
                                ? " · Équipe principale"
                                : ""}
                            </span>
                            <form action={endMembershipAction}>
                              <input
                                type="hidden"
                                name="membershipId"
                                value={membership.id}
                              />
                              <button
                                type="submit"
                                className="admin-table__action"
                              >
                                Retirer
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
