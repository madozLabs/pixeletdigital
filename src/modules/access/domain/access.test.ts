import { describe, expect, it } from "vitest";

import { APPROVED_ROLES } from "@/shared/request-context";
import {
  createAuthAccount,
  createRoleAssignment,
  createUser,
  isAssignmentActiveAt,
  USER_STATUSES,
} from "./access";

describe("AuthAccount", () => {
  it("creates a provider-neutral identity link", () => {
    expect(
      createAuthAccount({
        id: "account_01",
        userId: "user_01",
        provider: "configured-provider",
        providerAccountId: "external-subject-01",
      }),
    ).toEqual({
      ok: true,
      value: {
        id: "account_01",
        userId: "user_01",
        provider: "configured-provider",
        providerAccountId: "external-subject-01",
      },
    });
  });

  it.each([
    { provider: "", providerAccountId: "subject" },
    { provider: "provider", providerAccountId: "   " },
  ])("rejects an incomplete identity link", (identity) => {
    expect(
      createAuthAccount({
        id: "account_01",
        userId: "user_01",
        ...identity,
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_IDENTITY" } });
  });

  it("preserves provider-issued opaque account identifiers", () => {
    expect(
      createAuthAccount({
        id: "account_01",
        userId: "user_01",
        provider: "configured-provider",
        providerAccountId: " subject with spaces ",
      }),
    ).toMatchObject({
      ok: true,
      value: { providerAccountId: " subject with spaces " },
    });
  });
});

const from = new Date("2026-07-15T10:00:00.000Z");
const until = new Date("2026-07-15T11:00:00.000Z");

describe("User", () => {
  it.each(USER_STATUSES)("accepts status %s", (status) => {
    expect(createUser({ id: " user_01 ", status })).toEqual({
      ok: true,
      value: { id: "user_01", status },
    });
  });

  it.each([
    [{ id: " ", status: "ACTIVE" }, "INVALID_ID"],
    [{ id: "user_01", status: "DISABLED" }, "INVALID_USER_STATUS"],
  ])("rejects an invalid user %#", (input, code) => {
    expect(createUser(input)).toMatchObject({ ok: false, error: { code } });
  });
});

describe("RoleAssignment", () => {
  it.each(APPROVED_ROLES)("accepts approved role %s", (role) => {
    expect(
      createRoleAssignment({
        id: "assignment_01",
        userId: "user_01",
        role,
        scope: { type: "GLOBAL" },
        validFrom: from,
        validUntil: until,
      }),
    ).toMatchObject({ ok: true, value: { role, scope: { type: "GLOBAL" } } });
  });

  it("normalizes explicit WORLD scope and accepts an open interval", () => {
    expect(
      createRoleAssignment({
        id: " assignment_01 ",
        userId: " user_01 ",
        role: "EDITOR",
        scope: { type: "WORLD", worldKey: " pixel-digital " },
        validFrom: from,
      }),
    ).toEqual({
      ok: true,
      value: {
        id: "assignment_01",
        userId: "user_01",
        role: "EDITOR",
        scope: { type: "WORLD", worldKey: "pixel-digital" },
        validFrom: from,
      },
    });
  });

  it("rejects an unapproved role", () => {
    expect(
      createRoleAssignment({
        id: "assignment_01",
        userId: "user_01",
        role: "OWNER",
        scope: { type: "GLOBAL" },
        validFrom: from,
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_ROLE" } });
  });

  it.each(["", "Pixel Digital", "pixel_digital", "-pixel"])(
    "rejects WORLD key %s",
    (worldKey) => {
      expect(
        createRoleAssignment({
          id: "assignment_01",
          userId: "user_01",
          role: "READER",
          scope: { type: "WORLD", worldKey },
          validFrom: from,
        }),
      ).toMatchObject({ ok: false, error: { code: "INVALID_SCOPE" } });
    },
  );

  it.each([
    null,
    {},
    { type: "UNKNOWN" },
    { type: "WORLD" },
    { type: "WORLD", worldKey: 42 },
  ])("rejects malformed runtime scope %#", (scope) => {
    expect(
      createRoleAssignment({
        id: "assignment_01",
        userId: "user_01",
        role: "READER",
        scope,
        validFrom: from,
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_SCOPE" } });
  });

  it.each([
    [new Date("invalid"), undefined],
    [from, new Date("invalid")],
    [from, from],
    [until, from],
  ])("rejects malformed interval %#", (validFrom, validUntil) => {
    expect(
      createRoleAssignment({
        id: "assignment_01",
        userId: "user_01",
        role: "READER",
        scope: { type: "GLOBAL" },
        validFrom,
        ...(validUntil === undefined ? {} : { validUntil }),
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_INTERVAL" } });
  });

  it("uses a half-open active interval", () => {
    const result = createRoleAssignment({
      id: "assignment_01",
      userId: "user_01",
      role: "READER",
      scope: { type: "GLOBAL" },
      validFrom: from,
      validUntil: until,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(
      isAssignmentActiveAt(result.value, new Date(from.getTime() - 1)),
    ).toBe(false);
    expect(isAssignmentActiveAt(result.value, from)).toBe(true);
    expect(
      isAssignmentActiveAt(result.value, new Date(until.getTime() - 1)),
    ).toBe(true);
    expect(isAssignmentActiveAt(result.value, until)).toBe(false);
  });
});
