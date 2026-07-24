import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createClient as createClientDomain } from "../domain/client";
import { addClientContact } from "./client-contact-use-cases";
import { InMemoryClientContactRepository } from "./testing/in-memory-client-contact-repository";
import { InMemoryClientRepository } from "./testing/in-memory-client-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-23T10:30:00.000Z");

describe("addClientContact", () => {
  it("adds a contact to an existing client", async () => {
    const dependencies = dependenciesWithClient();

    const result = await addClientContact(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: "contact_01",
        clientId: "client_test_01",
        name: "Jane Doe",
        isPrimary: true,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { name: "Jane Doe", isPrimary: true },
    });
  });

  it("unsets the previous primary contact when adding a new primary", async () => {
    const dependencies = dependenciesWithClient();
    await addClientContact(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: "contact_01",
        clientId: "client_test_01",
        name: "Jane Doe",
        isPrimary: true,
      },
    );

    await addClientContact(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: "contact_02",
        clientId: "client_test_01",
        name: "John Smith",
        isPrimary: true,
      },
    );

    const contacts =
      await dependencies.clientContacts.listByClient("client_test_01");
    const primaries = contacts.filter((contact) => contact.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.name).toBe("John Smith");
  });

  it("returns NOT_FOUND for an unknown client", async () => {
    const dependencies = dependenciesWithClient();

    const result = await addClientContact(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: "contact_01",
        clientId: "missing-client",
        name: "Jane Doe",
        isPrimary: false,
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it.each<ApprovedRole>(["EDITOR", "SALES", "CONTRIBUTOR", "READER"])(
    "denies %s",
    async (role) => {
      const dependencies = dependenciesWithClient();

      const result = await addClientContact(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        {
          id: "contact_01",
          clientId: "client_test_01",
          name: "Jane Doe",
          isPrimary: false,
        },
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    },
  );
});

function dependenciesWithClient() {
  const clients = new InMemoryClientRepository();
  const clientContacts = new InMemoryClientContactRepository();
  const clientResult = createClientDomain({
    id: "client_test_01",
    worldKey: "pixel-digital",
    name: "Client A",
    createdAt,
    updatedAt: createdAt,
  });
  if (!clientResult.ok) throw new Error("expected a valid client");
  clients.save(clientResult.value);
  return { clients, clientContacts };
}

function context(
  role: ApprovedRole,
  scopes: readonly AuthorizationScope[],
): RequestContext {
  const clock: Clock = { now: () => clockTime };
  return {
    actor: { id: "actor_01", active: true, role, scopes },
    correlationId: "test-correlation-id",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}
