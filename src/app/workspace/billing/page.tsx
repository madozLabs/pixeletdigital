import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listCatalogueItemsByWorld } from "@/modules/billing/application/catalogue-item-use-cases";
import { listClientsByWorld } from "@/modules/billing/application/client-use-cases";
import { listInvoicesByWorld } from "@/modules/billing/application/invoice-use-cases";
import { PrismaCatalogueItemRepository } from "@/modules/billing/infrastructure/prisma-catalogue-item-repository";
import { PrismaClientRepository } from "@/modules/billing/infrastructure/prisma-client-repository";
import { PrismaInvoiceRepository } from "@/modules/billing/infrastructure/prisma-invoice-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import type { ApprovedRole } from "@/shared/request-context";

import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  archiveCatalogueItemAction,
  archiveClientAction,
  cancelInvoiceAction,
  createCatalogueItemAction,
  createClientAction,
  createInvoiceAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
} from "./actions";
import { formatEuros } from "./_lib/money";
import { ROLES_MATRIX_COLUMNS, ROLES_MATRIX_ROWS } from "./_lib/roles-matrix";

const WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
];

const BILLING_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
];

const TABS = [
  { id: "clients", label: "Clients" },
  { id: "catalogue", label: "Services & produits" },
  { id: "invoices", label: "Factures" },
  { id: "roles", label: "Rôles & permissions" },
] as const;

