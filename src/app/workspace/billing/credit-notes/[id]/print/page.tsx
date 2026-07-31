import { notFound as notFoundResponse, redirect } from "next/navigation";
import Image from "next/image";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getCreditNoteById } from "@/modules/billing/application/credit-note-use-cases";
import { getInvoiceById } from "@/modules/billing/application/invoice-use-cases";
import { PrismaClientRepository } from "@/modules/billing/infrastructure/prisma-client-repository";
import { PrismaCreditNoteRepository } from "@/modules/billing/infrastructure/prisma-credit-note-repository";
import { PrismaInvoiceRepository } from "@/modules/billing/infrastructure/prisma-invoice-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { parseWorldKey } from "@/modules/worlds/domain/world";

import { getWorkspaceRequestContext } from "../../../../get-workspace-context";
import { PrintButton } from "../../../_components/print-button";
import { formatXof } from "../../../_lib/money";
import { formatDate } from "@/shared/format";
import { getPublishedSiteIdentity } from "@/app/_lib/site-identity";

export default async function CreditNotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { id } = await params;

  const creditNoteResult = await getCreditNoteById(
    { invoices: new PrismaInvoiceRepository(prisma), creditNotes: new PrismaCreditNoteRepository(prisma) },
    context,
    { id },
  );
  if (!creditNoteResult.ok) {
    if (creditNoteResult.error.code === "NOT_FOUND") notFoundResponse();
    return <p role="alert">{creditNoteResult.error.message}</p>;
  }
  const creditNote = creditNoteResult.value;

  const invoiceDeps = {
    invoices: new PrismaInvoiceRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };
  const invoiceResult = await getInvoiceById(invoiceDeps, context, {
    id: creditNote.invoiceId,
  });
  const invoice = invoiceResult.ok ? invoiceResult.value : null;
  const client = invoice
    ? await new PrismaClientRepository(prisma).findById(invoice.clientId)
    : null;
  const worldKeyResult = parseWorldKey(creditNote.worldKey);
  const world = worldKeyResult.ok
    ? await invoiceDeps.worlds.findByKey(worldKeyResult.value)
    : null;
  const identity = await getPublishedSiteIdentity(
    creditNote.worldKey,
    world?.displayName ?? creditNote.worldKey,
  );

  return (
    <div className="invoice-print">
      <PrintButton />

      <header className="invoice-print__header">
        <div>
          {identity.logoUrl ? (
            <Image
              className="invoice-print__logo"
              src={identity.logoUrl}
              alt={identity.logoAlt}
              width={200}
              height={48}
            />
          ) : null}
          <p className="invoice-print__brand">{identity.siteName}</p>
          {identity.address ? (
            <p className="invoice-print__meta">{identity.address}</p>
          ) : null}
          <p className="invoice-print__meta">Avoir {creditNote.number}</p>
          <p className="invoice-print__meta">
            Émis le {formatDate(creditNote.issuedAt)}
          </p>
          {invoice ? (
            <p className="invoice-print__meta">
              Facture d&apos;origine : {invoice.number}
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

      <p className="invoice-print__meta">Motif : {creditNote.reason}</p>

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
          {creditNote.lines.map((line) => (
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
            <td colSpan={3}>Total à déduire</td>
            <td>{formatXof(creditNote.totalCents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
