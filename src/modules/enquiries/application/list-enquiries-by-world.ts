import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { RequestContext } from "@/shared/request-context";

import type { Enquiry, Result } from "../domain/enquiry";
import type { EnquiryApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayViewEnquiries,
  requireActiveActor,
} from "./enquiry-authorization";
import type { EnquiryRepository } from "./enquiry-repository";

export type ListEnquiriesByWorldInput = Readonly<{ worldKey: string }>;

export async function listEnquiriesByWorld(
  dependencies: Readonly<{ enquiries: EnquiryRepository }>,
  context: RequestContext,
  input: ListEnquiriesByWorldInput,
): Promise<Result<readonly Enquiry[], EnquiryApplicationError>> {
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

  if (!mayViewEnquiries(actor) || !hasWorldScope(actor, worldKeyResult.value)) {
    return forbidden();
  }

  const enquiries = await dependencies.enquiries.listByWorld(
    worldKeyResult.value,
  );
  return { ok: true, value: enquiries };
}
