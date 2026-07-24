import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listEnquiriesByWorld } from "@/modules/enquiries/application/list-enquiries-by-world";
import { PrismaEnquiryRepository } from "@/modules/enquiries/infrastructure/prisma-enquiry-repository";

import { AbuseStatusBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";

const WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
];

export default async function WorkspaceEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world } = await searchParams;
  const worldKey = world ?? WORLDS[0]!.key;

  const result = await listEnquiriesByWorld(
    { enquiries: new PrismaEnquiryRepository(prisma) },
    context,
    { worldKey },
  );

  const enquiries = result.ok ? result.value : [];

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
              </tr>
            </thead>
            <tbody>
              {enquiries.map((enquiry) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

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
