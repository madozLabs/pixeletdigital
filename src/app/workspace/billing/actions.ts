"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  archiveCatalogueItem,
  createCatalogueItem,
} from "@/modules/billing/application/catalogue-item-use-cases";
import {
  cancelInvoice,
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

import { getWorkspaceRequestContext } from "../get-workspace-context";

function worldDependencies() {
  return { worlds: new PrismaWorldRepository(prisma) };
}

function xofToCents(value: FormDataEntryValue | null): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

export async function createCatalogueItemAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

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
}

export async function archiveCatalogueItemAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

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
}

function quoteLinesFromForm(formData: FormData) {
  return [1, 2, 3].flatMap((index) => {
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

export async function createQuoteAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

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
}

export async function updateQuoteStatusAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

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
}

export async function convertQuoteToInvoiceAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

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
  if (!result.ok) console.error("convertQuoteToInvoice failed", result.error);
  revalidatePath("/workspace/billing");
}

export async function markInvoiceSentAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

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
}

export async function cancelInvoiceAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await cancelInvoice(
    { invoices: new PrismaInvoiceRepository(prisma), ...worldDependencies() },
    context,
    {
      id: String(formData.get("id")),
      expectedVersion: Number(formData.get("expectedVersion")),
    },
  );
  if (!result.ok) console.error("cancelInvoice failed", result.error);
  revalidatePath("/workspace/billing");
}

export async function recordPaymentAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const amountCents = xofToCents(formData.get("amount"));
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
    },
  );
  if (!result.ok) console.error("recordInvoicePayment failed", result.error);
  revalidatePath("/workspace/billing");
  revalidatePath("/workspace");
}
