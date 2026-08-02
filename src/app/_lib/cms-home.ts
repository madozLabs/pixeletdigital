import { prisma } from "@/infrastructure/shared/prisma-client";
import { actorHasWorldAccess } from "@/app/workspace/_lib/authorization";
import { getWorkspaceRequestContext } from "@/app/workspace/get-workspace-context";
import { publishDueScheduledRevisions } from "@/modules/content/application/publish-scheduled-revisions";

export type CmsHeroContent = Readonly<{
  eyebrow: string | null;
  titleLines: readonly string[];
  lede: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  imageAlt: string;
}>;

export type CmsClosingContent = Readonly<{
  kicker: string | null;
  title: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}>;

export type CmsHomeContent = Readonly<{
  sections: readonly CmsHomeSection[];
  mediaAssets: readonly CmsHomeMediaAsset[];
  hero: CmsHeroContent | null;
  closing: CmsClosingContent | null;
  manifesto: CmsCopyBlock | null;
  serviceIndex: CmsCopyBlock | null;
  steps: CmsItemsBlock | null;
  featureGrid: CmsItemsBlock | null;
  media: CmsActionBlock | null;
  seo: CmsHomeSeo | null;
}>;

export type CmsHomeSeo = Readonly<{
  title: string | null;
  description: string | null;
  ogImageUrl: string | null;
}>;

export type CmsHomeSection = Readonly<{
  id: string;
  sectionType: string;
  order: number;
  payload: Readonly<Record<string, unknown>>;
}>;

export type CmsHomeMediaAsset = Readonly<{
  id: string;
  publicUrl: string;
  altText: string;
  mimeType: string;
}>;

export type CmsCopyBlock = Readonly<{
  eyebrow: string | null;
  title: string | null;
  text: string | null;
}>;

export type CmsActionBlock = CmsCopyBlock &
  Readonly<{ ctaLabel: string | null; ctaHref: string | null }>;

export type CmsItemsBlock = CmsCopyBlock &
  Readonly<{
    items: readonly Readonly<{ title: string; text: string }>[];
  }>;

const HOME_SLUG = "accueil";

