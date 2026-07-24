/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";

export const dynamic = "force-dynamic";

type Props = Readonly<{ params: Promise<{ slug: string }> }>;

async function loadPage(slug: string) {
  return prisma.page
    .findFirst({
      where: { worldKey: "pixel-digital", slug, lifecycle: "PUBLISHED" },
      include: { sections: { orderBy: { order: "asc" } } },
    })
    .catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await loadPage((await params).slug);
  return page ? { title: page.title } : { title: "Page" };
}

export default async function CmsPublicPage({ params }: Props) {
  const page = await loadPage((await params).slug);
  if (!page) notFound();

  const mediaIds = page.sections.flatMap((section) => {
    const payload = section.payload as Record<string, unknown>;
    return typeof payload.mediaId === "string" ? [payload.mediaId] : [];
  });
  const media = mediaIds.length
    ? await prisma.mediaAsset.findMany({ where: { id: { in: mediaIds } } })
    : [];
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));

  return (
    <main id="main-content" className="cms-public-page">
      {page.sections.map((section) => (
        <CmsSection
          key={section.id}
          type={section.sectionType}
          payload={section.payload as Record<string, unknown>}
          mediaById={mediaById}
        />
      ))}
    </main>
  );
}
type MediaRecord = Awaited<
  ReturnType<typeof prisma.mediaAsset.findMany>
>[number];

function stringValue(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? payload[key] : "";
}

function CmsSection({
  type,
  payload,
  mediaById,
}: {
  type: string;
  payload: Record<string, unknown>;
  mediaById: Map<string, MediaRecord>;
}) {
  const title = stringValue(payload, "title");
  const text = stringValue(payload, "text");
  const eyebrow = stringValue(payload, "eyebrow");
  const href = stringValue(payload, "href") || "/contact";
  const label = stringValue(payload, "label") || "Lancer un projet";
  const mediaId = stringValue(payload, "mediaId");
  const asset = mediaId ? mediaById.get(mediaId) : null;

  if (type === "HERO")
    return (
      <section className="cms-public-hero">
        <div>
          {eyebrow ? <p>{eyebrow}</p> : null}
          <h1>{title}</h1>
          {text ? <p>{text}</p> : null}
          <Link className="button button--primary" href={href}>
            {label}
          </Link>
        </div>
        {asset?.mimeType.startsWith("image/") ? (
          <img src={asset.publicUrl} alt={asset.altText} />
        ) : null}
      </section>
    );

  if (type === "MEDIA")
    return (
      <section className="cms-public-section cms-public-media">
        {asset?.mimeType.startsWith("image/") ? (
          <img src={asset.publicUrl} alt={asset.altText} />
        ) : null}
        <div>
          {eyebrow ? <p>{eyebrow}</p> : null}
          <h2>{title}</h2>
          {text ? <p>{text}</p> : null}
        </div>
      </section>
    );

  if (type === "CTA")
    return (
      <section className="cms-public-cta">
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
        <Link className="button button--primary" href={href}>
          {label}
        </Link>
      </section>
    );

  return (
    <section className="cms-public-section">
      {eyebrow ? <p>{eyebrow}</p> : null}
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </section>
  );
}
