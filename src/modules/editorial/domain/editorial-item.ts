export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const EDITORIAL_ITEM_STATUSES = [
  "PLANNED",
  "DONE",
  "CANCELLED",
] as const;

export type EditorialItemStatus = (typeof EDITORIAL_ITEM_STATUSES)[number];

export type EditorialItemDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_CLIENT_LABEL"
  | "INVALID_CHANNEL"
  | "INVALID_TITLE"
  | "INVALID_SCHEDULED_FOR"
  | "INVALID_STATUS"
  | "INVALID_VERSION"
  | "INVALID_PROOF_URL"
  | "INVALID_TRANSITION";

export type EditorialItemDomainError = Readonly<{
  code: EditorialItemDomainErrorCode;
  message: string;
}>;

export type EditorialItem = Readonly<{
  id: string;
  worldKey: string;
  clientLabel: string;
  channel: string;
  title: string;
  scheduledFor: Date;
  status: EditorialItemStatus;
  proofUrl: string | null;
  notes: string | null;
  realizedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export function isEditorialItemStatus(
  value: string,
): value is EditorialItemStatus {
  return EDITORIAL_ITEM_STATUSES.includes(value as EditorialItemStatus);
}

export function isEditorialItemLate(item: EditorialItem, now: Date): boolean {
  return (
    item.status === "PLANNED" && item.scheduledFor.getTime() < now.getTime()
  );
}

export function createDraftEditorialItem(
  input: Readonly<{
    id: string;
    worldKey: string;
    clientLabel: string;
    channel: string;
    title: string;
    scheduledFor: Date;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<EditorialItem, EditorialItemDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "EditorialItem id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const clientLabelResult = parseClientLabel(input.clientLabel);
  if (!clientLabelResult.ok) return clientLabelResult;

  const channelResult = parseChannel(input.channel);
  if (!channelResult.ok) return channelResult;

  const titleResult = parseTitle(input.title);
  if (!titleResult.ok) return titleResult;

  if (
    !(input.scheduledFor instanceof Date) ||
    Number.isNaN(input.scheduledFor.getTime())
  ) {
    return failure(
      "INVALID_SCHEDULED_FOR",
      "EditorialItem scheduledFor must be a valid date.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      clientLabel: clientLabelResult.value,
      channel: channelResult.value,
      title: titleResult.value,
      scheduledFor: new Date(input.scheduledFor),
      status: "PLANNED",
      proofUrl: null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      realizedAt: null,
      version: 1,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreEditorialItem(
  input: Readonly<{
    id: string;
    worldKey: string;
    clientLabel: string;
    channel: string;
    title: string;
    scheduledFor: Date;
    status: string;
    proofUrl: string | null;
    notes: string | null;
    realizedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<EditorialItem, EditorialItemDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "EditorialItem id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const clientLabelResult = parseClientLabel(input.clientLabel);
  if (!clientLabelResult.ok) return clientLabelResult;

  const channelResult = parseChannel(input.channel);
  if (!channelResult.ok) return channelResult;

  const titleResult = parseTitle(input.title);
  if (!titleResult.ok) return titleResult;

  if (!isEditorialItemStatus(input.status)) {
    return failure(
      "INVALID_STATUS",
      "EditorialItem status is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "EditorialItem version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      clientLabel: clientLabelResult.value,
      channel: channelResult.value,
      title: titleResult.value,
      scheduledFor: new Date(input.scheduledFor),
      status: input.status,
      proofUrl: input.proofUrl,
      notes: input.notes,
      realizedAt: input.realizedAt ? new Date(input.realizedAt) : null,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function editPlannedEditorialItem(
  item: EditorialItem,
  changes: Readonly<{
    clientLabel: string;
    channel: string;
    title: string;
    scheduledFor: Date;
    notes?: string | null;
  }>,
  updatedAt: Date,
): Result<EditorialItem, EditorialItemDomainError> {
  if (item.status !== "PLANNED") {
    return failure(
      "INVALID_TRANSITION",
      `Only a planned editorial item can be edited, but status is ${item.status}.`,
    );
  }

  const clientLabelResult = parseClientLabel(changes.clientLabel);
  if (!clientLabelResult.ok) return clientLabelResult;

  const channelResult = parseChannel(changes.channel);
  if (!channelResult.ok) return channelResult;

  const titleResult = parseTitle(changes.title);
  if (!titleResult.ok) return titleResult;

  if (
    !(changes.scheduledFor instanceof Date) ||
    Number.isNaN(changes.scheduledFor.getTime())
  ) {
    return failure(
      "INVALID_SCHEDULED_FOR",
      "EditorialItem scheduledFor must be a valid date.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...item,
      clientLabel: clientLabelResult.value,
      channel: channelResult.value,
      title: titleResult.value,
      scheduledFor: new Date(changes.scheduledFor),
      notes: changes.notes?.trim() ? changes.notes.trim() : null,
      version: item.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function markEditorialItemDone(
  item: EditorialItem,
  proofUrl: string,
  realizedAt: Date,
): Result<EditorialItem, EditorialItemDomainError> {
  if (item.status !== "PLANNED") {
    return failure(
      "INVALID_TRANSITION",
      `Only a planned editorial item can be marked done, but status is ${item.status}.`,
    );
  }

  const trimmedProofUrl = proofUrl.trim();
  if (!trimmedProofUrl || trimmedProofUrl.length > 2048) {
    return failure(
      "INVALID_PROOF_URL",
      "A proof link is required to mark an editorial item as done.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...item,
      status: "DONE",
      proofUrl: trimmedProofUrl,
      realizedAt: new Date(realizedAt),
      version: item.version + 1,
      updatedAt: new Date(realizedAt),
    }),
  };
}

export function cancelEditorialItem(
  item: EditorialItem,
  updatedAt: Date,
): Result<EditorialItem, EditorialItemDomainError> {
  if (item.status !== "PLANNED") {
    return failure(
      "INVALID_TRANSITION",
      `Only a planned editorial item can be cancelled, but status is ${item.status}.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...item,
      status: "CANCELLED",
      version: item.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

function parseWorldKey(
  rawWorldKey: string,
): Result<string, EditorialItemDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "EditorialItem worldKey must be a non-empty world stable key.",
    );
  }
  return { ok: true, value: worldKey };
}

function parseClientLabel(
  rawClientLabel: string,
): Result<string, EditorialItemDomainError> {
  const clientLabel = rawClientLabel.trim();
  if (!clientLabel || clientLabel.length > 120) {
    return failure(
      "INVALID_CLIENT_LABEL",
      "EditorialItem clientLabel must contain between 1 and 120 characters.",
    );
  }
  return { ok: true, value: clientLabel };
}

function parseChannel(
  rawChannel: string,
): Result<string, EditorialItemDomainError> {
  const channel = rawChannel.trim();
  if (!channel || channel.length > 60) {
    return failure(
      "INVALID_CHANNEL",
      "EditorialItem channel must contain between 1 and 60 characters.",
    );
  }
  return { ok: true, value: channel };
}

function parseTitle(
  rawTitle: string,
): Result<string, EditorialItemDomainError> {
  const title = rawTitle.trim();
  if (!title || title.length > 160) {
    return failure(
      "INVALID_TITLE",
      "EditorialItem title must contain between 1 and 160 characters.",
    );
  }
  return { ok: true, value: title };
}

function failure(
  code: EditorialItemDomainErrorCode,
  message: string,
): Result<never, EditorialItemDomainError> {
  return { ok: false, error: { code, message } };
}
