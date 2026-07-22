import { describe, expect, it } from "vitest";

import { ScryptPasswordHasher } from "./scrypt-password-hasher";

describe("ScryptPasswordHasher", () => {
  it("verifies a password against its own hash", async () => {
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash("correct horse battery staple");

    expect(await hasher.verify("correct horse battery staple", hash)).toBe(
      true,
    );
  });

  it("rejects an incorrect password", async () => {
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash("correct horse battery staple");

    expect(await hasher.verify("wrong password", hash)).toBe(false);
  });

  it("produces a different hash and salt for the same password each time", async () => {
    const hasher = new ScryptPasswordHasher();
    const first = await hasher.hash("same password");
    const second = await hasher.hash("same password");

    expect(first).not.toBe(second);
    expect(await hasher.verify("same password", first)).toBe(true);
    expect(await hasher.verify("same password", second)).toBe(true);
  });

  it.each(["not-a-hash", "scrypt:only-two-parts", "unknown:aa:bb", ""])(
    "rejects a malformed hash %s without throwing",
    async (malformed) => {
      const hasher = new ScryptPasswordHasher();

      await expect(hasher.verify("anything", malformed)).resolves.toBe(false);
    },
  );
});
