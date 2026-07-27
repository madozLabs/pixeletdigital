import type { RequestContext } from "@/shared/request-context";
import type { Result } from "../domain/enquiry";
import type { EnquiryApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayViewEnquiries,
  requireActiveActor,
} from "./enquiry-authorization";

export interface WorkspaceEnquiryReader {
  countByWorld(worldKey: string): Promise<number>;
}

export async function countWorkspaceEnquiries(
  dependencies: Readonly<{ workspaceEnquiryReader: WorkspaceEnquiryReader }>,
  context: RequestContext,
  input: Readonly<{ worldKey: string }>,
): Promise<Result<number, EnquiryApplicationError>> {
  const actor = requireActiveActor(context);
  if (!actor.ok) return actor;
  if (
    !mayViewEnquiries(actor.value) ||
    !hasWorldScope(actor.value, input.worldKey)
  )
    return forbidden();

  try {
    return {
      ok: true,
      value: await dependencies.workspaceEnquiryReader.countByWorld(
        input.worldKey,
      ),
    };
  } catch (error) {
    console.error("Failed to count workspace enquiries", {
      correlationId: context.correlationId,
      worldKey: input.worldKey,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: String(error) },
    });
    return {
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Le compteur des demandes est momentanément indisponible.",
      },
    };
  }
}
