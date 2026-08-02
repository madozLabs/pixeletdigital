"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  archiveCatalogueItem,
  createCatalogueItem,
} from "@/modules/billing/application/catalogue-item-use-cases";
import {
  cancelInvoice,
  createDraftInvoice,
  markInvoiceSent,
} from "@/modules/billing/application/invoice-use-cases";
import { issueCreditNote } from "@/modules/billing/application/credit-note-use-cases";
import { PrismaCreditNoteRepository } from "@/modules/billing/infrastructure/prisma-credit-note-repository";
import {
  deleteBillingAttachment,
  uploadBillingAttachment,
} from "@/modules/billing/application/billing-attachment-use-cases";
import { recordInvoicePayment } from "@/modules/billing/application/payment-use-cases";
import {
  convertQuoteToInvoice,
  createDraftQuote,
  updateQuoteStatus,
} from "@/modules/billing/application/quote-use-cases";
import { PrismaBillingAttachmentRepository } from "@/modules/billing/infrastructure/prisma-billing-attachment-repository";
import { PrismaCatalogueItemRepository } from "@/modules/billing/infrastructure/prisma-catalogue-item-repository";
import { PrismaInvoiceRepository } from "@/modules/billing/infrastructure/prisma-invoice-repository";
import { PrismaPaymentRepository } from "@/modules/billing/infrastructure/prisma-payment-repository";
import { PrismaQuoteRepository } from "@/modules/billing/infrastructure/prisma-quote-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  recordAuditEvent,
  type RecordableAuditAction,
} from "@/modules/audit/infrastructure/record-audit-event";
import { validateWorkspaceMediaUpload } from "@/modules/content/application/workspace-site-content-policy";
import type { RequestContext } from "@/shared/request-context";

import type { ActionState } from "../_components/feedback";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  deleteWorkspaceMediaFile,
  storeWorkspaceMediaFile,
} from "../site-content/media-storage";
import { xofToCents } from "./_lib/money";

function worldDependencies() {
  return { worlds: new PrismaWorldRepository(prisma) };
}

// Every billing use case returns Result<T, { code, message, ... }>; this
// turns that already-typed error into the ActionState the forms render,
// instead of only logging it server-side and leaving the user guessing.
function toActionState(
  result: Readonly<{ ok: true } | { ok: false; error: { message: string } }>,
  successMessage: string,
): ActionState {
  if (result.ok) return { status: "success", message: successMessage };
  return { status: "error", message: result.error.message };
}

function auditInvoiceEvent(
  context: RequestContext,
  action: RecordableAuditAction,
  invoice: Readonly<{ id: string; worldKey: string }>,
): Promise<void> {
  return recordAuditEvent(prisma, {
    action,
    targetType: "INVOICE",
    targetId: invoice.id,
    actorId: context.actor?.id ?? "unknown",
    correlationId: context.correlationId,
    originChannel: context.origin.channel,
    worldKey: invoice.worldKey,
    occurredAt: context.clock.now(),
  });
}

function auditCreditNoteEvent(
  context: RequestContext,
  creditNote: Readonly<{ id: string; worldKey: string }>,
): Promise<void> {
  return recordAuditEvent(prisma, {
    action: "BILLING_CREDIT_NOTE_ISSUED",
    targetType: "CREDIT_NOTE",
    targetId: creditNote.id,
    actorId: context.actor?.id ?? "unknown",
    correlationId: context.correlationId,
    originChannel: context.origin.channel,
    worldKey: creditNote.worldKey,
    occurredAt: context.clock.now(),
  });
}

export async function createCatalogueItemAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await createCatalogueItem(
    {
      catalogueItems: new PrismaCatalogueItemRepository(prisma),
      ...worldDependencies(),
    },
    context,
    {
      id: randomUUID(),
      worldKey: String(formData.get("worldKey")),
      label: String(formData.get("label")),
      kind: String(formData.get("kind")),
      unitPriceCents: xofToCents(formData.get("unitPrice")),
    },
  );
  if (!result.ok) console.error("createCatalogueItem failed", result.error);
  revalidatePath("/workspace/billing");
  return toActionState(result, "Ajouté au catalogue.");
}

