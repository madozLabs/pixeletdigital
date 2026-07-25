import { prisma } from "@/infrastructure/shared/prisma-client";

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
  hero: CmsHeroContent | null;
  closing: CmsClosingContent | null;
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
): Promise<CmsHomeContent> {
  const page = await prisma.page
    .findFirst({
      where: { worldKey, slug: HOME_SLUG, lifecycle: "PUBLISHED" },
      include: { sections: { orderBy: { order: "asc" } } },
    })
    .catch(() => null);
  if (!page) return { hero: null, closing: null };

  const mediaIds = page.sections.flatMap((section) => {
    const payload = section.payload as Record<string, unknown>;
    return typeof payload.mediaId === "string" && payload.mediaId
      ? [payload.mediaId]
      : [];
  });
  const media = mediaIds.length
    ? await prisma.mediaAsset
        .findMany({ where: { id: { in: mediaIds } } })
        .catch(() => [])
    : [];
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));

  let hero: CmsHeroContent | null = null;
  let closing: CmsClosingContent | null = null;

  for (const section of page.sections) {
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
  }

  return { hero, closing };
}
