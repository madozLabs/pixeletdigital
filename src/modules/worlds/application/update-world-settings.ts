import type { Clock } from "@/shared/clock";

import {
  parseWorldKey,
  type Result,
  type World,
  type WorldValidationError,
  updateWorldSettings as applyWorldSettings,
} from "../domain/world";
import type { WorldApplicationError } from "./application-error";
import type { WorldRepository } from "./world-repository";

export type UpdateWorldSettingsInput = Readonly<{
  key: string;
  displayName: string;
  mode: string;
}>;

export async function updateWorldSettings(
  repository: WorldRepository,
  clock: Clock,
  input: UpdateWorldSettingsInput,
): Promise<Result<World, WorldApplicationError>> {
  const keyResult = parseWorldKey(input.key);
  if (!keyResult.ok) return validationFailure(keyResult.error);

  const world = await repository.findByKey(keyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }

  const updatedWorld = applyWorldSettings(world, input, clock.now());
  if (!updatedWorld.ok) return validationFailure(updatedWorld.error);

  await repository.save(updatedWorld.value);
  return updatedWorld;
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
