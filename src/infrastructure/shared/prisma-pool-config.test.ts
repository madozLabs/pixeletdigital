import { describe, expect, it } from "vitest";

import { resolvePrismaPoolMax } from "./prisma-pool-config";

describe("resolvePrismaPoolMax", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "serializes queries for the local database host %s",
    (host) => {
      expect(
        resolvePrismaPoolMax({
          connectionString: `postgresql://postgres:postgres@${host}:55701/postgres`,
        }),
      ).toBe(1);
    },
  );

  it("keeps the driver default for a remote production database", () => {
    expect(
      resolvePrismaPoolMax({
        connectionString:
          "postgresql://postgres:postgres@db.example.supabase.co:5432/postgres",
      }),
    ).toBeUndefined();
  });

  it("honors an explicit positive pool size", () => {
    expect(
      resolvePrismaPoolMax({
        connectionString: "postgresql://localhost:55701/postgres",
        configuredMax: "4",
      }),
    ).toBe(4);
  });

  it("falls back safely when the override or URL is invalid", () => {
    expect(
      resolvePrismaPoolMax({
        connectionString: "not-a-database-url",
        configuredMax: "0",
      }),
    ).toBeUndefined();
  });
});
