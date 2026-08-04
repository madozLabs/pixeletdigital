import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "@/app/workspace/get-workspace-context";
import { actorHasWorldAccess } from "@/app/workspace/_lib/authorization";
import { publishDueScheduledRevisions } from "@/modules/content/application/publish-scheduled-revisions";
import { recordPageView } from "@/modules/content/application/record-page-view";
import { CmsPreviewBridge } from "@/app/_components/cms-preview-bridge";
import { resolveEffectiveSection } from "@/modules/content/domain/global-component-resolution";
import { CmsSection, stringValue } from "../_components/cms-section";

// See (marketing)/page.tsx for why this is ISR rather than force-dynamic.
export const revalidate = 60;

type Props = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    preview?: string;
    world?: string;
    visualEditor?: string;
    share?: string;
  }>;
}>;

async function loadPage(
  worldKey: "pixel-digital" | "kwaliti-print",
  slug: string,
  previewRevisionId?: string,
  shareToken?: string,
) {
  if (shareToken) {
    const share = await prisma.pagePreviewShare
      .findUnique({ where: { token: shareToken }, include: { page: true } })
      .catch(() => null);
    if (!share || share.revokedAt || share.expiresAt < new Date()) return null;
    if (share.page.worldKey !== worldKey || share.page.slug !== slug) {
      return null;
    }
    const revision = await prisma.pageRevision
      .findUnique({
        where: { id: share.revisionId },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: { globalComponent: { include: { sourceSection: true } } },
          },
          ogImage: true,
        },
      })
      .catch(() => null);
    if (!revision) return null;
    return { ...share.page, draftRevision: revision, publishedRevision: null };
  }
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
          draftRevision: {
            include: {
              sections: {
                orderBy: { order: "asc" },
                include: {
                  globalComponent: { include: { sourceSection: true } },
                },
              },
              ogImage: true,
            },
          },
          publishedRevision: {
            include: {
              sections: {
                orderBy: { order: "asc" },
                include: {
                  globalComponent: { include: { sourceSection: true } },
                },
              },
              ogImage: true,
            },
          },
        },
      })
      .catch(() => null);
  }
  await publishDueScheduledRevisions(prisma, worldKey, new Date()).catch(
    () => 0,
  );
  return prisma.page
    .findFirst({
      where: { worldKey, slug, lifecycle: "PUBLISHED" },
      include: {
        draftRevision: {
          include: {
            sections: {
              orderBy: { order: "asc" },
              include: {
                globalComponent: { include: { sourceSection: true } },
              },
            },
            ogImage: true,
          },
        },
        publishedRevision: {
          include: {
            sections: {
              orderBy: { order: "asc" },
              include: {
                globalComponent: { include: { sourceSection: true } },
              },
            },
            ogImage: true,
          },
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
  const { preview, world, share } = await searchParams;
  const worldKey =
    world === "kwaliti-print" ? "kwaliti-print" : "pixel-digital";
  const page = await loadPage(worldKey, slug, preview, share);
  if (!page) {
    return {
      title: "Page",
      description: "Découvrez Pixel&Digital, ses expertises et son approche.",
      robots: { index: false, follow: false },
    };
  }
  const revision = preview || share ? page.draftRevision : page.publishedRevision;
  const sections = (revision?.sections ?? []).map(resolveEffectiveSection);
  const description =
    revision?.seoDescription ||
    sections
      .map((section) =>
        stringValue(section.payload as Record<string, unknown>, "text"),
      )
      .find(Boolean) ||
    `Découvrez ${page.title} par Pixel&Digital.`;
  const title = revision?.seoTitle || page.title;
  const canonicalPath =
    worldKey === "kwaliti-print" ? `/kwaliti-print/${slug}` : `/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      images: revision?.ogImage ? [{ url: revision.ogImage.publicUrl }] : undefined,
    },
    robots: preview || share ? { index: false, follow: false } : undefined,
  };
}

export default async function CmsPublicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview, world, visualEditor, share } = await searchParams;
  const worldKey =
    world === "kwaliti-print" ? "kwaliti-print" : "pixel-digital";
  // The "accueil" page feeds the real home hero; avoid a duplicate route.
  if (slug === "accueil" && !preview && !share) {
    redirect(worldKey === "kwaliti-print" ? "/kwaliti-print" : "/");
  }
  const page = await loadPage(worldKey, slug, preview, share);
  if (!page) notFound();
  if (!preview && !share) recordPageView(prisma, page.id);

  const sections = (
    preview || share
      ? (page.draftRevision?.sections ?? [])
      : (page.publishedRevision?.sections ?? [])
  ).map(resolveEffectiveSection);
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
      ) : share ? (
        <aside className="cms-preview-banner">
          Aperçu partagé · aucune modification n’est encore publique
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
