import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  archiveCatalogueItem as archiveCatalogueItemDomain,
  createCatalogueItem as createCatalogueItemDomain,
  editCatalogueItem as editCatalogueItemDomain,
  type CatalogueItem,
  type CatalogueItemDomainError,
  type Result,
} from "../domain/catalogue-item";
import type { BillingApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";
import type { CatalogueItemRepository } from "./catalogue-item-repository";

export type CatalogueItemDependencies = Readonly<{
  catalogueItems: CatalogueItemRepository;
  worlds: WorldRepository;
}>;

export type CreateCatalogueItemInput = Readonly<{
  id: string;
  worldKey: string;
  label: string;
  kind: string;
  unitPriceCents: number;
}>;

export async function createCatalogueItem(
  dependencies: CatalogueItemDependencies,
  context: RequestContext,
  input: CreateCatalogueItemInput,
): Promise<Result<CatalogueItem, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_WORLD_KEY",
        message: worldKeyResult.error.message,
      },
    };
  }

  if (!mayAccessBilling(actor) || !hasWorldScope(actor, worldKeyResult.value)) {
    return forbidden();
  }

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }
  if (world.mode === "INACTIVE") return forbidden();

  const now = context.clock.now();
  const itemResult = createCatalogueItemDomain({
    id: input.id,
    worldKey: world.key,
    label: input.label,
    kind: input.kind,
    unitPriceCents: input.unitPriceCents,
    createdAt: now,
    updatedAt: now,
  });
  if (!itemResult.ok) return validationFailure(itemResult.error);

  await dependencies.catalogueItems.save(itemResult.value);
  return { ok: true, value: itemResult.value };
}

export type ListCatalogueItemsByWorldInput = Readonly<{ worldKey: string }>;

export async function listCatalogueItemsByWorld(
  dependencies: CatalogueItemDependencies,
  context: RequestContext,
  input: ListCatalogueItemsByWorldInput,
): Promise<Result<readonly CatalogueItem[], BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_WORLD_KEY",
        message: worldKeyResult.error.message,
      },
    };
  }

  if (
    !mayAccessBilling(actorResult.value) ||
    !hasWorldScope(actorResult.value, worldKeyResult.value)
  ) {
    return forbidden();
  }

  const items = await dependencies.catalogueItems.listByWorld(
    worldKeyResult.value,
  );
  return { ok: true, value: items };
}

export type EditCatalogueItemInput = Readonly<{
  id: string;
  expectedVersion: number;
  label: string;
  unitPriceCents: number;
}>;

export async function editCatalogueItem(
  dependencies: CatalogueItemDependencies,
  context: RequestContext,
  input: EditCatalogueItemInput,
): Promise<Result<CatalogueItem, BillingApplicationError>> {
  return withMutableCatalogueItem(dependencies, context, input, (item, now) =>
    editCatalogueItemDomain(
      item,
      { label: input.label, unitPriceCents: input.unitPriceCents },
      now,
    ),
  );
}

export type ArchiveCatalogueItemInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function archiveCatalogueItem(
  dependencies: CatalogueItemDependencies,
  context: RequestContext,
  input: ArchiveCatalogueItemInput,
): Promise<Result<CatalogueItem, BillingApplicationError>> {
  return withMutableCatalogueItem(dependencies, context, input, (item, now) =>
    archiveCatalogueItemDomain(item, now),
  );
}

async function withMutableCatalogueItem(
  dependencies: CatalogueItemDependencies,
  context: RequestContext,
  input: Readonly<{ id: string; expectedVersion: number }>,
  transition: (
    item: CatalogueItem,
    now: Date,
  ) => Result<CatalogueItem, CatalogueItemDomainError>,
): Promise<Result<CatalogueItem, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const item = await dependencies.catalogueItems.findById(input.id);
  if (!item) return notFound();

  if (!mayAccessBilling(actor) || !hasWorldScope(actor, item.worldKey)) {
    return forbidden();
  }

  if (item.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The catalogue item has changed since it was last read.",
      },
    };
  }

  const transitioned = transition(item, context.clock.now());
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.catalogueItems.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

function notFound(): Result<never, BillingApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Catalogue item was not found." },
  };
}

function validationFailure(
  error: CatalogueItemDomainError,
): Result<never, BillingApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
