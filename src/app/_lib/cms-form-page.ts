import { actorHasWorldAccess } from "@/app/workspace/_lib/authorization";
import { getWorkspaceRequestContext } from "@/app/workspace/get-workspace-context";
import { prisma } from "@/infrastructure/shared/prisma-client";

export type CmsFormPageContent = Readonly<{
  isPreview: boolean;
  eyebrow: string | null;
  title: string | null;
  text: string | null;
  facts: readonly string[];
  formEyebrow: string | null;
  formTitle: string | null;
}>;

const EMPTY_CONTENT: CmsFormPageContent = {
  isPreview: false,
  eyebrow: null,
  title: null,
  text: null,
  facts: [],
  formEyebrow: null,
  formTitle: null,
};

/** Loads CMS copy around a code-owned, validated system form. */
export async function getCmsFormPageContent(
  worldKey: "pixel-digital" | "kwaliti-print",
  slug: "contact" | "devis",
  previewRevisionId?: string,
): Promise<CmsFormPageContent> {
  if (previewRevisionId) {
    const context = await getWorkspaceRequestContext();
    if (!context?.actor || !actorHasWorldAccess(context.actor, worldKey)) {
      return EMPTY_CONTENT;
    }
  }

  const page = await prisma.page
    .findFirst({
      where: {
        worldKey,
        slug,
        pageKind: "SYSTEM",
        ...(previewRevisionId
          ? { draftRevisionId: previewRevisionId }
          : { lifecycle: "PUBLISHED" as const }),
      },
      include: {
        draftRevision: {
          include: { sections: { orderBy: { order: "asc" } } },
        },
        publishedRevision: {
          include: { sections: { orderBy: { order: "asc" } } },
        },
      },
    })
    .catch(() => null);
  if (!page) return EMPTY_CONTENT;

  const sections = previewRevisionId
    ? (page.draftRevision?.sections ?? [])
    : (page.publishedRevision?.sections ?? []);
  const hero = sections.find((section) => section.sectionType === "HERO");
  const form = sections.find((section) => section.sectionType === "FORM");
  const heroPayload = (hero?.payload ?? {}) as Record<string, unknown>;
  const formPayload = (form?.payload ?? {}) as Record<string, unknown>;

  return {
    isPreview: Boolean(previewRevisionId),
    eyebrow: stringValue(heroPayload, "eyebrow"),
    title: stringValue(heroPayload, "title"),
    text: stringValue(heroPayload, "text"),
    facts: itemTitles(formPayload),
    formEyebrow: stringValue(formPayload, "eyebrow"),
    formTitle: stringValue(formPayload, "title"),
  };
}

function stringValue(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function itemTitles(payload: Record<string, unknown>): readonly string[] {
  if (!Array.isArray(payload.items)) return [];
  return payload.items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const title = stringValue(item as Record<string, unknown>, "title");
    return title ? [title] : [];
  });
}
