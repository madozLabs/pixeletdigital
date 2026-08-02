import { randomUUID } from "node:crypto";

import {
  Prisma,
  type PageRevision as PrismaPageRevision,
  type PrismaClient,
} from "@/generated/prisma/client";

import type {
  PageRevisionRepository,
  RevisionPageState,
} from "../application/page-revision-repository";
import type { PageRevision, PageRevisionStatus } from "../domain/page-revision";

const PREVIOUS_STATUSES: Readonly<
  Record<PageRevisionStatus, readonly PageRevisionStatus[]>
> = {
  DRAFT: ["IN_REVIEW", "APPROVED"],
  IN_REVIEW: ["DRAFT"],
  APPROVED: ["IN_REVIEW"],
  PUBLISHED: ["APPROVED"],
  SUPERSEDED: ["PUBLISHED"],
  ARCHIVED: ["PUBLISHED"],
};

export class PrismaPageRevisionRepository implements PageRevisionRepository {
  constructor(private readonly client: PrismaClient) {}

  async findPage(id: string): Promise<RevisionPageState | null> {
    return this.client.page.findUnique({
      where: { id },
      select: {
        id: true,
        worldKey: true,
        draftRevisionId: true,
        publishedRevisionId: true,
      },
    });
  }

  async findRevision(id: string): Promise<PageRevision | null> {
    const record = await this.client.pageRevision.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async createDraftFromPublished(input: {
    pageId: string;
    sourceRevisionId: string | null;
    actorId: string;
    now: Date;
  }): Promise<PageRevision> {
    return this.client.$transaction(
      async (transaction) => {
        const page = await transaction.page.findUniqueOrThrow({
          where: { id: input.pageId },
          select: {
            id: true,
            title: true,
            draftRevisionId: true,
            publishedRevisionId: true,
          },
        });
        if (page.draftRevisionId) {
          return toDomain(
            await transaction.pageRevision.findUniqueOrThrow({
              where: { id: page.draftRevisionId },
            }),
          );
        }

        const sourceId = page.publishedRevisionId ?? input.sourceRevisionId;
        const source = sourceId
          ? await transaction.pageRevision.findFirst({
              where: { id: sourceId, pageId: page.id, status: "PUBLISHED" },
              include: {
                sections: {
                  orderBy: { order: "asc" },
                  include: { mediaUsages: { orderBy: { order: "asc" } } },
                },
              },
            })
          : null;
        const aggregate = await transaction.pageRevision.aggregate({
          where: { pageId: page.id },
          _max: { revisionNumber: true },
        });
        const revision = await transaction.pageRevision.create({
          data: {
            id: `revision_${randomUUID()}`,
            pageId: page.id,
            revisionNumber: (aggregate._max.revisionNumber ?? 0) + 1,
            status: "DRAFT",
            title: source?.title ?? page.title,
            seoTitle: source?.seoTitle ?? null,
            seoDescription: source?.seoDescription ?? null,
            ogImageMediaId: source?.ogImageMediaId ?? null,
            version: 1,
            createdById: input.actorId,
            createdAt: input.now,
            updatedAt: input.now,
            sections: source
              ? {
                  create: source.sections.map((section) => ({
                    id: `revision_section_${randomUUID()}`,
                    sectionKey: section.sectionKey,
                    sectionType: section.sectionType,
                    order: section.order,
                    payload:
                      section.payload === null
                        ? Prisma.JsonNull
                        : (section.payload as Prisma.InputJsonValue),
                    payloadSchemaVersion: section.payloadSchemaVersion,
                    version: 1,
                    createdAt: input.now,
                    updatedAt: input.now,
                    mediaUsages: {
                      create: section.mediaUsages.map((usage) => ({
                        mediaId: usage.mediaId,
                        slot: usage.slot,
                        order: usage.order,
                        createdAt: input.now,
                      })),
                    },
                  })),
                }
              : undefined,
          },
        });
        await transaction.page.update({
          where: { id: page.id },
          data: { draftRevisionId: revision.id, updatedAt: input.now },
        });
        return toDomain(revision);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async saveDraft(input: {
    revision: PageRevision;
    expectedVersion: number;
  }): Promise<boolean> {
    return this.client.$transaction(
      async (transaction) => {
        const page = await transaction.page.findUnique({
          where: { id: input.revision.pageId },
          select: { draftRevisionId: true },
        });
        if (page?.draftRevisionId !== input.revision.id) return false;
        const result = await transaction.pageRevision.updateMany({
          where: {
            id: input.revision.id,
            pageId: input.revision.pageId,
            status: "DRAFT",
            version: input.expectedVersion,
          },
          data: revisionData(input.revision),
        });
        if (result.count === 1) {
          await transaction.page.update({
            where: { id: input.revision.pageId },
            data: { updatedAt: input.revision.updatedAt },
          });
        }
        return result.count === 1;
      },
      { isolationLevel: "Serializable" },
    );
  }

  async saveTransition(input: {
    revision: PageRevision;
    expectedVersion: number;
    publish: boolean;
  }): Promise<boolean> {
    return this.client.$transaction(
      async (transaction) => {
        const page = await transaction.page.findUnique({
          where: { id: input.revision.pageId },
          select: { publishedRevisionId: true, draftRevisionId: true },
        });
        if (page?.draftRevisionId !== input.revision.id) return false;
        const result = await transaction.pageRevision.updateMany({
          where: {
            id: input.revision.id,
            pageId: input.revision.pageId,
            version: input.expectedVersion,
            status: { in: [...PREVIOUS_STATUSES[input.revision.status]] },
          },
          data: revisionData(input.revision),
        });
        if (result.count !== 1) return false;
        if (!input.publish) {
          await transaction.page.update({
            where: { id: input.revision.pageId },
            data: { updatedAt: input.revision.updatedAt },
          });
          return true;
        }

        if (page.publishedRevisionId) {
          await transaction.pageRevision.updateMany({
            where: {
              id: page.publishedRevisionId,
              pageId: input.revision.pageId,
              status: "PUBLISHED",
            },
            data: {
              status: "SUPERSEDED",
              version: { increment: 1 },
              updatedAt: input.revision.updatedAt,
            },
          });
        }
        await transaction.page.update({
          where: { id: input.revision.pageId },
          data: {
            title: input.revision.title,
            lifecycle: "PUBLISHED",
            publishedAt: input.revision.publishedAt,
            publishedRevisionId: input.revision.id,
            draftRevisionId: null,
            version: { increment: 1 },
            updatedAt: input.revision.updatedAt,
          },
        });
        return true;
      },
      { isolationLevel: "Serializable" },
    );
  }
}

function revisionData(
  revision: PageRevision,
): Prisma.PageRevisionUncheckedUpdateManyInput {
  return {
    status: revision.status,
    title: revision.title,
    seoTitle: revision.seoTitle,
    seoDescription: revision.seoDescription,
    ogImageMediaId: revision.ogImageMediaId,
    version: revision.version,
    reviewedById: revision.reviewedById,
    publishedById: revision.publishedById,
    reviewedAt: revision.reviewedAt,
    publishedAt: revision.publishedAt,
    updatedAt: revision.updatedAt,
  };
}

function toDomain(record: PrismaPageRevision): PageRevision {
  return Object.freeze({
    ...record,
    status: record.status as PageRevisionStatus,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
    publishedAt: record.publishedAt ? new Date(record.publishedAt) : null,
  });
}
