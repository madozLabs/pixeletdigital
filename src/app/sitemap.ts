import type { MetadataRoute } from "next";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listPublishedServices } from "@/modules/content/application/public/list-published-services";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { getSiteUrl } from "./_lib/site-url";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const [pages, services] = await Promise.all([
    prisma.page
      .findMany({
        where: {
          lifecycle: "PUBLISHED",
          worldKey: { in: ["pixel-digital", "kwaliti-print"] },
        },
        select: {
          worldKey: true,
          slug: true,
          routePath: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
    listPublishedServices(
      {
        services: new PrismaServiceRepository(prisma),
        worlds: new PrismaWorldRepository(prisma),
      },
      { worldKey: "pixel-digital" },
    ).catch(() => []),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absolute(siteUrl, "/"), changeFrequency: "weekly", priority: 1 },
    {
      url: absolute(siteUrl, "/contact"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absolute(siteUrl, "/kwaliti-print"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absolute(siteUrl, "/kwaliti-print/devis"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
  const cmsEntries = pages.flatMap((page) => {
    const path =
      page.routePath ??
      (page.worldKey === "pixel-digital"
        ? page.slug === "accueil"
          ? "/"
          : `/${page.slug}`
        : page.slug === "accueil"
          ? "/kwaliti-print"
          : `/kwaliti-print/${page.slug}`);
    return path
      ? [
          {
            url: absolute(siteUrl, path),
            lastModified: page.updatedAt,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          },
        ]
      : [];
  });
  const serviceEntries = services.map((service) => ({
    url: absolute(siteUrl, `/services/${service.slug}`),
    lastModified: service.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return deduplicate([...staticEntries, ...cmsEntries, ...serviceEntries]);
}

function absolute(base: URL, path: string): string {
  return new URL(path, base).toString();
}

function deduplicate(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}