export async function archiveCatalogueItemAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await archiveCatalogueItem(
    {
      catalogueItems: new PrismaCatalogueItemRepository(prisma),
      ...worldDependencies(),
    },
    context,
    {
      id: String(formData.get("id")),
      expectedVersion: Number(formData.get("expectedVersion")),
    },
  );
  if (!result.ok) console.error("archiveCatalogueItem failed", result.error);
  revalidatePath("/workspace/billing");
  return toActionState(result, "Élément archivé.");
}

// Keep in sync with QUOTE_LINE_SLOTS in ./billing-forms.tsx.
const QUOTE_LINE_SLOTS = 12;

function quoteLinesFromForm(formData: FormData) {
  return Array.from({ length: QUOTE_LINE_SLOTS }, (_, i) => i + 1).flatMap(
    (index) => {
      const label = String(formData.get(`lineLabel${index}`) ?? "").trim();
      if (!label) return [];
      return [
        {
          id: randomUUID(),
          label,
          quantity: Math.max(
            1,
            Number(formData.get(`lineQuantity${index}`)) || 1,
          ),
          unitPriceCents: xofToCents(formData.get(`lineUnitPrice${index}`)),
        },
      ];
    },
  );
}

function discountCentsFromForm(
  formData: FormData,
  lines: readonly { quantity: number; unitPriceCents: number }[],
): number {
  const discountType = String(formData.get("discountType") ?? "AMOUNT");
  if (discountType === "PERCENT") {
    const percent = Number(formData.get("discount"));
    if (!Number.isFinite(percent) || percent <= 0) return 0;
    const subtotalCents = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPriceCents,
      0,
    );
    return Math.round((subtotalCents * Math.min(100, percent)) / 100);
  }
  return xofToCents(formData.get("discount"));
}

export async function createQuoteAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const validUntil = String(formData.get("validUntil") ?? "").trim();
  const taxRate = Number(formData.get("taxRate"));
  const lines = quoteLinesFromForm(formData);
  const result = await createDraftQuote(
    { quotes: new PrismaQuoteRepository(prisma), ...worldDependencies() },
    context,
    {
      id: randomUUID(),
      worldKey: String(formData.get("worldKey")),
      clientId: String(formData.get("clientId")),
      lines,
      discountCents: discountCentsFromForm(formData, lines),
      taxRateBps: Number.isFinite(taxRate)
        ? Math.max(0, Math.round(taxRate * 100))
        : 0,
      notes: String(formData.get("notes") ?? "").trim() || null,
      issuedAt: context.clock.now(),
      validUntil: validUntil ? new Date(validUntil) : null,
    },
  );
  if (!result.ok) console.error("createDraftQuote failed", result.error);
  revalidatePath("/workspace/billing");
  return toActionState(result, "Devis créé.");
}

// Keep in sync with INVOICE_LINE_SLOTS in ./billing-forms.tsx.
const INVOICE_LINE_SLOTS = 12;

function invoiceLinesFromForm(formData: FormData) {
  return Array.from({ length: INVOICE_LINE_SLOTS }, (_, i) => i + 1).flatMap(
    (index) => {
      const label = String(formData.get(`lineLabel${index}`) ?? "").trim();
      if (!label) return [];
      return [
        {
          id: randomUUID(),
          label,
          quantity: Math.max(
            1,
            Number(formData.get(`lineQuantity${index}`)) || 1,
          ),
          unitPriceCents: xofToCents(formData.get(`lineUnitPrice${index}`)),
        },
      ];
    },
  );
}

