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
import { recordInvoicePayment } from "@/modules/billing/application/payment-use-cases";
import {
  convertQuoteToInvoice,
  createDraftQuote,
  updateQuoteStatus,
} from "@/modules/billing/application/quote-use-cases";
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
import type { RequestContext } from "@/shared/request-context";

import type { ActionState } from "../_components/feedback";
import { getWorkspaceRequestContext } from "../get-workspace-context";

function worldDependencies() {
  return { worlds: new PrismaWorldRepository(prisma) };
}

function xofToCents(value: FormDataEntryValue | null): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
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

export async function createQuoteAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const validUntil = String(formData.get("validUntil") ?? "").trim();
  const taxRate = Number(formData.get("taxRate"));
  const result = await createDraftQuote(
    { quotes: new PrismaQuoteRepository(prisma), ...worldDependencies() },
    context,
    {
      id: randomUUID(),
      worldKey: String(formData.get("worldKey")),
      clientId: String(formData.get("clientId")),
      lines: quoteLinesFromForm(formData),
      discountCents: xofToCents(formData.get("discount")),
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
