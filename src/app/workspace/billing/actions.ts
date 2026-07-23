"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  archiveCatalogueItem,
  createCatalogueItem,
} from "@/modules/billing/application/catalogue-item-use-cases";
import {
  archiveClient,
  createClient,
} from "@/modules/billing/application/client-use-cases";
import {
  cancelInvoice,
  createDraftInvoice,
  markInvoicePaid,
  markInvoiceSent,
} from "@/modules/billing/application/invoice-use-cases";
import { PrismaCatalogueItemRepository } from "@/modules/billing/infrastructure/prisma-catalogue-item-repository";
import { PrismaClientRepository } from "@/modules/billing/infrastructure/prisma-client-repository";
import { PrismaInvoiceRepository } from "@/modules/billing/infrastructure/prisma-invoice-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { getWorkspaceRequestContext } from "../get-workspace-context";

function worldDependencies() {
  return { worlds: new PrismaWorldRepository(prisma) };
}

export async function createClientAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await createClient(
    { clients: new PrismaClientRepository(prisma), ...worldDependencies() },
    context,
    {
      id: randomUUID(),
      worldKey: String(formData.get("worldKey")),
      name: String(formData.get("name")),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
    },
  );
  if (!result.ok) console.error("createClient failed", result.error);
  revalidatePath("/workspace/billing");
}

export async function archiveClientAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await archiveClient(
    { clients: new PrismaClientRepository(prisma), ...worldDependencies() },
    context,
    {
      id: String(formData.get("id")),
      expectedVersion: Number(formData.get("expectedVersion")),
    },
  );
  if (!result.ok) console.error("archiveClient failed", result.error);
  revalidatePath("/workspace/billing");
}

export async function createCatalogueItemAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const priceEuros = Number(formData.get("unitPrice"));
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
      unitPriceCents: Math.round(priceEuros * 100),
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

export async function createInvoiceAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const lines = [1, 2, 3].flatMap((index) => {
    const label = String(formData.get(`lineLabel${index}`) ?? "").trim();
    if (!label) return [];
    const quantity = Number(formData.get(`lineQuantity${index}`) ?? 1);
    const priceEuros = Number(formData.get(`lineUnitPrice${index}`) ?? 0);
    return [
      {
        id: randomUUID(),
        label,
        quantity,
        unitPriceCents: Math.round(priceEuros * 100),
      },
    ];
  });

  const result = await createDraftInvoice(
    { invoices: new PrismaInvoiceRepository(prisma), ...worldDependencies() },
    context,
    {
      id: randomUUID(),
      worldKey: String(formData.get("worldKey")),
      clientId: String(formData.get("clientId")),
      lines,
      issuedAt: context.clock.now(),
    },
  );
  if (!result.ok) console.error("createDraftInvoice failed", result.error);
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

export async function markInvoicePaidAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await markInvoicePaid(
    { invoices: new PrismaInvoiceRepository(prisma), ...worldDependencies() },
    context,
    {
      id: String(formData.get("id")),
      expectedVersion: Number(formData.get("expectedVersion")),
    },
  );
  if (!result.ok) console.error("markInvoicePaid failed", result.error);
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
