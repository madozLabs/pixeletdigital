import { describe, expect, it } from "vitest";

import {
  recordAuthenticationActivity,
  type AuthenticationActivityWriter,
  type AuthenticationEvent,
} from "./authentication-activity";

const base: AuthenticationEvent = {
  id: "auth_event_01",
  occurredAt: new Date("2026-07-16T00:00:00.000Z"),
  type: "SIGN_IN_SUCCEEDED",
  userId: "user_01",
  provider: "configured-provider",
  correlationId: "correlation_01",
  origin: { channel: "WORKSPACE" },
};

class MemoryWriter implements AuthenticationActivityWriter {
  readonly events: AuthenticationEvent[] = [];
  fail = false;

  async append(event: AuthenticationEvent): Promise<void> {
    if (this.fail) throw new Error("unavailable");
    this.events.push(event);
  }
}

describe("recordAuthenticationActivity", () => {
  it("appends a valid successful sign-in", async () => {
    const writer = new MemoryWriter();
    await expect(recordAuthenticationActivity(writer, base)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(writer.events).toHaveLength(1);
  });

  it("requires a controlled reason for a rejected sign-in", async () => {
    const writer = new MemoryWriter();
    await expect(
      recordAuthenticationActivity(writer, {
        ...base,
        type: "SIGN_IN_REJECTED",
        userId: undefined,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(writer.events).toHaveLength(0);
  });

  it("does not allow a successful sign-in without an internal user", async () => {
    const writer = new MemoryWriter();
    await expect(
      recordAuthenticationActivity(writer, { ...base, userId: undefined }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("rejects an unsupported request origin before persistence", async () => {
    const writer = new MemoryWriter();
    await expect(
      recordAuthenticationActivity(writer, {
        ...base,
        origin: { channel: "PUBLIC" },
      } as unknown as AuthenticationEvent),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(writer.events).toHaveLength(0);
  });

  it("maps persistence failure without leaking infrastructure details", async () => {
    const writer = new MemoryWriter();
    writer.fail = true;
    await expect(recordAuthenticationActivity(writer, base)).resolves.toEqual({
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Authentication activity could not be recorded.",
      },
    });
  });
});