export async function createInvoiceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const dueAt = String(formData.get("dueAt") ?? "").trim();
  const taxRate = Number(formData.get("taxRate"));
  const result = await createDraftInvoice(
    { invoices: new PrismaInvoiceRepository(prisma), ...worldDependencies() },
    context,
    {
      id: randomUUID(),
      worldKey: String(formData.get("worldKey")),
      clientId: String(formData.get("clientId")),
      lines: invoiceLinesFromForm(formData),
      discountCents: xofToCents(formData.get("discount")),
      taxRateBps: Number.isFinite(taxRate)
        ? Math.max(0, Math.round(taxRate * 100))
        : 0,
      notes: String(formData.get("notes") ?? "").trim() || null,
      issuedAt: context.clock.now(),
      dueAt: dueAt ? new Date(dueAt) : null,
    },
  );
  if (!result.ok) console.error("createDraftInvoice failed", result.error);
  revalidatePath("/workspace/billing");
  return toActionState(result, "Facture créée.");
}

export async function updateQuoteStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await updateQuoteStatus(
    { quotes: new PrismaQuoteRepository(prisma), ...worldDependencies() },
    context,
    {
      id: String(formData.get("quoteId")),
      expectedVersion: Number(formData.get("expectedVersion")),
      status: String(formData.get("status")),
    },
  );
  if (!result.ok) console.error("updateQuoteStatus failed", result.error);
  revalidatePath("/workspace/billing");
  return toActionState(result, "Statut du devis mis à jour.");
}

export async function convertQuoteToInvoiceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await convertQuoteToInvoice(
    {
      quotes: new PrismaQuoteRepository(prisma),
      invoices: new PrismaInvoiceRepository(prisma),
      ...worldDependencies(),
    },
    context,
    {
      id: String(formData.get("quoteId")),
      expectedVersion: Number(formData.get("expectedVersion")),
      invoiceId: randomUUID(),
    },
  );
  if (!result.ok) {
    console.error("convertQuoteToInvoice failed", result.error);
  } else {
    await auditInvoiceEvent(context, "BILLING_INVOICE_ISSUED", result.value);
  }
  revalidatePath("/workspace/billing");
  return toActionState(result, "Devis converti en facture.");
}

export async function markInvoiceSentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await markInvoiceSent(
    { invoices: new PrismaInvoiceRepository(prisma), ...worldDependencies() },
    context,
    {
      id: String(formData.get("id")),
      expectedVersion: Number(formData.get("expectedVersion")),
    },
  );
  if (!result.ok) console.error("markInvoiceSent failed", result.error);
  revalidatePath("/workspace/billing");
  return toActionState(result, "Facture envoyée.");
}

export async function cancelInvoiceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await cancelInvoice(
    { invoices: new PrismaInvoiceRepository(prisma), ...worldDependencies() },
    context,
    {
      id: String(formData.get("id")),
      expectedVersion: Number(formData.get("expectedVersion")),
    },
  );
  if (!result.ok) {
    console.error("cancelInvoice failed", result.error);
  } else {
    await auditInvoiceEvent(context, "BILLING_INVOICE_CANCELLED", result.value);
  }
  revalidatePath("/workspace/billing");
  return toActionState(result, "Facture annulée.");
}

// Keep in sync with CREDIT_NOTE_LINE_SLOTS in ./billing-forms.tsx.
const CREDIT_NOTE_LINE_SLOTS = 6;

function creditNoteLinesFromForm(formData: FormData) {
  return Array.from(
    { length: CREDIT_NOTE_LINE_SLOTS },
    (_, i) => i + 1,
  ).flatMap((index) => {
    const label = String(formData.get(`lineLabel${index}`) ?? "").trim();
    if (!label) return [];
    return [
      {
        id: randomUUID(),
        label,
        quantity: Math.max(
          1,
          Number(formData.get(`lineQuantity${index}`)) || 1,
        ),
        unitPriceCents: xofToCents(formData.get(`lineUnitPrice${index}`)),
      },
    ];
  });
}

