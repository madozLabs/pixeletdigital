"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import { getStatusLabel } from "../_components/status-badge";
import { formatXof } from "./_lib/money";
import {
  archiveCatalogueItemAction,
  cancelInvoiceAction,
  convertQuoteToInvoiceAction,
  createCatalogueItemAction,
  createInvoiceAction,
  createQuoteAction,
  deleteAttachmentAction,
  markInvoiceSentAction,
  recordPaymentAction,
  updateQuoteStatusAction,
  uploadAttachmentAction,
} from "./actions";

type Option = Readonly<{ id: string; label: string }>;

type AttachmentOption = Readonly<{
  id: string;
  fileName: string;
  publicUrl: string;
  sizeBytes: number;
}>;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function AttachmentRow({
  attachment,
}: Readonly<{ attachment: AttachmentOption }>) {
  const [state, action] = useActionState(
    deleteAttachmentAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action} className="billing-attachment-row">
      <input type="hidden" name="id" value={attachment.id} />
      <a href={attachment.publicUrl} target="_blank" rel="noreferrer">
        {attachment.fileName}
      </a>
      <span>{formatFileSize(attachment.sizeBytes)}</span>
      <ConfirmAction
        consequence="La pièce jointe sera définitivement supprimée."
        className="admin-table__action"
      >
        Supprimer
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}

export function AttachmentsPanel({
  targetType,
  targetId,
  worldKey,
  attachments,
}: Readonly<{
  targetType: "QUOTE" | "INVOICE";
  targetId: string;
  worldKey: string;
  attachments: readonly AttachmentOption[];
}>) {
  const [uploadState, uploadAction] = useActionState(
    uploadAttachmentAction,
    IDLE_ACTION_STATE,
  );
  return (
    <div className="billing-attachments">
      {attachments.length === 0 ? (
        <p className="admin-empty">Aucune pièce jointe.</p>
      ) : (
        attachments.map((attachment) => (
          <AttachmentRow key={attachment.id} attachment={attachment} />
        ))
      )}
      <form action={uploadAction} className="billing-attachment-upload">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="worldKey" value={worldKey} />
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
        />
        <SubmitButton>Ajouter</SubmitButton>
        <Feedback state={uploadState} />
      </form>
    </div>
  );
}

// Keep in sync with QUOTE_LINE_SLOTS in ./actions.ts (quoteLinesFromForm) --
// this is the number of line-item slots rendered, not a hard cap on a
// dynamic list, since the form is server-rendered with named fields rather
// than client-side add/remove rows.
const QUOTE_LINE_SLOTS = 12;
const QUOTE_LINE_INDEXES = Array.from(
  { length: QUOTE_LINE_SLOTS },
  (_, index) => index + 1,
);

const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;

type LiveTotal = Readonly<{
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}>;

// Indicative only -- duplicates the domain's computeTotal formula
// (subtotal - discount, then + tax on the taxable amount) for a live
// preview. The source of truth stays the server-side calculation at
// submission; this never has to match to the cent.
function computeLiveTotal(form: HTMLFormElement): LiveTotal {
  const data = new FormData(form);
  const numberField = (name: string) => Number(data.get(name)) || 0;
  let subtotalCents = 0;
  for (let index = 1; index <= QUOTE_LINE_SLOTS; index += 1) {
    const label = String(data.get(`lineLabel${index}`) ?? "").trim();
    if (!label) continue;
    const quantity = Math.max(1, numberField(`lineQuantity${index}`) || 1);
    const unitPriceCents = Math.round(numberField(`lineUnitPrice${index}`) * 100);
    subtotalCents += quantity * unitPriceCents;
  }
  const discountType = String(data.get("discountType") ?? "AMOUNT");
  const rawDiscount = numberField("discount");
  const discountCents =
    discountType === "PERCENT"
      ? Math.round((subtotalCents * Math.min(100, rawDiscount)) / 100)
      : Math.round(rawDiscount * 100);
  const taxRateBps = Math.round(numberField("taxRate") * 100);
  const taxable = Math.max(0, subtotalCents - discountCents);
  const taxCents = Math.round((taxable * taxRateBps) / 10_000);
  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: taxable + taxCents,
  };
}

type QuoteDuplicateSource = Readonly<{
  clientId: string;
  discountCents: number;
  taxRateBps: number;
  notes: string | null;
  lines: readonly Readonly<{
    label: string;
    quantity: number;
    unitPriceCents: number;
  }>[];
}>;

