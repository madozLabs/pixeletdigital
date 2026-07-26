"use client";

import { useActionState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import { getStatusLabel } from "../_components/status-badge";
import {
  archiveCatalogueItemAction,
  cancelInvoiceAction,
  convertQuoteToInvoiceAction,
  createCatalogueItemAction,
  createQuoteAction,
  markInvoiceSentAction,
  recordPaymentAction,
  updateQuoteStatusAction,
} from "./actions";

type Option = Readonly<{ id: string; label: string }>;

const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;

export function CreateQuoteForm({
  worldKey,
  clients,
  catalogueDatalistId,
}: Readonly<{
  worldKey: string;
  clients: Option[];
  catalogueDatalistId: string;
}>) {
  const [state, action] = useActionState(createQuoteAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="editorial-form">
      <input type="hidden" name="worldKey" value={worldKey} />
      <label>
        Client
        <select name="clientId" required>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.label}
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
        <input type="number" name="taxRate" min={0} max={100} step="0.01" />
      </label>
      {[1, 2, 3].map((index) => (
        <div className="billing-line-row" key={index}>
          <span className="billing-line-row__eyebrow">Ligne {index}</span>
          <label>
            Libellé
            <input
              name={`lineLabel${index}`}
              placeholder="Ex. Création de logo"
              list={catalogueDatalistId}
            />
          </label>
          <label>
            Quantité
            <input
              name={`lineQuantity${index}`}
              type="number"
              min={1}
              defaultValue={1}
            />
          </label>
          <label>
            Prix unitaire (XOF)
            <input
              name={`lineUnitPrice${index}`}
              type="number"
              min={0}
              step={1}
            />
          </label>
        </div>
      ))}
      <label>
        Notes
        <textarea name="notes" maxLength={1000} />
      </label>
      <Feedback state={state} />
      <SubmitButton>Créer le devis</SubmitButton>
    </form>
  );
}

export function QuoteActionsForm({
  quoteId,
  version,
  status,
  canConvert,
}: Readonly<{
  quoteId: string;
  version: number;
  status: string;
  canConvert: boolean;
}>) {
  const [statusState, statusAction] = useActionState(
    updateQuoteStatusAction,
    IDLE_ACTION_STATE,
  );
  const [convertState, convertAction] = useActionState(
    convertQuoteToInvoiceAction,
    IDLE_ACTION_STATE,
  );
  return (
    <>
      <form action={statusAction} className="billing-inline-form">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="expectedVersion" value={version} />
        <select name="status" defaultValue={status}>
          {QUOTE_STATUSES.map((quoteStatus) => (
            <option key={quoteStatus} value={quoteStatus}>
              {getStatusLabel("quote", quoteStatus)}
            </option>
          ))}
        </select>
        <SubmitButton>Mettre à jour</SubmitButton>
        <Feedback state={statusState} />
      </form>
      {canConvert ? (
        <form action={convertAction}>
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="expectedVersion" value={version} />
          <SubmitButton>Convertir en facture</SubmitButton>
          <Feedback state={convertState} />
        </form>
      ) : null}
    </>
  );
}

export function InvoiceActionsForm({
  invoiceId,
  version,
  status,
}: Readonly<{ invoiceId: string; version: number; status: string }>) {
  const [paymentState, paymentAction] = useActionState(
    recordPaymentAction,
    IDLE_ACTION_STATE,
  );
  const [sentState, sentAction] = useActionState(
    markInvoiceSentAction,
    IDLE_ACTION_STATE,
  );
  const [cancelState, cancelAction] = useActionState(
    cancelInvoiceAction,
    IDLE_ACTION_STATE,
  );
  return (
    <>
      <form action={paymentAction} className="billing-inline-form">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="expectedVersion" value={version} />
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
        <SubmitButton>Enregistrer paiement</SubmitButton>
        <Feedback state={paymentState} />
      </form>
      <div className="admin-table__actions">
        {status === "DRAFT" ? (
          <form action={sentAction}>
            <input type="hidden" name="id" value={invoiceId} />
            <input type="hidden" name="expectedVersion" value={version} />
            <SubmitButton>Envoyer</SubmitButton>
            <Feedback state={sentState} />
          </form>
        ) : null}
        <form action={cancelAction}>
          <input type="hidden" name="id" value={invoiceId} />
          <input type="hidden" name="expectedVersion" value={version} />
          <ConfirmAction consequence="La facture sera annulée et ne pourra plus recevoir de paiement.">
            Annuler
          </ConfirmAction>
          <Feedback state={cancelState} />
        </form>
      </div>
    </>
  );
}

export function ArchiveCatalogueItemForm({
  itemId,
  version,
}: Readonly<{ itemId: string; version: number }>) {
  const [state, action] = useActionState(
    archiveCatalogueItemAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <ConfirmAction consequence="Cet élément ne sera plus disponible dans le catalogue actif.">
        Archiver
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}

export function CreateCatalogueItemForm({
  worldKey,
}: Readonly<{ worldKey: string }>) {
  const [state, action] = useActionState(
    createCatalogueItemAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action} className="editorial-form">
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
        Prix unitaire (XOF)
        <input type="number" name="unitPrice" required min={0} step={1} />
      </label>
      <Feedback state={state} />
      <SubmitButton>Ajouter au catalogue</SubmitButton>
    </form>
  );
}
