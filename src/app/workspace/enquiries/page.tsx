import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listEnquiriesByWorld } from "@/modules/enquiries/application/list-enquiries-by-world";
import { PrismaEnquiryRepository } from "@/modules/enquiries/infrastructure/prisma-enquiry-repository";

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

  return (
    <main>
      <h1>Demandes de contact</h1>
      <nav>
        {WORLDS.map((entry) => (
          <a key={entry.key} href={`/workspace/enquiries?world=${entry.key}`}>
            {entry.label}
          </a>
        ))}
      </nav>

      {!result.ok ? (
        <p role="alert">{result.error.message}</p>
      ) : result.value.length === 0 ? (
        <p>Aucune demande reçue pour cet univers.</p>
      ) : (
        <table>
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
            {result.value.map((enquiry) => (
              <tr key={enquiry.id}>
                <td>{enquiry.submittedAt.toISOString()}</td>
                <td>{enquiry.name}</td>
                <td>{enquiry.email}</td>
                <td>{enquiry.phone ?? "—"}</td>
                <td>{enquiry.message}</td>
                <td>{enquiry.serviceId ?? "—"}</td>
                <td>
                  {enquiry.abuseStatus === "FLAGGED" ? "Signalé" : "Reçu"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
