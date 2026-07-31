import { randomUUID } from "node:crypto";

import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  recordRevenueEntry as recordRevenueEntryDomain,
  type RevenueEntry,
  type RevenueEntryDomainError,
  type Result,
} from "../domain/revenue-entry";
import type { FinanceApplicationError } from "./application-error";
import type {
  ListRevenueEntriesFilter,
  RevenueEntryRepository,
} from "./revenue-entry-repository";
import {
  forbidden,
  hasWorldScope,
  mayAccessFinance,
  requireActiveActor,
} from "./finance-authorization";

export type RevenueEntryDependencies = Readonly<{
  revenueEntries: RevenueEntryRepository;
  worlds: WorldRepository;
}>;

export type RecordRevenueEntryInput = Readonly<{
  worldKey: string;
  label: string;
  amountCents: number;
  revenueDate: Date;
  notes?: string | null;
}>;

export async function recordRevenueEntry(
  dependencies: RevenueEntryDependencies,
  context: RequestContext,
  input: RecordRevenueEntryInput,
): Promise<Result<RevenueEntry, FinanceApplicationError>> {
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
  if (!mayAccessFinance(actor) || !hasWorldScope(actor, worldKeyResult.value)) {
    return forbidden();
  }

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }

  const now = context.clock.now();
  const entryResult = recordRevenueEntryDomain({
    id: randomUUID(),
    worldKey: world.key,
    label: input.label,
    amountCents: input.amountCents,
    revenueDate: input.revenueDate,
    notes: input.notes,
    createdById: actor.id,
    createdAt: now,
  });
  if (!entryResult.ok) return validationFailure(entryResult.error);

  await dependencies.revenueEntries.save(entryResult.value);
  return { ok: true, value: entryResult.value };
}

export type ListRevenueEntriesInput = ListRevenueEntriesFilter;

export async function listRevenueEntriesByWorld(
  dependencies: RevenueEntryDependencies,
  context: RequestContext,
  input: ListRevenueEntriesInput,
): Promise<
  Result<
    Readonly<{ items: readonly RevenueEntry[]; total: number }>,
    FinanceApplicationError
  >
> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  if (
    !mayAccessFinance(actorResult.value) ||
    !hasWorldScope(actorResult.value, input.worldKey)
  ) {
    return forbidden();
  }

  const [items, total] = await Promise.all([
    dependencies.revenueEntries.listByWorld(input),
    dependencies.revenueEntries.countByWorld(input),
  ]);
  return { ok: true, value: { items, total } };
}

export type DeleteRevenueEntryInput = Readonly<{ id: string }>;

export async function deleteRevenueEntry(
  dependencies: RevenueEntryDependencies,
  context: RequestContext,
  input: DeleteRevenueEntryInput,
): Promise<Result<RevenueEntry, FinanceApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const entry = await dependencies.revenueEntries.findById(input.id);
  if (!entry) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Revenue entry was not found." },
    };
  }
  if (
    !mayAccessFinance(actorResult.value) ||
    !hasWorldScope(actorResult.value, entry.worldKey)
  ) {
    return forbidden();
  }

  await dependencies.revenueEntries.delete(input.id);
  return { ok: true, value: entry };
}

function validationFailure(
  error: RevenueEntryDomainError,
): Result<never, FinanceApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
