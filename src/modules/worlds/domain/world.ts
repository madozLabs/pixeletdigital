export const WORLD_MODES = ["ACTIVE", "TEASER", "INACTIVE"] as const;

export type WorldMode = (typeof WORLD_MODES)[number];
export type WorldKey = string & { readonly __brand: "WorldKey" };

export type WorldValidationCode =
  "INVALID_ID" | "INVALID_KEY" | "INVALID_DISPLAY_NAME" | "INVALID_MODE";

export type WorldValidationError = Readonly<{
  code: WorldValidationCode;
  message: string;
}>;

export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export type World = Readonly<{
  id: string;
  key: WorldKey;
  displayName: string;
  mode: WorldMode;
  createdAt: Date;
  updatedAt: Date;
}>;
const WORLD_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function createWorld(
  input: Readonly<{
    id: string;
    key: string;
    displayName: string;
    mode: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<World, WorldValidationError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "World id must be a non-empty opaque identifier.",
    );
  }

  const keyResult = parseWorldKey(input.key);
  if (!keyResult.ok) return keyResult;

  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 120) {
    return failure(
      "INVALID_DISPLAY_NAME",
      "World display name must contain between 1 and 120 characters.",
    );
  }

  if (!isWorldMode(input.mode)) {
    return failure(
      "INVALID_MODE",
      "World mode is not part of the controlled vocabulary.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      key: keyResult.value,
      displayName,
      mode: input.mode,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function parseWorldKey(
  rawKey: string,
): Result<WorldKey, WorldValidationError> {
  const key = rawKey.trim();
  if (key.length < 2 || key.length > 64 || !WORLD_KEY_PATTERN.test(key)) {
    return failure(
      "INVALID_KEY",
      "World key must use lowercase letters, digits, and internal hyphens.",
    );
  }

  return { ok: true, value: key as WorldKey };
}

export function updateWorldSettings(
  world: World,
  input: Readonly<{ displayName: string; mode: string }>,
  updatedAt: Date,
): Result<World, WorldValidationError> {
  return createWorld({
    ...world,
    displayName: input.displayName,
    mode: input.mode,
    updatedAt,
  });
}

export function isWorldMode(value: string): value is WorldMode {
  return WORLD_MODES.includes(value as WorldMode);
}

function failure(
  code: WorldValidationCode,
  message: string,
): Result<never, WorldValidationError> {
  return { ok: false, error: { code, message } };
}
