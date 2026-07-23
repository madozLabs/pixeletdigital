import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  cancelEditorialItem as cancelEditorialItemDomain,
  createDraftEditorialItem as createDraftEditorialItemDomain,
  editPlannedEditorialItem as editPlannedEditorialItemDomain,
  markEditorialItemDone as markEditorialItemDoneDomain,
  type EditorialItem,
  type EditorialItemDomainError,
  type Result,
} from "../domain/editorial-item";
import type { EditorialApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayMutateEditorialCalendar,
  requireActiveActor,
} from "./editorial-authorization";
import type { EditorialItemRepository } from "./editorial-item-repository";

export type EditorialItemDependencies = Readonly<{
  editorialItems: EditorialItemRepository;
  worlds: WorldRepository;
}>;

export type CreateDraftEditorialItemInput = Readonly<{
  id: string;
  worldKey: string;
  clientLabel: string;
  channel: string;
  title: string;
  scheduledFor: Date;
  notes?: string | null;
}>;

export async function createDraftEditorialItem(
  dependencies: EditorialItemDependencies,
  context: RequestContext,
  input: CreateDraftEditorialItemInput,
): Promise<Result<EditorialItem, EditorialApplicationError>> {
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

  if (
    !mayMutateEditorialCalendar(actor) ||
    !hasWorldScope(actor, worldKeyResult.value)
  ) {
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
  const itemResult = createDraftEditorialItemDomain({
    id: input.id,
    worldKey: world.key,
    clientLabel: input.clientLabel,
    channel: input.channel,
    title: input.title,
    scheduledFor: input.scheduledFor,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  });
  if (!itemResult.ok) return validationFailure(itemResult.error);

  await dependencies.editorialItems.save(itemResult.value);
  return { ok: true, value: itemResult.value };
}

export type ListEditorialItemsByWorldInput = Readonly<{ worldKey: string }>;

export async function listEditorialItemsByWorld(
  dependencies: EditorialItemDependencies,
  context: RequestContext,
  input: ListEditorialItemsByWorldInput,
): Promise<Result<readonly EditorialItem[], EditorialApplicationError>> {
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

  if (!hasWorldScope(actorResult.value, worldKeyResult.value))
    return forbidden();

  const items = await dependencies.editorialItems.listByWorld(
    worldKeyResult.value,
  );
  return { ok: true, value: items };
}

export type EditPlannedEditorialItemInput = Readonly<{
  id: string;
  expectedVersion: number;
  clientLabel: string;
  channel: string;
  title: string;
  scheduledFor: Date;
  notes?: string | null;
}>;

export async function editPlannedEditorialItem(
  dependencies: EditorialItemDependencies,
  context: RequestContext,
  input: EditPlannedEditorialItemInput,
): Promise<Result<EditorialItem, EditorialApplicationError>> {
  return withMutableEditorialItem(dependencies, context, input, (item, now) =>
    editPlannedEditorialItemDomain(
      item,
      {
        clientLabel: input.clientLabel,
        channel: input.channel,
        title: input.title,
        scheduledFor: input.scheduledFor,
        notes: input.notes,
      },
      now,
    ),
  );
}

export type MarkEditorialItemDoneInput = Readonly<{
  id: string;
  expectedVersion: number;
  proofUrl: string;
}>;

export async function markEditorialItemDone(
  dependencies: EditorialItemDependencies,
  context: RequestContext,
  input: MarkEditorialItemDoneInput,
): Promise<Result<EditorialItem, EditorialApplicationError>> {
  return withMutableEditorialItem(dependencies, context, input, (item, now) =>
    markEditorialItemDoneDomain(item, input.proofUrl, now),
  );
}

export type CancelEditorialItemInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function cancelEditorialItem(
  dependencies: EditorialItemDependencies,
  context: RequestContext,
  input: CancelEditorialItemInput,
): Promise<Result<EditorialItem, EditorialApplicationError>> {
  return withMutableEditorialItem(dependencies, context, input, (item, now) =>
    cancelEditorialItemDomain(item, now),
  );
}

async function withMutableEditorialItem(
  dependencies: EditorialItemDependencies,
  context: RequestContext,
  input: Readonly<{ id: string; expectedVersion: number }>,
  transition: (
    item: EditorialItem,
    now: Date,
  ) => Result<EditorialItem, EditorialItemDomainError>,
): Promise<Result<EditorialItem, EditorialApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const item = await dependencies.editorialItems.findById(input.id);
  if (!item) return notFound();

  if (
    !mayMutateEditorialCalendar(actor) ||
    !hasWorldScope(actor, item.worldKey)
  ) {
    return forbidden();
  }

  if (item.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The editorial item has changed since it was last read.",
      },
    };
  }

  const transitioned = transition(item, context.clock.now());
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.editorialItems.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

function notFound(): Result<never, EditorialApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Editorial item was not found." },
  };
}

function validationFailure(
  error: EditorialItemDomainError,
): Result<never, EditorialApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
