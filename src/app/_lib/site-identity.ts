import { prisma } from "@/infrastructure/shared/prisma-client";
import { cache } from "react";
import {
  defaultSiteIdentity,
  validateSiteIdentityConfig,
  type SiteIdentityConfig,
} from "@/modules/content/domain/site-identity";

export type PublishedSiteIdentity = SiteIdentityConfig &
  Readonly<{
    logoUrl: string | null;
    logoAlt: string;
    faviconUrl: string | null;
  }>;

export const getPublishedSiteIdentity = cache(
  async function getPublishedSiteIdentity(
    worldKey: string,
    displayName: string,
  ): Promise<PublishedSiteIdentity> {
    const fallback = defaultSiteIdentity(worldKey, displayName);
    const settings = await prisma.siteSettings
      .findUnique({
        where: { worldKey },
        include: { publishedRevision: true },
      })
      .catch(() => null);
    const parsed = validateSiteIdentityConfig(
      (settings?.publishedRevision?.config as Record<string, unknown> | null) ??
        fallback,
    );
    const config = parsed.ok ? parsed.value : fallback;
    const mediaIds = [config.logoMediaId, config.faviconMediaId].filter(
      Boolean,
    );
    const media = mediaIds.length
      ? await prisma.mediaAsset
          .findMany({
            where: { id: { in: mediaIds }, worldKey },
            select: { id: true, publicUrl: true, altText: true },
          })
          .catch(() => [])
      : [];
    const byId = new Map(media.map((asset) => [asset.id, asset]));
    const logo = byId.get(config.logoMediaId);
    const favicon = byId.get(config.faviconMediaId);
    return {
      ...config,
      logoUrl: logo?.publicUrl ?? null,
      logoAlt: logo?.altText || config.siteName,
      faviconUrl: favicon?.publicUrl ?? null,
    };
  },
);

export function siteFontValue(font: SiteIdentityConfig["headingFont"]): string {
  if (font === "MANROPE") return "var(--font-manrope), system-ui, sans-serif";
  if (font === "BALOO") return "var(--font-baloo), system-ui, sans-serif";
  if (font === "SYSTEM") return "system-ui, sans-serif";
  return "var(--font-outfit), system-ui, sans-serif";
}
