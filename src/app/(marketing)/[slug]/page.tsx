import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "@/app/workspace/get-workspace-context";
import { actorHasWorldAccess } from "@/app/workspace/_lib/authorization";
import { CmsPreviewBridge } from "@/app/_components/cms-preview-bridge";
import { CmsSection, stringValue } from "../_components/cms-section";

// See (marketing)/page.tsx for why this is ISR rather than force-dynamic.
export const revalidate = 60;

type Props = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    preview?: string;
    world?: string;
    visualEditor?: string;
  }>;
}>;

async function loadPage(
  worldKey: "pixel-digital" | "kwaliti-print",
  slug: string,
  previewRevisionId?: string,
) {
  if (previewRevisionId) {
    const context = await getWorkspaceRequestContext();
    if (!context?.actor || !actorHasWorldAccess(context.actor, worldKey)) {
      return null;
    }
    return prisma.page
      .findFirst({
        where: {
          worldKey,
          slug,
          draftRevisionId: previewRevisionId,
        },
        include: {
          sections: { orderBy: { order: "asc" } },
          draftRevision: {
            include: { sections: { orderBy: { order: "asc" } } },
          },
          publishedRevision: {
            include: { sections: { orderBy: { order: "asc" } } },
          },
        },
      })
      .catch(() => null);
  }
  return prisma.page
    .findFirst({
      where: { worldKey, slug, lifecycle: "PUBLISHED" },
      include: {
        sections: { orderBy: { order: "asc" } },
        draftRevision: {
          include: { sections: { orderBy: { order: "asc" } } },
        },
        publishedRevision: {
          include: { sections: { orderBy: { order: "asc" } } },
        },
      },
    })
    .catch(() => null);
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const { preview, world } = await searchParams;
  const worldKey =
    world === "kwaliti-print" ? "kwaliti-print" : "pixel-digital";
  const page = await loadPage(worldKey, slug, preview);
  if (!page) {
    return {
      title: "Page",
      description: "Découvrez Pixel&Digital, ses expertises et son approche.",
      robots: { index: false, follow: false },
    };
  }
  const sections = preview
    ? (page.draftRevision?.sections ?? page.sections)
    : (page.publishedRevision?.sections ?? page.sections);
  const description =
    sections
      .map((section) =>
        stringValue(section.payload as Record<string, unknown>, "text"),
      )
      .find(Boolean) || `Découvrez ${page.title} par Pixel&Digital.`;
  return {
    title: page.title,
    description,
    alternates: {
      canonical:
        worldKey === "kwaliti-print" ? `/kwaliti-print/${slug}` : `/${slug}`,
    },
    openGraph: {
      title: page.title,
      description,
      url: worldKey === "kwaliti-print" ? `/kwaliti-print/${slug}` : `/${slug}`,
      type: "website",
    },
    robots: preview ? { index: false, follow: false } : undefined,
  };
}

export default async function CmsPublicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview, world, visualEditor } = await searchParams;
  const worldKey =
    world === "kwaliti-print" ? "kwaliti-print" : "pixel-digital";
  // The "accueil" page feeds the real home hero; avoid a duplicate route.
  if (slug === "accueil" && !preview) {
    redirect(worldKey === "kwaliti-print" ? "/kwaliti-print" : "/");
  }
  const page = await loadPage(worldKey, slug, preview);
  if (!page) notFound();

  const sections = preview
    ? (page.draftRevision?.sections ?? page.sections)
    : (page.publishedRevision?.sections ?? page.sections);
  const mediaIds = sections.flatMap((section) => {
    const payload = section.payload as Record<string, unknown>;
    return [
      ...(typeof payload.mediaId === "string" ? [payload.mediaId] : []),
      ...(typeof payload.backgroundMediaId === "string"
        ? [payload.backgroundMediaId]
        : []),
      ...(Array.isArray(payload.mediaIds)
        ? payload.mediaIds.filter((id): id is string => typeof id === "string")
        : []),
    ];
  });
  const media = mediaIds.length
    ? await prisma.mediaAsset
        .findMany({ where: { id: { in: mediaIds } } })
        .catch(() => [])
    : [];
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const services = sections.some(
    (section) => section.sectionType === "SERVICE_INDEX",
  )
    ? await prisma.service.findMany({
        where: { worldKey: page.worldKey, lifecycle: "PUBLISHED" },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <main id="main-content" className="cms-public-page">
      {visualEditor === "1" ? <CmsPreviewBridge /> : null}
      {preview ? (
        <aside className="cms-preview-banner">
          Aperçu privé · aucune modification n’est encore publique
        </aside>
      ) : null}
      {sections.map((section) => (
        <CmsSection
          key={section.id}
          sectionId={section.id}
          type={section.sectionType}
          payload={section.payload as Record<string, unknown>}
          mediaById={mediaById}
          services={services}
          worldKey={worldKey}
          editing={visualEditor === "1"}
        />
      ))}
    </main>
  );
}
