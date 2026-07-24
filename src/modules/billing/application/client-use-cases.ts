import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  archiveClient as archiveClientDomain,
  createClient as createClientDomain,
  editClient as editClientDomain,
  type Client,
  type ClientDomainError,
  type ClientFields,
  type Result,
} from "../domain/client";
import type { BillingApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";
import type { ClientRepository } from "./client-repository";

export type ClientDependencies = Readonly<{
  clients: ClientRepository;
  worlds: WorldRepository;
}>;

export type CreateClientInput = ClientFields &
  Readonly<{ id: string; worldKey: string }>;

export async function createClient(
  dependencies: ClientDependencies,
  context: RequestContext,
  input: CreateClientInput,
): Promise<Result<Client, BillingApplicationError>> {
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

  if (!mayAccessBilling(actor) || !hasWorldScope(actor, worldKeyResult.value)) {
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
  const clientResult = createClientDomain({
    ...input,
    id: input.id,
    worldKey: world.key,
    createdAt: now,
    updatedAt: now,
  });
  if (!clientResult.ok) return validationFailure(clientResult.error);

  await dependencies.clients.save(clientResult.value);
  return { ok: true, value: clientResult.value };
}

export type GetClientByIdInput = Readonly<{ id: string }>;

export async function getClientById(
  dependencies: ClientDependencies,
  context: RequestContext,
  input: GetClientByIdInput,
): Promise<Result<Client, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const client = await dependencies.clients.findById(input.id);
  if (!client) return notFound();
  if (
    !mayAccessBilling(actorResult.value) ||
    !hasWorldScope(actorResult.value, client.worldKey)
  ) {
    return forbidden();
  }

  return { ok: true, value: client };
}

export type ListClientsByWorldInput = Readonly<{ worldKey: string }>;

export async function listClientsByWorld(
  dependencies: ClientDependencies,
  context: RequestContext,
  input: ListClientsByWorldInput,
): Promise<Result<readonly Client[], BillingApplicationError>> {
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

  if (
    !mayAccessBilling(actorResult.value) ||
    !hasWorldScope(actorResult.value, worldKeyResult.value)
  ) {
    return forbidden();
  }

  const clients = await dependencies.clients.listByWorld(worldKeyResult.value);
  return { ok: true, value: clients };
}

export type EditClientInput = ClientFields &
  Readonly<{ id: string; expectedVersion: number }>;

export async function editClient(
  dependencies: ClientDependencies,
  context: RequestContext,
  input: EditClientInput,
): Promise<Result<Client, BillingApplicationError>> {
  return withMutableClient(dependencies, context, input, (client, now) =>
    editClientDomain(client, input, now),
  );
}

export type ArchiveClientInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function archiveClient(
  dependencies: ClientDependencies,
  context: RequestContext,
  input: ArchiveClientInput,
): Promise<Result<Client, BillingApplicationError>> {
  return withMutableClient(dependencies, context, input, (client, now) =>
    archiveClientDomain(client, now),
  );
}

async function withMutableClient(
  dependencies: ClientDependencies,
  context: RequestContext,
  input: Readonly<{ id: string; expectedVersion: number }>,
  transition: (client: Client, now: Date) => Result<Client, ClientDomainError>,
): Promise<Result<Client, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const client = await dependencies.clients.findById(input.id);
  if (!client) return notFound();

  if (!mayAccessBilling(actor) || !hasWorldScope(actor, client.worldKey)) {
    return forbidden();
  }

  if (client.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The client has changed since it was last read.",
      },
    };
  }

  const transitioned = transition(client, context.clock.now());
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.clients.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

function notFound(): Result<never, BillingApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Client was not found." },
  };
}

function validationFailure(
  error: ClientDomainError,
): Result<never, BillingApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
