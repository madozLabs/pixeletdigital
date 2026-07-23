export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const CATALOGUE_ITEM_KINDS = ["SERVICE", "PRODUCT"] as const;
export type CatalogueItemKind = (typeof CATALOGUE_ITEM_KINDS)[number];

export const CATALOGUE_ITEM_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type CatalogueItemStatus = (typeof CATALOGUE_ITEM_STATUSES)[number];

export type CatalogueItemDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_LABEL"
  | "INVALID_KIND"
  | "INVALID_UNIT_PRICE_CENTS"
  | "INVALID_STATUS"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION";

export type CatalogueItemDomainError = Readonly<{
  code: CatalogueItemDomainErrorCode;
  message: string;
}>;

export type CatalogueItem = Readonly<{
  id: string;
  worldKey: string;
  label: string;
  kind: CatalogueItemKind;
  unitPriceCents: number;
  status: CatalogueItemStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export function isCatalogueItemKind(value: string): value is CatalogueItemKind {
  return CATALOGUE_ITEM_KINDS.includes(value as CatalogueItemKind);
}

export function isCatalogueItemStatus(
  value: string,
): value is CatalogueItemStatus {
  return CATALOGUE_ITEM_STATUSES.includes(value as CatalogueItemStatus);
}

export function createCatalogueItem(
  input: Readonly<{
    id: string;
    worldKey: string;
    label: string;
    kind: string;
    unitPriceCents: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<CatalogueItem, CatalogueItemDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "CatalogueItem id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const labelResult = parseLabel(input.label);
  if (!labelResult.ok) return labelResult;

  if (!isCatalogueItemKind(input.kind)) {
    return failure(
      "INVALID_KIND",
      "CatalogueItem kind is not part of the controlled vocabulary.",
    );
  }

  const priceResult = parseUnitPriceCents(input.unitPriceCents);
  if (!priceResult.ok) return priceResult;

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      label: labelResult.value,
      kind: input.kind,
      unitPriceCents: priceResult.value,
      status: "ACTIVE",
      version: 1,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreCatalogueItem(
  input: Readonly<{
    id: string;
    worldKey: string;
    label: string;
    kind: string;
    unitPriceCents: number;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<CatalogueItem, CatalogueItemDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "CatalogueItem id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const labelResult = parseLabel(input.label);
  if (!labelResult.ok) return labelResult;

  if (!isCatalogueItemKind(input.kind)) {
    return failure(
      "INVALID_KIND",
      "CatalogueItem kind is not part of the controlled vocabulary.",
    );
  }

  const priceResult = parseUnitPriceCents(input.unitPriceCents);
  if (!priceResult.ok) return priceResult;

  if (!isCatalogueItemStatus(input.status)) {
    return failure(
      "INVALID_STATUS",
      "CatalogueItem status is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "CatalogueItem version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      label: labelResult.value,
      kind: input.kind,
      unitPriceCents: priceResult.value,
      status: input.status,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function editCatalogueItem(
  item: CatalogueItem,
  changes: Readonly<{ label: string; unitPriceCents: number }>,
  updatedAt: Date,
): Result<CatalogueItem, CatalogueItemDomainError> {
  const labelResult = parseLabel(changes.label);
  if (!labelResult.ok) return labelResult;

  const priceResult = parseUnitPriceCents(changes.unitPriceCents);
  if (!priceResult.ok) return priceResult;

  return {
    ok: true,
    value: Object.freeze({
      ...item,
      label: labelResult.value,
      unitPriceCents: priceResult.value,
      version: item.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function archiveCatalogueItem(
  item: CatalogueItem,
  updatedAt: Date,
): Result<CatalogueItem, CatalogueItemDomainError> {
  if (item.status === "ARCHIVED") {
    return failure("INVALID_TRANSITION", "CatalogueItem is already archived.");
  }

  return {
    ok: true,
    value: Object.freeze({
      ...item,
      status: "ARCHIVED",
      version: item.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

function parseWorldKey(
  rawWorldKey: string,
): Result<string, CatalogueItemDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "CatalogueItem worldKey must be a non-empty world stable key.",
    );
  }
  return { ok: true, value: worldKey };
}

function parseLabel(
  rawLabel: string,
): Result<string, CatalogueItemDomainError> {
  const label = rawLabel.trim();
  if (!label || label.length > 160) {
    return failure(
      "INVALID_LABEL",
      "CatalogueItem label must contain between 1 and 160 characters.",
    );
  }
  return { ok: true, value: label };
}

function parseUnitPriceCents(
  rawUnitPriceCents: number,
): Result<number, CatalogueItemDomainError> {
  if (!Number.isInteger(rawUnitPriceCents) || rawUnitPriceCents < 0) {
    return failure(
      "INVALID_UNIT_PRICE_CENTS",
      "CatalogueItem unitPriceCents must be a non-negative integer.",
    );
  }
  return { ok: true, value: rawUnitPriceCents };
}

function failure(
  code: CatalogueItemDomainErrorCode,
  message: string,
): Result<never, CatalogueItemDomainError> {
  return { ok: false, error: { code, message } };
}