export function CreateQuoteForm({
  worldKey,
  clients,
  catalogueDatalistId,
  duplicateSource = null,
}: Readonly<{
  worldKey: string;
  clients: Option[];
  catalogueDatalistId: string;
  duplicateSource?: QuoteDuplicateSource | null;
}>) {
  const [state, action] = useActionState(createQuoteAction, IDLE_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const [liveTotal, setLiveTotal] = useState<LiveTotal>({
    subtotalCents: 0,
    discountCents: 0,
    taxCents: 0,
    totalCents: 0,
  });
  function recompute() {
    if (formRef.current) setLiveTotal(computeLiveTotal(formRef.current));
  }
  useEffect(() => {
    recompute();
  }, [duplicateSource]);
  return (
    <form
      ref={formRef}
      action={action}
      className="editorial-form"
      onChange={recompute}
    >
      <input type="hidden" name="worldKey" value={worldKey} />
      <label>
        Client
        <select
          name="clientId"
          required
          defaultValue={duplicateSource?.clientId}
        >
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
        Remise
        <input
          type="number"
          name="discount"
          min={0}
          step={1}
          defaultValue={
            duplicateSource ? duplicateSource.discountCents / 100 : undefined
          }
        />
      </label>
      <label>
        Type de remise
        <select name="discountType" defaultValue="AMOUNT">
          <option value="AMOUNT">Montant (XOF)</option>
          <option value="PERCENT">Pourcentage (%)</option>
        </select>
      </label>
      <label>
        Taxe (%)
        <input
          type="number"
          name="taxRate"
          min={0}
          max={100}
          step="0.01"
          defaultValue={
            duplicateSource ? duplicateSource.taxRateBps / 100 : undefined
          }
        />
      </label>
      {QUOTE_LINE_INDEXES.map((index) => {
        const sourceLine = duplicateSource?.lines[index - 1];
        return (
          <div className="billing-line-row" key={index}>
            <span className="billing-line-row__eyebrow">Ligne {index}</span>
            <label>
              Libellé
              <input
                name={`lineLabel${index}`}
                placeholder="Ex. Création de logo"
                list={catalogueDatalistId}
                defaultValue={sourceLine?.label}
              />
            </label>
            <label>
              Quantité
              <input
                name={`lineQuantity${index}`}
                type="number"
                min={1}
                defaultValue={sourceLine?.quantity ?? 1}
              />
            </label>
            <label>
              Prix unitaire (XOF)
              <input
                name={`lineUnitPrice${index}`}
                type="number"
                min={0}
                step={1}
                defaultValue={
                  sourceLine ? sourceLine.unitPriceCents / 100 : undefined
                }
              />
            </label>
          </div>
        );
      })}
      <label>
        Notes
        <textarea
          name="notes"
          maxLength={1000}
          defaultValue={duplicateSource?.notes ?? undefined}
        />
      </label>
      <dl className="billing-live-total" aria-live="polite">
        <div>
          <dt>Sous-total</dt>
          <dd>{formatXof(liveTotal.subtotalCents)}</dd>
        </div>
        <div>
          <dt>Remise</dt>
          <dd>-{formatXof(liveTotal.discountCents)}</dd>
        </div>
        <div>
          <dt>Taxe</dt>
          <dd>{formatXof(liveTotal.taxCents)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatXof(liveTotal.totalCents)}</dd>
        </div>
      </dl>
      <Feedback state={state} />
      <SubmitButton>Créer le devis</SubmitButton>
    </form>
  );
}

// Keep in sync with INVOICE_LINE_SLOTS in ./actions.ts (invoiceLinesFromForm).
const INVOICE_LINE_SLOTS = 12;
const INVOICE_LINE_INDEXES = Array.from(
  { length: INVOICE_LINE_SLOTS },
  (_, index) => index + 1,
);

export function CreateInvoiceForm({
  worldKey,
  clients,
  catalogueDatalistId,
}: Readonly<{
  worldKey: string;
  clients: Option[];
  catalogueDatalistId: string;
}>) {
  const [state, action] = useActionState(
    createInvoiceAction,
    IDLE_ACTION_STATE,
  );
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
        Échéance
        <input type="date" name="dueAt" />
      </label>
      <label>
        Remise (XOF)
        <input type="number" name="discount" min={0} step={1} />
      </label>
      <label>
        Taxe (%)
        <input type="number" name="taxRate" min={0} max={100} step="0.01" />
      </label>
      {INVOICE_LINE_INDEXES.map((index) => (
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
      <SubmitButton>Créer la facture</SubmitButton>
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
        <input
          name="paidAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          max={new Date().toISOString().slice(0, 10)}
          aria-label="Date du paiement"
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