export async function issueCreditNoteAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await issueCreditNote(
    {
      invoices: new PrismaInvoiceRepository(prisma),
      creditNotes: new PrismaCreditNoteRepository(prisma),
    },
    context,
    {
      invoiceId: String(formData.get("invoiceId")),
      expectedVersion: Number(formData.get("expectedVersion")),
      lines: creditNoteLinesFromForm(formData),
      reason: String(formData.get("reason") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  );
  if (!result.ok) {
    console.error("issueCreditNote failed", result.error);
  } else {
    await auditCreditNoteEvent(context, result.value);
  }
  revalidatePath("/workspace/billing");
  revalidatePath("/workspace");
  return toActionState(result, "Avoir émis.");
}

export async function recordPaymentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const amountCents = xofToCents(formData.get("amount"));
  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();
  const result = await recordInvoicePayment(
    {
      invoices: new PrismaInvoiceRepository(prisma),
      payments: new PrismaPaymentRepository(prisma),
    },
    context,
    {
      invoiceId: String(formData.get("invoiceId")),
      expectedVersion: Number(formData.get("expectedVersion")),
      amountCents,
      method: String(formData.get("method")),
      reference: String(formData.get("reference") ?? "").trim() || null,
      paidAt: paidAtRaw ? new Date(paidAtRaw) : null,
    },
  );
  if (!result.ok) {
    console.error("recordInvoicePayment failed", result.error);
  } else {
    const invoice = await prisma.invoice.findUnique({
      where: { id: result.value.invoiceId },
      select: { worldKey: true },
    });
    if (invoice) {
      await auditInvoiceEvent(context, "BILLING_PAYMENT_RECORDED", {
        id: result.value.invoiceId,
        worldKey: invoice.worldKey,
      });
    }
  }
  revalidatePath("/workspace/billing");
  revalidatePath("/workspace");
  return toActionState(result, "Paiement enregistré.");
}

function attachmentDependencies() {
  return {
    attachments: new PrismaBillingAttachmentRepository(prisma),
    quotes: new PrismaQuoteRepository(prisma),
    invoices: new PrismaInvoiceRepository(prisma),
  };
}

export async function uploadAttachmentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const targetType = String(formData.get("targetType"));
  const targetId = String(formData.get("targetId"));
  const worldKey = String(formData.get("worldKey"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Un fichier est requis." };
  }
  const uploadError = validateWorkspaceMediaUpload({
    size: file.size,
    mimeType: file.type,
  });
  if (uploadError) {
    return {
      status: "error",
      message:
        uploadError === "FILE_TOO_LARGE"
          ? "Le fichier dépasse la taille maximale autorisée (15 Mo)."
          : "Ce type de fichier n'est pas autorisé.",
    };
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const objectPath = `${worldKey}/billing-attachments/${randomUUID()}-${safeName}`;
  const storage = await storeWorkspaceMediaFile(file, objectPath);

  const result = await uploadBillingAttachment(
    attachmentDependencies(),
    context,
    {
      id: randomUUID(),
      targetType,
      targetId,
      fileName: file.name,
      bucket: storage.bucket,
      objectPath,
      publicUrl: storage.publicUrl,
      mimeType: file.type,
      sizeBytes: file.size,
    },
  );
  if (!result.ok) {
    console.error("uploadBillingAttachment failed", result.error);
    // The DB record was rejected (unknown target, forbidden, etc.) but the
    // file is already durably stored -- clean it up so it doesn't leak.
    await deleteWorkspaceMediaFile(objectPath).catch(() => {});
  }
  revalidatePath("/workspace/billing");
  return toActionState(result, "Pièce jointe ajoutée.");
}

export async function deleteAttachmentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const id = String(formData.get("id"));
  const result = await deleteBillingAttachment(
    attachmentDependencies(),
    context,
    { id },
  );
  if (!result.ok) {
    console.error("deleteBillingAttachment failed", result.error);
  } else if (result.value.bucket === "local-development") {
    // Storage cleanup is best-effort and runs after the DB row is already
    // gone: the DB record is the source of truth for "does this attachment
    // exist", an orphaned file left behind here is a harmless, recoverable
    // leak rather than a correctness problem.
    await deleteWorkspaceMediaFile(result.value.objectPath).catch(() => {});
  } else {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      await fetch(
        `${supabaseUrl}/storage/v1/object/${result.value.bucket}/${result.value.objectPath}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        },
      ).catch(() => {});
    }
  }
  revalidatePath("/workspace/billing");
  return toActionState(result, "Pièce jointe supprimée.");
}
