import type { RequestContext } from "@/shared/request-context";

import {
  createClientContact as createClientContactDomain,
  type ClientContact,
  type Result,
} from "../domain/client-contact";
import type { BillingApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";
import type { ClientContactRepository } from "./client-contact-repository";
import type { ClientRepository } from "./client-repository";

export type ClientContactDependencies = Readonly<{
  clients: ClientRepository;
  clientContacts: ClientContactRepository;
}>;

export type AddClientContactInput = Readonly<{
  id: string;
  clientId: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
}>;

export async function addClientContact(
  dependencies: ClientContactDependencies,
  context: RequestContext,
  input: AddClientContactInput,
): Promise<Result<ClientContact, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const client = await dependencies.clients.findById(input.clientId);
  if (!client) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Client was not found." },
    };
  }
  if (!mayAccessBilling(actor) || !hasWorldScope(actor, client.worldKey)) {
    return forbidden();
  }

  const now = context.clock.now();
  const contactResult = createClientContactDomain({
    id: input.id,
    clientId: input.clientId,
    name: input.name,
    role: input.role,
    email: input.email,
    phone: input.phone,
    isPrimary: input.isPrimary,
    createdAt: now,
    updatedAt: now,
  });
  if (!contactResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: contactResult.error.code,
        message: contactResult.error.message,
      },
    };
  }

  if (input.isPrimary) {
    await dependencies.clientContacts.unsetPrimaryForClient(input.clientId);
  }
  await dependencies.clientContacts.save(contactResult.value);
  return { ok: true, value: contactResult.value };
}