function str(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Reads the PUBLISHED "accueil" CMS page of a world and extracts the
 * hero/closing overrides. Returns empty overrides when the CMS page or a
 * section is absent so callers can keep their hardcoded fallback copy.
 */
export async function getCmsHomeContent(
  worldKey: string,
  previewRevisionId?: string,
): Promise<CmsHomeContent> {
  if (previewRevisionId) {
    const context = await getWorkspaceRequestContext();
    if (!context?.actor || !actorHasWorldAccess(context.actor, worldKey)) {
      return emptyHomeContent();
    }
  }
  if (!previewRevisionId) {
    await publishDueScheduledRevisions(prisma, worldKey, new Date()).catch(
      () => 0,
    );
  }
  const page = await prisma.page
    .findFirst({
      where: {
        worldKey,
        slug: HOME_SLUG,
        ...(previewRevisionId
          ? { draftRevisionId: previewRevisionId }
          : { lifecycle: "PUBLISHED" as const }),
      },
      include: {
        draftRevision: {
          include: { sections: { orderBy: { order: "asc" } }, ogImage: true },
        },
        publishedRevision: {
          include: { sections: { orderBy: { order: "asc" } }, ogImage: true },
        },
      },
    })
    .catch(() => null);
  if (!page) return emptyHomeContent();

  const activeRevision = previewRevisionId
    ? page.draftRevision
    : page.publishedRevision;
  const sections = activeRevision?.sections ?? [];
  const seo: CmsHomeSeo | null = activeRevision
    ? {
        title: activeRevision.seoTitle,
        description: activeRevision.seoDescription,
        ogImageUrl: activeRevision.ogImage?.publicUrl ?? null,
      }
    : null;
  const mediaIds = sections.flatMap((section) => {
    const payload = section.payload as Record<string, unknown>;
    return [
      ...(typeof payload.mediaId === "string" && payload.mediaId
        ? [payload.mediaId]
        : []),
      ...(typeof payload.backgroundMediaId === "string" &&
      payload.backgroundMediaId
        ? [payload.backgroundMediaId]
        : []),
      ...(Array.isArray(payload.mediaIds)
        ? payload.mediaIds.filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          )
        : []),
    ];
  });
  const media = mediaIds.length
    ? await prisma.mediaAsset
        .findMany({ where: { id: { in: mediaIds } } })
        .catch(() => [])
    : [];
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));

  let hero: CmsHeroContent | null = null;
  let closing: CmsClosingContent | null = null;
  let manifesto: CmsCopyBlock | null = null;
  let serviceIndex: CmsCopyBlock | null = null;
  let steps: CmsItemsBlock | null = null;
  let featureGrid: CmsItemsBlock | null = null;
  let mediaBlock: CmsActionBlock | null = null;

  for (const section of sections) {
    const payload = section.payload as Record<string, unknown>;
    if (section.sectionType === "HERO" && !hero) {
      const asset = str(payload, "mediaId")
        ? mediaById.get(String(payload.mediaId))
        : null;
      const image = asset?.mimeType.startsWith("image/") ? asset : null;
      hero = {
        eyebrow: str(payload, "eyebrow"),
        titleLines: (str(payload, "title") ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        lede: str(payload, "text"),
        ctaLabel: str(payload, "label"),
        ctaHref: str(payload, "href"),
        imageUrl: image?.publicUrl ?? null,
        imageAlt: image?.altText ?? "",
      };
    }
    if (section.sectionType === "CTA" && !closing) {
      closing = {
        kicker: str(payload, "eyebrow"),
        title: str(payload, "title"),
        ctaLabel: str(payload, "label"),
        ctaHref: str(payload, "href"),
      };
    }
    const copy = {
      eyebrow: str(payload, "eyebrow"),
      title: str(payload, "title"),
      text: str(payload, "text"),
    };
    if (
      (section.sectionType === "RICH_TEXT" || section.sectionType === "TEXT") &&
      !manifesto
    ) {
      manifesto = copy;
    }
    if (section.sectionType === "SERVICE_INDEX" && !serviceIndex) {
      serviceIndex = copy;
    }
    if (section.sectionType === "STEPS" && !steps) {
      steps = { ...copy, items: items(payload) };
    }
    if (section.sectionType === "FEATURE_GRID" && !featureGrid) {
      featureGrid = { ...copy, items: items(payload) };
    }
    if (section.sectionType === "MEDIA" && !mediaBlock) {
      mediaBlock = {
        ...copy,
        ctaLabel: str(payload, "label"),
        ctaHref: str(payload, "href"),
      };
    }
  }

  return {
    sections: sections.map((section) => ({
      id: section.id,
      sectionType: section.sectionType,
      order: section.order,
      payload: section.payload as Record<string, unknown>,
    })),
    mediaAssets: media.map((asset) => ({
      id: asset.id,
      publicUrl: asset.publicUrl,
      altText: asset.altText,
      mimeType: asset.mimeType,
    })),
    hero,
    closing,
    manifesto,
    serviceIndex,
    steps,
    featureGrid,
    media: mediaBlock,
    seo,
  };
}

export function emptyHomeContent(): CmsHomeContent {
  return {
    sections: [],
    mediaAssets: [],
    hero: null,
    closing: null,
    manifesto: null,
    serviceIndex: null,
    steps: null,
    featureGrid: null,
    media: null,
    seo: null,
  };
}

function items(payload: Record<string, unknown>) {
  return Array.isArray(payload.items)
    ? payload.items.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        return [
          {
            title: str(record, "title") ?? "",
            text: str(record, "text") ?? "",
          },
        ];
      })
    : [];
}
