import { parseWorldKey, type Result, type World } from "../domain/world";
import type { WorldApplicationError } from "./application-error";
import type { WorldRepository } from "./world-repository";

export async function getWorldByKey(
  repository: WorldRepository,
  rawKey: string,
): Promise<Result<World, WorldApplicationError>> {
  const keyResult = parseWorldKey(rawKey);
  if (!keyResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: keyResult.error.code,
        message: keyResult.error.message,
      },
    };
  }

  const world = await repository.findByKey(keyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }

  return { ok: true, value: world };
}
