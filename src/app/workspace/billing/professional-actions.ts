"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { requireWorldAccess } from "../_lib/authorization";
import { getWorkspaceRequestContext } from "../get-workspace-context";

const BILLING_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"] as const;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function canManage(role: string | null | undefined): boolean {
  return BILLING_ROLES.includes(role as (typeof BILLING_ROLES)[number]);
}

function xofToCents(value: FormDataEntryValue | null): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}
export async function createQuoteAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canManage(context.actor.role)) return;

  const worldKey = text(formData, "worldKey");
  requireWorldAccess(context.actor, worldKey);
  const count = await prisma.quote.count({ where: { worldKey } });
  const prefix = worldKey === "kwaliti-print" ? "KP-DV" : "PD-DV";
  const now = context.clock.now();
  const number = `${prefix}-${now.getUTCFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const validUntil = text(formData, "validUntil");
  const discount = xofToCents(formData.get("discount"));
  const taxRate = Number(formData.get("taxRate"));
  const lines = [1, 2, 3].flatMap((index) => {
    const label = text(formData, `lineLabel${index}`);
    if (!label) return [];
    return [
      {
        label,
        quantity: Math.max(
          1,
          Number(formData.get(`lineQuantity${index}`)) || 1,
        ),
        unitPriceCents: xofToCents(formData.get(`lineUnitPrice${index}`)),
        order: index,
      },
    ];
  });
  if (lines.length === 0) return;
  await prisma.quote.create({
    data: {
      worldKey,
      clientId: text(formData, "clientId"),
      number,
      validUntil: validUntil ? new Date(validUntil) : null,
      discountCents: discount,
      taxRateBps: Number.isFinite(taxRate)
        ? Math.max(0, Math.round(taxRate * 100))
        : 0,
      notes: text(formData, "notes") || null,
      lines: { create: lines },
    },
  });
  revalidatePath("/workspace/billing");
}
export async function updateQuoteStatusAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canManage(context.actor.role)) return;
  const quoteId = text(formData, "quoteId");
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { worldKey: true },
  });
  if (!quote) return;
  requireWorldAccess(context.actor, quote.worldKey);

  const status = text(formData, "status") as
    "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
  await prisma.quote.update({
    where: { id: quoteId },
    data: { status, version: { increment: 1 }, updatedAt: context.clock.now() },
  });
  revalidatePath("/workspace/billing");
}

export async function convertQuoteToInvoiceAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canManage(context.actor.role)) return;
  const quoteId = text(formData, "quoteId");
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lines: true },
  });
  if (!quote || quote.status !== "ACCEPTED") return;
  requireWorldAccess(context.actor, quote.worldKey);
  const count = await prisma.invoice.count({
    where: { worldKey: quote.worldKey },
  });
  const prefix = quote.worldKey === "kwaliti-print" ? "KP-FA" : "PD-FA";
  const now = context.clock.now();
  const number = `${prefix}-${now.getUTCFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const dueAt = new Date(now);
  dueAt.setUTCDate(dueAt.getUTCDate() + 30);
  await prisma.$transaction([
    prisma.invoice.create({
      data: {
        id: randomUUID(),
        worldKey: quote.worldKey,
        clientId: quote.clientId,
        quoteId,
        number,
        status: "DRAFT",
        issuedAt: now,
        dueAt,
        discountCents: quote.discountCents,
        taxRateBps: quote.taxRateBps,
        notes: quote.notes,
        version: 1,
        createdAt: now,
        updatedAt: now,
        lines: {
          create: quote.lines.map((line) => ({
            id: randomUUID(),
            label: line.label,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            order: line.order,
          })),
        },
      },
    }),
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: "CONVERTED",
        convertedAt: now,
        version: { increment: 1 },
      },
    }),
  ]);
  revalidatePath("/workspace/billing");
}
export async function recordPaymentAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canManage(context.actor.role)) return;
  const invoiceId = text(formData, "invoiceId");
  const amountCents = xofToCents(formData.get("amount"));
  if (amountCents <= 0) return;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, payments: true },
  });
  if (!invoice || invoice.status === "CANCELLED") return;
  requireWorldAccess(context.actor, invoice.worldKey);
  const subtotal = invoice.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents,
    0,
  );
  const taxable = Math.max(0, subtotal - invoice.discountCents);
  const total = taxable + Math.round((taxable * invoice.taxRateBps) / 10000);
  const paidBefore = invoice.payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  );
  const paidAfter = paidBefore + amountCents;
  const paidAt = context.clock.now();
  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        amountCents,
        method: text(formData, "method") as
          | "CASH"
          | "BANK_TRANSFER"
          | "MOBILE_MONEY"
          | "CARD"
          | "CHEQUE"
          | "OTHER",
        paidAt,
        reference: text(formData, "reference") || null,
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: paidAfter >= total ? "PAID" : "PARTIALLY_PAID",
        paidAt: paidAfter >= total ? paidAt : null,
        version: { increment: 1 },
        updatedAt: paidAt,
      },
    }),
  ]);
  revalidatePath("/workspace/billing");
  revalidatePath("/workspace");
}