export default async function WorkspaceBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string; tab?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const role = context.actor?.role ?? null;
  if (role === null || !BILLING_ROLES.includes(role)) {
    return (
      <>
        <h1 className="admin-content__title">Facturation</h1>
        <p role="alert">Vous n&apos;êtes pas autorisé à consulter ce module.</p>
      </>
    );
  }

  const { world, tab } = await searchParams;
  const worldKey = world ?? WORLDS[0]!.key;
  const activeTab = TABS.find((t) => t.id === tab)?.id ?? TABS[0].id;

  const deps = {
    clients: new PrismaClientRepository(prisma),
    catalogueItems: new PrismaCatalogueItemRepository(prisma),
    invoices: new PrismaInvoiceRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };

  const [clientsResult, catalogueResult, invoicesResult] = await Promise.all([
    listClientsByWorld(deps, context, { worldKey }),
    listCatalogueItemsByWorld(deps, context, { worldKey }),
    listInvoicesByWorld(deps, context, { worldKey }),
  ]);

  if (!clientsResult.ok || !catalogueResult.ok || !invoicesResult.ok) {
    const error = !clientsResult.ok
      ? clientsResult.error
      : !catalogueResult.ok
        ? catalogueResult.error
        : !invoicesResult.ok
          ? invoicesResult.error
          : null;
    return (
      <>
        <h1 className="admin-content__title">Facturation</h1>
        <p role="alert">{error?.message}</p>
      </>
    );
  }

  const clients = clientsResult.value;
  const catalogueItems = catalogueResult.value;
  const invoices = invoicesResult.value;
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <>
      <h1 className="admin-content__title">Facturation</h1>

      <div className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/workspace/billing?world=${worldKey}&tab=${t.id}`}
            role="tab"
            aria-selected={t.id === activeTab}
            className={
              t.id === activeTab
                ? "admin-tabs__item admin-tabs__item--active"
                : "admin-tabs__item"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "clients" ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      Aucun client pour cet univers.
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.email ?? "—"}</td>
                      <td>{c.phone ?? "—"}</td>
                      <td>{c.status === "ACTIVE" ? "Actif" : "Archivé"}</td>
                      <td className="admin-table__actions">
                        {c.status === "ACTIVE" ? (
                          <form action={archiveClientAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <input
                              type="hidden"
                              name="expectedVersion"
                              value={c.version}
                            />
                            <button
                              type="submit"
                              className="admin-table__action"
                            >
                              Archiver
                            </button>
                          </form>
                        ) : (
                          <span className="admin-table__note">
                            Aucune action
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 className="admin-content__subtitle">Ajouter un client</h2>
          <form action={createClientAction} className="editorial-form">
            <input type="hidden" name="worldKey" value={worldKey} />
            <label>
              Nom
              <input type="text" name="name" required maxLength={160} />
            </label>
            <label>
              Email
              <input type="email" name="email" maxLength={254} />
            </label>
            <label>
              Téléphone
              <input type="text" name="phone" maxLength={40} />
            </label>
            <label>
              Adresse
              <input type="text" name="address" maxLength={240} />
            </label>
            <button type="submit" className="admin-table__action">
              Ajouter le client
            </button>
          </form>
        </>
      ) : null}

      {activeTab === "catalogue" ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th>Type</th>
                  <th>Prix unitaire</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalogueItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      Aucun service ou produit pour cet univers.
                    </td>
                  </tr>
                ) : (
                  catalogueItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{item.kind === "SERVICE" ? "Service" : "Produit"}</td>
                      <td>{formatEuros(item.unitPriceCents)}</td>
                      <td>{item.status === "ACTIVE" ? "Actif" : "Archivé"}</td>
                      <td className="admin-table__actions">
                        {item.status === "ACTIVE" ? (
                          <form action={archiveCatalogueItemAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input
                              type="hidden"
                              name="expectedVersion"
                              value={item.version}
                            />
                            <button
                              type="submit"
                              className="admin-table__action"
                            >
                              Archiver
                            </button>
                          </form>
                        ) : (
                          <span className="admin-table__note">
                            Aucune action
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 className="admin-content__subtitle">
            Ajouter un service ou produit
          </h2>
          <form action={createCatalogueItemAction} className="editorial-form">
            <input type="hidden" name="worldKey" value={worldKey} />
            <label>
              Libellé
              <input type="text" name="label" required maxLength={160} />
            </label>
            <label>
              Type
              <select name="kind" defaultValue="SERVICE">
                <option value="SERVICE">Service</option>
                <option value="PRODUCT">Produit</option>
              </select>
            </label>
            <label>
              Prix unitaire (€)
              <input
                type="number"
                name="unitPrice"
                required
                min={0}
                step="0.01"
              />
            </label>
            <button type="submit" className="admin-table__action">
              Ajouter au catalogue
            </button>
          </form>
        </>
      ) : null}

      {activeTab === "invoices" ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      Aucune facture pour cet univers.
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.number}</td>
                      <td>{clientNameById.get(invoice.clientId) ?? "—"}</td>
                      <td>{INVOICE_STATUS_LABEL[invoice.status]}</td>
                      <td>{formatEuros(invoice.totalCents)}</td>
                      <td className="admin-table__actions">
                        <Link
                          href={`/workspace/billing/invoices/${invoice.id}/print`}
                          className="admin-table__action"
                        >
                          Imprimer
                        </Link>
                        {invoice.status === "DRAFT" ? (
                          <>
                            <form action={markInvoiceSentAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={invoice.id}
                              />
                              <input
                                type="hidden"
                                name="expectedVersion"
                                value={invoice.version}
                              />
                              <button
                                type="submit"
                                className="admin-table__action"
                              >
                                Envoyer
                              </button>
                            </form>
                            <form action={cancelInvoiceAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={invoice.id}
                              />
                              <input
                                type="hidden"
                                name="expectedVersion"
                                value={invoice.version}
                              />
                              <button
                                type="submit"
                                className="admin-table__action"
                              >
                                Annuler
                              </button>
                            </form>
                          </>
                        ) : null}
                        {invoice.status === "SENT" ? (
                          <>
                            <form action={markInvoicePaidAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={invoice.id}
                              />
                              <input
                                type="hidden"
                                name="expectedVersion"
                                value={invoice.version}
                              />
                              <button
                                type="submit"
                                className="admin-table__action"
                              >
                                Marquer payée
                              </button>
                            </form>
                            <form action={cancelInvoiceAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={invoice.id}
                              />
                              <input
                                type="hidden"
                                name="expectedVersion"
                                value={invoice.version}
                              />
                              <button
                                type="submit"
                                className="admin-table__action"
                              >
                                Annuler
                              </button>
                            </form>
                          </>
                        ) : null}
                        {invoice.status === "PAID" ||
                        invoice.status === "CANCELLED" ? (
                          <span className="admin-table__note">
                            Aucune action
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 className="admin-content__subtitle">Nouvelle facture</h2>
          {clients.filter((c) => c.status === "ACTIVE").length === 0 ? (
            <p className="admin-empty">
              Ajoutez un client actif avant de créer une facture.
            </p>
          ) : (
            <form action={createInvoiceAction} className="editorial-form">
              <input type="hidden" name="worldKey" value={worldKey} />
              <label>
                Client
                <select name="clientId" required>
                  {clients
                    .filter((c) => c.status === "ACTIVE")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              {[1, 2, 3].map((index) => (
                <label key={index}>
                  Ligne {index}
                  <input
                    type="text"
                    name={`lineLabel${index}`}
                    placeholder="Libellé"
                    maxLength={160}
                    list="billing-catalogue-labels"
                  />
                  <input
                    type="number"
                    name={`lineQuantity${index}`}
                    placeholder="Quantité"
                    min={1}
                    defaultValue={1}
                  />
                  <input
                    type="number"
                    name={`lineUnitPrice${index}`}
                    placeholder="Prix unitaire (€)"
                    min={0}
                    step="0.01"
                  />
                </label>
              ))}
              <datalist id="billing-catalogue-labels">
                {catalogueItems.map((item) => (
                  <option key={item.id} value={item.label} />
                ))}
              </datalist>
              <button type="submit" className="admin-table__action">
                Créer la facture
              </button>
            </form>
          )}
        </>
      ) : null}

      {activeTab === "roles" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Domaine</th>
                {ROLES_MATRIX_COLUMNS.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES_MATRIX_ROWS.map((row) => (
                <tr key={row.domain}>
                  <td>{row.domain}</td>
                  {row.values.map((value, index) => (
                    <td key={ROLES_MATRIX_COLUMNS[index]}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

const INVOICE_STATUS_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  SENT: "Envoyée",
  PAID: "Payée",
  CANCELLED: "Annulée",
};
