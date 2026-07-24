import { notFound as notFoundResponse, redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getInvoiceById } from "@/modules/billing/application/invoice-use-cases";
import { PrismaClientRepository } from "@/modules/billing/infrastructure/prisma-client-repository";
import { PrismaInvoiceRepository } from "@/modules/billing/infrastructure/prisma-invoice-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { getWorkspaceRequestContext } from "../../../../get-workspace-context";
import { PrintButton } from "../../../_components/print-button";
import { formatXof } from "../../../_lib/money";

const INVOICE_STATUS_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  SENT: "Envoyée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { id } = await params;

  const deps = {
    invoices: new PrismaInvoiceRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };
  const result = await getInvoiceById(deps, context, { id });
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") notFoundResponse();
    return <p role="alert">{result.error.message}</p>;
  }

  const invoice = result.value;
  const client = await new PrismaClientRepository(prisma).findById(
    invoice.clientId,
  );

  return (
    <div className="invoice-print">
      <PrintButton />

      <header className="invoice-print__header">
        <div>
          <p className="invoice-print__brand">Pixel&Digital</p>
          <p className="invoice-print__meta">Facture {invoice.number}</p>
          <p className="invoice-print__meta">
            Émise le {invoice.issuedAt.toLocaleDateString("fr-FR")}
          </p>
          <p className="invoice-print__meta">
            Statut : {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
          </p>
          {invoice.dueAt ? (
            <p className="invoice-print__meta">
              Échéance : {invoice.dueAt.toLocaleDateString("fr-FR")}
            </p>
          ) : null}
        </div>
        <div>
          <p className="invoice-print__label">Client</p>
          <p>{client?.name ?? "—"}</p>
          {client?.email ? <p>{client.email}</p> : null}
          {client?.address ? <p>{client.address}</p> : null}
        </div>
      </header>

      <table className="invoice-print__table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantité</th>
            <th>Prix unitaire</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.label}</td>
              <td>{line.quantity}</td>
              <td>{formatXof(line.unitPriceCents)}</td>
              <td>{formatXof(line.totalCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total</td>
            <td>{formatXof(invoice.totalCents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
