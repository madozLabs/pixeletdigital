import Link from "next/link";
import Image from "next/image";

import {
  evidenceValue,
  isEvidencePublishable,
  type EvidenceSectionType,
} from "@/modules/content/domain/evidence-section";
import type { PageSectionPayload } from "@/modules/content/domain/page-section";

type EvidenceMedia = Readonly<{
  publicUrl: string;
  altText: string;
  mimeType: string;
}>;

export function EvidenceSection({
  type,
  payload,
  media,
}: Readonly<{
  type: EvidenceSectionType;
  payload: PageSectionPayload;
  media?: EvidenceMedia | null;
}>) {
  if (!isEvidencePublishable(type, payload)) return null;
  const value = (field: string) => evidenceValue(payload, field);

  if (type === "TESTIMONIAL") {
    return (
      <section
        className="cms-public-evidence cms-public-testimonial"
        aria-labelledby={`proof-${slug(value("title"))}`}
      >
        <p className="cms-public-evidence__eyebrow">Témoignage</p>
        <h2 id={`proof-${slug(value("title"))}`}>{value("title")}</h2>
        <blockquote>
          <p>“{value("quote")}”</p>
          <footer>— {value("attribution")}</footer>
        </blockquote>
        <EvidenceCta
          service={value("relatedService")}
          label={value("label")}
          href={value("href")}
        />
      </section>
    );
  }

  return (
    <section
      className="cms-public-evidence"
      aria-labelledby={`proof-${slug(value("title"))}`}
    >
      <p className="cms-public-evidence__eyebrow">Étude de cas</p>
      <h2 id={`proof-${slug(value("title"))}`}>{value("title")}</h2>
      {media?.mimeType.startsWith("image/") ? (
        <div className="cms-public-evidence__media">
          <Image
            src={media.publicUrl}
            alt={media.altText || value("accessibleAlternative")}
            fill
            sizes="(max-width: 760px) 100vw, 78rem"
          />
        </div>
      ) : null}
      <div className="cms-public-evidence__grid">
        <EvidenceItem title="Contexte" text={value("context")} />
        <EvidenceItem title="Périmètre" text={value("scope")} />
        <EvidenceItem title="Travail démontré" text={value("evidence")} />
        <EvidenceItem title="Résultat" text={value("outcome")} />
      </div>
      {value("limitations") ? (
        <p className="cms-public-evidence__limits">
          <strong>Contexte et limites :</strong> {value("limitations")}
        </p>
      ) : null}
      <EvidenceCta
        service={value("relatedService")}
        label={value("label")}
        href={value("href")}
      />
    </section>
  );
}

function EvidenceItem({
  title,
  text,
}: Readonly<{ title: string; text: string }>) {
  return (
    <div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function EvidenceCta({
  service,
  label,
  href,
}: Readonly<{ service: string; label: string; href: string }>) {
  return (
    <div className="cms-public-evidence__cta">
      <p>Service associé : {service}</p>
      <Link className="button button--primary" href={href}>
        {label}
      </Link>
    </div>
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "evidence"
  );
}
