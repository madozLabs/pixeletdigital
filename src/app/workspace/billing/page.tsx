import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { formatXof } from "./_lib/money";
import {
  convertQuoteToInvoiceAction,
  createQuoteAction,
  recordPaymentAction,
  updateQuoteStatusAction,
} from "./professional-actions";
import { cancelInvoiceAction, markInvoiceSentAction } from "./actions";

const BILLING_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"] as const;
const TABS = [
  { id: "quotes", label: "Devis" },
  { id: "invoices", label: "Factures" },
  { id: "balances", label: "Soldes clients" },
  { id: "catalogue", label: "Catalogue" },
] as const;
export default async function WorkspaceBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string; tab?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (
    !context.actor?.role ||
    !BILLING_ROLES.includes(
      context.actor.role as (typeof BILLING_ROLES)[number],
    )
  ) {
    return (
      <p role="alert">
        Vous n&apos;êtes pas autorisé à consulter la facturation.
      </p>
    );
  }

  const { world, tab } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const activeTab = TABS.find((item) => item.id === tab)?.id ?? "quotes";
  const [clients, quotes, invoices, catalogue] = await Promise.all([
    prisma.client.findMany({
      where: { worldKey, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.quote.findMany({
      where: { worldKey },
      include: { client: true, lines: true, invoice: true },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { worldKey },
      include: { client: true, lines: true, payments: true },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.catalogueItem.findMany({
      where: { worldKey, status: "ACTIVE" },
      orderBy: { label: "asc" },
    }),
  ]);

  const clientBalances = clients.map((client) => {
    const clientInvoices = invoices.filter(
      (invoice) =>
        invoice.clientId === client.id && invoice.status !== "CANCELLED",
    );
    const billed = clientInvoices.reduce(
      (sum, invoice) => sum + invoiceTotal(invoice),
      0,
    );
    const paid = clientInvoices.reduce(
      (sum, invoice) =>
        sum +
        invoice.payments.reduce(
          (inner, payment) => inner + payment.amountCents,
          0,
        ),
      0,
    );
    return { client, billed, paid, balance: Math.max(0, billed - paid) };
  });
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Facturation XOF</h1>
          <p className="admin-content__lede">
            Devis, factures, paiements et soldes clients.
          </p>
        </div>
        <span className="admin-metric">
          {formatXof(
            clientBalances.reduce((sum, item) => sum + item.balance, 0),
          )}{" "}
          à encaisser
        </span>
      </div>

      <div className="admin-tabs" role="tablist">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/workspace/billing?world=${worldKey}&tab=${item.id}`}
            role="tab"
            aria-selected={item.id === activeTab}
            className={
              item.id === activeTab
                ? "admin-tabs__item admin-tabs__item--active"
                : "admin-tabs__item"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>

      {activeTab === "quotes" ? (
        <>
          <section className="billing-card-grid">
            {quotes.length === 0 ? (
              <p className="admin-empty">Aucun devis.</p>
            ) : null}
            {quotes.map((quote) => {
              const total = documentTotal(quote);
              return (
                <article className="billing-card" key={quote.id}>
                  <header>
                    <div>
                      <p className="billing-card__eyebrow">{quote.number}</p>
                      <h2>{quote.client.name}</h2>
                    </div>
                    <span className="status-badge">
                      {QUOTE_STATUS_LABEL[quote.status]}
                    </span>
                  </header>
                  <p>
                    {quote.lines.length} ligne(s) · {formatXof(total)}
                  </p>
                  <p className="admin-table__note">
                    Valide jusqu’au{" "}
                    {quote.validUntil?.toLocaleDateString("fr-FR") ?? "—"}
                  </p>
                  <form
                    action={updateQuoteStatusAction}
                    className="billing-inline-form"
                  >
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <select name="status" defaultValue={quote.status}>
                      {Object.entries(QUOTE_STATUS_LABEL)
                        .filter(([key]) => key !== "CONVERTED")
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                    </select>
                    <button className="admin-table__action" type="submit">
                      Mettre à jour
                    </button>
                  </form>
                  {quote.status === "ACCEPTED" && !quote.invoice ? (
                    <form action={convertQuoteToInvoiceAction}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <button className="admin-table__action" type="submit">
                        Convertir en facture
                      </button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </section>
          <h2 className="admin-content__subtitle">Nouveau devis</h2>
          <form action={createQuoteAction} className="editorial-form">
            <input type="hidden" name="worldKey" value={worldKey} />
            <label>
              Client
              <select name="clientId" required>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valide jusqu’au
              <input type="date" name="validUntil" />
            </label>
            <label>
              Remise (XOF)
              <input type="number" name="discount" min={0} step={1} />
            </label>
            <label>
              Taxe (%)
              <input
                type="number"
                name="taxRate"
                min={0}
                max={100}
                step="0.01"
              />
            </label>
            {[1, 2, 3].map((index) => (
              <label key={index}>
                Ligne {index}
                <input
                  name={`lineLabel${index}`}
                  placeholder="Libellé"
                  list="billing-catalogue-labels"
                />
                <input
                  name={`lineQuantity${index}`}
                  type="number"
                  min={1}
                  defaultValue={1}
                  placeholder="Quantité"
                />
                <input
                  name={`lineUnitPrice${index}`}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Prix unitaire XOF"
                />
              </label>
            ))}
            <label>
              Notes
              <textarea name="notes" maxLength={1000} />
            </label>
            <button className="admin-table__action" type="submit">
              Créer le devis
            </button>
          </form>
          <datalist id="billing-catalogue-labels">
            {catalogue.map((item) => (
              <option key={item.id} value={item.label} />
            ))}
          </datalist>
        </>
      ) : null}

      {activeTab === "invoices" ? (
        <section className="billing-card-grid">
          {invoices.length === 0 ? (
            <p className="admin-empty">Aucune facture.</p>
          ) : null}
          {invoices.map((invoice) => {
            const total = invoiceTotal(invoice);
            const paid = invoice.payments.reduce(
              (sum, payment) => sum + payment.amountCents,
              0,
            );
            const balance = Math.max(0, total - paid);
            return (
              <article className="billing-card" key={invoice.id}>
                <header>
                  <div>
                    <p className="billing-card__eyebrow">{invoice.number}</p>
                    <h2>{invoice.client.name}</h2>
                  </div>
                  <span className="status-badge">
                    {INVOICE_STATUS_LABEL[invoice.status]}
                  </span>
                </header>
                <p>
                  Total {formatXof(total)} · Payé {formatXof(paid)} · Solde{" "}
                  {formatXof(balance)}
                </p>
                <p className="admin-table__note">
                  Échéance : {invoice.dueAt?.toLocaleDateString("fr-FR") ?? "—"}
                </p>
                <div className="admin-table__actions">
                  <Link
                    className="admin-table__action"
                    href={`/workspace/billing/invoices/${invoice.id}/print`}
                  >
                    Imprimer
                  </Link>
                  {invoice.status === "DRAFT" ? (
                    <form action={markInvoiceSentAction}>
                      <input type="hidden" name="id" value={invoice.id} />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={invoice.version}
                      />
                      <button className="admin-table__action" type="submit">
                        Envoyer
                      </button>
                    </form>
                  ) : null}
                  {invoice.status !== "PAID" &&
                  invoice.status !== "CANCELLED" ? (
                    <form action={cancelInvoiceAction}>
                      <input type="hidden" name="id" value={invoice.id} />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={invoice.version}
                      />
                      <button className="admin-table__action" type="submit">
                        Annuler
                      </button>
                    </form>
                  ) : null}
                </div>
                {invoice.status !== "PAID" && invoice.status !== "CANCELLED" ? (
                  <form
                    action={recordPaymentAction}
                    className="billing-inline-form"
                  >
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <input
                      name="amount"
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Montant XOF"
                      required
                    />
                    <select name="method" defaultValue="MOBILE_MONEY">
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="BANK_TRANSFER">Virement</option>
                      <option value="CASH">Espèces</option>
                      <option value="CARD">Carte</option>
                      <option value="CHEQUE">Chèque</option>
                      <option value="OTHER">Autre</option>
                    </select>
                    <input name="reference" placeholder="Référence" />
                    <button className="admin-table__action" type="submit">
                      Enregistrer paiement
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
      {activeTab === "balances" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Facturé</th>
                <th>Payé</th>
                <th>Solde</th>
              </tr>
            </thead>
            <tbody>
              {clientBalances.map((item) => (
                <tr key={item.client.id}>
                  <td>{item.client.name}</td>
                  <td>{formatXof(item.billed)}</td>
                  <td>{formatXof(item.paid)}</td>
                  <td>{formatXof(item.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === "catalogue" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Type</th>
                <th>Prix XOF</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.map((item) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>{item.kind === "SERVICE" ? "Service" : "Produit"}</td>
                  <td>{formatXof(item.unitPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function documentTotal(document: {
  lines: { quantity: number; unitPriceCents: number }[];
  discountCents: number;
  taxRateBps: number;
}): number {
  const subtotal = document.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents,
    0,
  );
  const taxable = Math.max(0, subtotal - document.discountCents);
  return taxable + Math.round((taxable * document.taxRateBps) / 10000);
}

function invoiceTotal(invoice: {
  lines: { quantity: number; unitPriceCents: number }[];
  discountCents: number;
  taxRateBps: number;
}): number {
  return documentTotal(invoice);
}

const QUOTE_STATUS_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  DECLINED: "Refusé",
  EXPIRED: "Expiré",
  CONVERTED: "Converti",
  CANCELLED: "Annulé",
};
const INVOICE_STATUS_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  SENT: "Envoyée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};
