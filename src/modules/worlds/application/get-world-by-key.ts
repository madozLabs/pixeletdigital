import { parseWorldKey, type Result, type World } from "../domain/world";
import type { RequestContext } from "@/shared/request-context";
import type { WorldApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  requireActiveActor,
} from "./world-authorization";
import type { WorldRepository } from "./world-repository";

export async function getWorldByKey(
  repository: WorldRepository,
  context: RequestContext,
  rawKey: string,
): Promise<Result<World, WorldApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

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

  if (!hasWorldScope(actorResult.value, keyResult.value)) return forbidden();

  const world = await repository.findByKey(keyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }

  return { ok: true, value: world };
}
