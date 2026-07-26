import type { RequestContext } from "@/shared/request-context";
import {
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
) {
  const actor = requireActiveActor(context);
  if (
    !actor.ok ||
    !mayViewEnquiries(actor.value) ||
    !hasWorldScope(actor.value, input.worldKey)
  ) {
    return { ok: false as const, error: { code: "FORBIDDEN" as const } };
  }
  return {
    ok: true as const,
    value: await dependencies.workspaceEnquiryReader.countByWorld(
      input.worldKey,
    ),
  };
}
