import { notFound as notFoundResponse, redirect } from "next/navigation";
import Image from "next/image";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getInvoiceById } from "@/modules/billing/application/invoice-use-cases";
import { PrismaClientRepository } from "@/modules/billing/infrastructure/prisma-client-repository";
import { PrismaInvoiceRepository } from "@/modules/billing/infrastructure/prisma-invoice-repository";
import { PrismaPaymentRepository } from "@/modules/billing/infrastructure/prisma-payment-repository";
import { PrismaCreditNoteRepository } from "@/modules/billing/infrastructure/prisma-credit-note-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { parseWorldKey } from "@/modules/worlds/domain/world";

import { getWorkspaceRequestContext } from "../../../../get-workspace-context";
import { PrintButton } from "../../../_components/print-button";
import { formatXof } from "../../../_lib/money";
import { formatDate } from "@/shared/format";
import { getStatusLabel } from "../../../../_components/status-badge";
import { getPublishedSiteIdentity } from "@/app/_lib/site-identity";

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
  const worldKeyResult = parseWorldKey(invoice.worldKey);
  const world = worldKeyResult.ok
    ? await deps.worlds.findByKey(worldKeyResult.value)
    : null;
  const identity = await getPublishedSiteIdentity(
    invoice.worldKey,
    world?.displayName ?? invoice.worldKey,
  );
  const paidCents = await new PrismaPaymentRepository(
    prisma,
  ).totalPaidForInvoice(invoice.id);
  const creditedCents = await new PrismaCreditNoteRepository(
    prisma,
  ).totalCreditedForInvoice(invoice.id);
  const balanceCents = Math.max(
    0,
    invoice.totalCents - paidCents - creditedCents,
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
          <p className="invoice-print__meta">Facture {invoice.number}</p>
          <p className="invoice-print__meta">
            Émise le {formatDate(invoice.issuedAt)}
          </p>
          <p className="invoice-print__meta">
            Statut : {getStatusLabel("invoice", invoice.status)}
          </p>
          {invoice.dueAt ? (
            <p className="invoice-print__meta">
              Échéance : {formatDate(invoice.dueAt)}
            </p>
          ) : null}
        </div>
        <div className="invoice-print__header-right">
          {identity.invoiceStampUrl ? (
            <Image
              className="invoice-print__stamp"
              src={identity.invoiceStampUrl}
              alt=""
              width={110}
              height={110}
            />
          ) : null}
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
          {creditedCents > 0 ? (
            <tr>
              <td colSpan={3}>Avoir</td>
              <td>-{formatXof(creditedCents)}</td>
            </tr>
          ) : null}
          <tr>
            <td colSpan={3}>Payé</td>
            <td>{formatXof(paidCents)}</td>
          </tr>
          <tr className="invoice-print__balance-row">
            <td colSpan={3}>Solde restant dû</td>
            <td>{formatXof(balanceCents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
