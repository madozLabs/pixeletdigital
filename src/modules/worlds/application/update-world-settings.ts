import type { RequestContext } from "@/shared/request-context";

import {
  applyWorldSettings,
  parseWorldKey,
  parseWorldSettings,
  type Result,
  type World,
  type WorldValidationError,
} from "../domain/world";
import type { WorldApplicationError } from "./application-error";
import type { WorldRepository } from "./world-repository";
import {
  forbidden,
  hasMatchingWorldScope,
  hasWorldScope,
  mayAttemptWorldUpdate,
  requireActiveActor,
} from "./world-authorization";

export type UpdateWorldSettingsInput = Readonly<{
  key: string;
  displayName: string;
  mode: string;
}>;

export async function updateWorldSettings(
  repository: WorldRepository,
  context: RequestContext,
  input: UpdateWorldSettingsInput,
): Promise<Result<World, WorldApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const keyResult = parseWorldKey(input.key);
  if (!keyResult.ok) return validationFailure(keyResult.error);

  const settingsResult = parseWorldSettings(input);
  if (!settingsResult.ok) return validationFailure(settingsResult.error);

  const actor = actorResult.value;
  const hasRequiredScope =
    actor.role === "WORLD_MANAGER"
      ? hasMatchingWorldScope(actor, keyResult.value)
      : hasWorldScope(actor, keyResult.value);
  if (!mayAttemptWorldUpdate(actor) || !hasRequiredScope) {
    return forbidden();
  }

  const world = await repository.findByKey(keyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }

  if (actor.role === "WORLD_MANAGER" && world.mode !== "ACTIVE") {
    return forbidden();
  }

  const updatedWorld = applyWorldSettings(
    world,
    settingsResult.value,
    context.clock.now(),
  );

  await repository.save(updatedWorld);
  return { ok: true, value: updatedWorld };
}

function validationFailure(
  error: WorldValidationError,
): Result<never, WorldApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
