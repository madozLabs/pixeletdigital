import type { Result } from "./content-lifecycle";

export type { Result } from "./content-lifecycle";

const SECTION_TYPE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

export type PageSectionDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_PAGE_ID"
  | "INVALID_SECTION_TYPE"
  | "INVALID_ORDER"
  | "INVALID_PAYLOAD"
  | "INVALID_PAYLOAD_SCHEMA_VERSION"
  | "INVALID_VERSION";

export type PageSectionDomainError = Readonly<{
  code: PageSectionDomainErrorCode;
  message: string;
}>;

export type PageSectionPayload = Readonly<Record<string, unknown>>;

export type PageSection = Readonly<{
  id: string;
  pageId: string;
  sectionType: string;
  order: number;
  payload: PageSectionPayload;
  payloadSchemaVersion: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export function createPageSection(
  input: Readonly<{
    id: string;
    pageId: string;
    sectionType: string;
    order: number;
    payload: PageSectionPayload;
    payloadSchemaVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<PageSection, PageSectionDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "PageSection id must be a non-empty opaque identifier.",
    );
  }

  const pageIdResult = parsePageId(input.pageId);
  if (!pageIdResult.ok) return pageIdResult;

  const sectionTypeResult = parseSectionType(input.sectionType);
  if (!sectionTypeResult.ok) return sectionTypeResult;

  const orderResult = parseOrder(input.order);
  if (!orderResult.ok) return orderResult;

  const payloadResult = parsePayload(input.payload);
  if (!payloadResult.ok) return payloadResult;

  const schemaVersionResult = parsePayloadSchemaVersion(
    input.payloadSchemaVersion,
  );
  if (!schemaVersionResult.ok) return schemaVersionResult;

  return {
    ok: true,
    value: Object.freeze({
      id,
      pageId: pageIdResult.value,
      sectionType: sectionTypeResult.value,
      order: orderResult.value,
      payload: payloadResult.value,
      payloadSchemaVersion: schemaVersionResult.value,
      version: 1,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restorePageSection(
  input: Readonly<{
    id: string;
    pageId: string;
    sectionType: string;
    order: number;
    payload: PageSectionPayload;
    payloadSchemaVersion: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<PageSection, PageSectionDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "PageSection id must be a non-empty opaque identifier.",
    );
  }

  const pageIdResult = parsePageId(input.pageId);
  if (!pageIdResult.ok) return pageIdResult;

  const sectionTypeResult = parseSectionType(input.sectionType);
  if (!sectionTypeResult.ok) return sectionTypeResult;

  const orderResult = parseOrder(input.order);
  if (!orderResult.ok) return orderResult;

  const payloadResult = parsePayload(input.payload);
  if (!payloadResult.ok) return payloadResult;

  const schemaVersionResult = parsePayloadSchemaVersion(
    input.payloadSchemaVersion,
  );
  if (!schemaVersionResult.ok) return schemaVersionResult;

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "PageSection version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      pageId: pageIdResult.value,
      sectionType: sectionTypeResult.value,
      order: orderResult.value,
      payload: payloadResult.value,
      payloadSchemaVersion: schemaVersionResult.value,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function editPageSection(
  section: PageSection,
  changes: Readonly<{
    sectionType: string;
    order: number;
    payload: PageSectionPayload;
    payloadSchemaVersion: number;
  }>,
  updatedAt: Date,
): Result<PageSection, PageSectionDomainError> {
  const sectionTypeResult = parseSectionType(changes.sectionType);
  if (!sectionTypeResult.ok) return sectionTypeResult;

  const orderResult = parseOrder(changes.order);
  if (!orderResult.ok) return orderResult;

  const payloadResult = parsePayload(changes.payload);
  if (!payloadResult.ok) return payloadResult;

  const schemaVersionResult = parsePayloadSchemaVersion(
    changes.payloadSchemaVersion,
  );
  if (!schemaVersionResult.ok) return schemaVersionResult;

  return {
    ok: true,
    value: Object.freeze({
      ...section,
      sectionType: sectionTypeResult.value,
      order: orderResult.value,
      payload: payloadResult.value,
      payloadSchemaVersion: schemaVersionResult.value,
      version: section.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

function parsePageId(
  rawPageId: string,
): Result<string, PageSectionDomainError> {
  const pageId = rawPageId.trim();
  if (!pageId || pageId.length > 128) {
    return failure(
      "INVALID_PAGE_ID",
      "PageSection pageId must be a non-empty opaque identifier.",
    );
  }

  return { ok: true, value: pageId };
}

function parseSectionType(
  rawSectionType: string,
): Result<string, PageSectionDomainError> {
  const sectionType = rawSectionType.trim();
  if (
    sectionType.length < 2 ||
    sectionType.length > 64 ||
    !SECTION_TYPE_PATTERN.test(sectionType)
  ) {
    return failure(
      "INVALID_SECTION_TYPE",
      "PageSection type must be an uppercase, underscore-separated controlled name.",
    );
  }

  return { ok: true, value: sectionType };
}

function parseOrder(rawOrder: number): Result<number, PageSectionDomainError> {
  if (!Number.isInteger(rawOrder) || rawOrder < 0) {
    return failure(
      "INVALID_ORDER",
      "PageSection order must be a non-negative integer.",
    );
  }

  return { ok: true, value: rawOrder };
}

function parsePayload(
  rawPayload: PageSectionPayload,
): Result<PageSectionPayload, PageSectionDomainError> {
  if (
    typeof rawPayload !== "object" ||
    rawPayload === null ||
    Array.isArray(rawPayload)
  ) {
    return failure(
      "INVALID_PAYLOAD",
      "PageSection payload must be a structured object.",
    );
  }

  return { ok: true, value: rawPayload };
}

function parsePayloadSchemaVersion(
  rawVersion: number,
): Result<number, PageSectionDomainError> {
  if (!Number.isInteger(rawVersion) || rawVersion < 1) {
    return failure(
      "INVALID_PAYLOAD_SCHEMA_VERSION",
      "PageSection payload schema version must be a positive integer.",
    );
  }

  return { ok: true, value: rawVersion };
}

function failure(
  code: PageSectionDomainErrorCode,
  message: string,
): Result<never, PageSectionDomainError> {
  return { ok: false, error: { code, message } };
}
