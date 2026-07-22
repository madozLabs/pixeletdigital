import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { PasswordHasher } from "../application/password-hasher";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ALGORITHM_TAG = "scrypt";

export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derivedKey = (await scryptAsync(
      password,
      salt,
      KEY_LENGTH,
    )) as Buffer;
    return `${ALGORITHM_TAG}:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const parts = passwordHash.split(":");
    if (parts.length !== 3 || parts[0] !== ALGORITHM_TAG) return false;

    const [, saltHex, expectedHex] = parts;
    let salt: Buffer;
    let expected: Buffer;
    try {
      salt = Buffer.from(saltHex!, "hex");
      expected = Buffer.from(expectedHex!, "hex");
    } catch {
      return false;
    }
    if (salt.length === 0 || expected.length === 0) return false;

    const derivedKey = (await scryptAsync(
      password,
      salt,
      expected.length,
    )) as Buffer;
    if (derivedKey.length !== expected.length) return false;
    return timingSafeEqual(derivedKey, expected);
  }
}
