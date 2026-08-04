import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "@/generated/prisma/client";

type SectionSeed = Readonly<{
  key: string;
  type: string;
  payload: Record<string, unknown>;
}>;

// Empty verification metadata means these evidence blocks stay unpublished
// (EvidenceSection returns null) until a real editor fills them in and
// approves through the workspace — see evidence-section.ts. We do not
// fabricate verified case studies or client testimonials here.
function draftEvidence(
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    title: "",
    claimOwner: "",
    sourceLocation: "",
    sourceOwner: "",
    verificationDate: "",
    attributionPermission: "",
    mediaRights: "",
    accessibleAlternative: "",
    relatedService: "",
    label: "",
    href: "",
    evidenceStatus: "",
    evidenceClass: "",
    mediaId: "",
    ...extra,
  };
}

function pxdSections(): readonly SectionSeed[] {
  return [
    {
      key: "hero",
      type: "HERO",
      payload: {
        eyebrow: "Agence créative & digitale",
        title: "Avec nous,\nil sera impossible\nde vous ignorer.",
        text: "Stratégie, identité, contenu, digital et production — une seule équipe, du positionnement jusqu'à l'objet fini. Basée à Ouagadougou, on construit des marques que l'Afrique de l'Ouest et au-delà ne peut pas ignorer.",
        label: "Lancer un projet",
        href: "/contact",
        mediaId: "",
      },
    },
    {
      key: "manifesto",
      type: "RICH_TEXT",
      payload: {
        eyebrow: "Notre façon de voir les choses",
        title:
          "Les likes paient rarement les factures.\nLes bonnes stratégies, si.",
        text: "",
      },
    },
    {
      key: "stats",
      type: "STATS",
      payload: {
        eyebrow: "En chiffres",
        title: "Ce qu'on peut prouver, pas juste affirmer.",
        text: "",
        items: [
          { title: "À compléter", text: "Années d'existence" },
          { title: "À compléter", text: "Marques accompagnées depuis Ouagadougou" },
          { title: "À compléter", text: "Secteurs couverts" },
          { title: "À compléter", text: "Délai moyen de livraison d'un site" },
        ],
      },
    },
    {
      key: "services",
      type: "SERVICE_INDEX",
      payload: {
        eyebrow: "Ce qu'on sait faire",
        title: "Une seule équipe pour faire avancer toute la marque.",
        source: "SERVICES",
      },
    },
    {
      key: "case-study",
      type: "CASE_STUDY",
      payload: draftEvidence({
        title: "Étude de cas phare — à compléter et faire valider",
      }),
    },
    {
      key: "method",
      type: "STEPS",
      payload: {
        eyebrow: "Une méthode simple",
        title: "On pense juste. On crée fort. On exécute proprement.",
        text: "",
        items: ["Comprendre", "Positionner", "Créer", "Déployer"].map(
          (title) => ({ title, text: "" }),
        ),
      },
    },
    {
      key: "portfolio",
      type: "SERVICE_INDEX",
      payload: {
        eyebrow: "Réalisations récentes",
        title: "Nos derniers projets, choisis pour ce qu'ils prouvent.",
        source: "PAGES",
        pageTypeFilter: "PORTFOLIO",
        limit: "6",
      },
    },
    {
      key: "testimonial-1",
      type: "TESTIMONIAL",
      payload: draftEvidence({
        title: "Témoignage 1 — à compléter et faire valider",
        quote: "",
        attribution: "",
      }),
    },
    {
      key: "testimonial-2",
      type: "TESTIMONIAL",
      payload: draftEvidence({
        title: "Témoignage 2 — à compléter et faire valider",
        quote: "",
        attribution: "",
      }),
    },
    {
      key: "testimonial-3",
      type: "TESTIMONIAL",
      payload: draftEvidence({
        title: "Témoignage 3 — à compléter et faire valider",
        quote: "",
        attribution: "",
      }),
    },
    {
      key: "kwaliti-promo",
      type: "MEDIA",
      payload: {
        eyebrow: "Notre bras production",
        title: "La stratégie ne s'arrête pas à l'écran.",
        text: "Kwaliti Print transforme vos idées en objets qu'on remarque.",
        label: "Découvrir Kwaliti Print",
        href: "/kwaliti-print",
        mediaId: "",
      },
    },
    {
      key: "faq",
      type: "ACCORDION",
      payload: {
        eyebrow: "Questions fréquentes",
        title: "Avant de nous écrire",
        text: "",
        items: [
          {
            title: "Combien de temps prend un projet ?",
            text: "Ça dépend du périmètre — on cadre un calendrier précis dès le premier échange, pas après signature.",
          },
          {
            title: "Travaillez-vous avec des marques en dehors de l'Afrique de l'Ouest ?",
            text: "Oui, la stratégie et l'exécution digitale se pilotent à distance sans difficulté.",
          },
          {
            title: "Qui s'occupe de l'impression si j'ai besoin de supports physiques ?",
            text: "Kwaliti Print, notre bras production — même équipe, même exigence, du fichier à l'objet fini.",
          },
        ],
      },
    },
    {
      key: "closing",
      type: "CTA",
      payload: {
        eyebrow:
          "Être partout ne sert à rien si personne ne se souvient de vous.",
        title: "Faisons quelque chose qu'on ne peut pas ignorer.",
        text: "",
        label: "Parler à Pixel&Digital",
        href: "/contact",
      },
    },
  ];
}

function kwalitiSections(): readonly SectionSeed[] {
  return [
    {
      key: "hero",
      type: "HERO",
      payload: {
        eyebrow: "Impression · Personnalisation · Production",
        title: "Vos idées.\nImprimées comme il faut.",
        text: "Le bras production de Pixel&Digital. Cartes, brochures, packaging, grand format — chaque pièce sort avec la même exigence de couleur, de matière et de finition. Ce que vous avez conçu à l'écran, on le rend réel sans compromis.",
        label: "Obtenir un devis",
        href: "/kwaliti-print/devis",
        mediaId: "",
      },
    },
    {
      key: "product-families",
      type: "SERVICE_INDEX",
      payload: {
        eyebrow: "Ce qu'on produit",
        title: "Des univers de produits, pas une liste de prix.",
        source: "SERVICES",
      },
    },
    {
      key: "matiere",
      type: "GALLERY",
      payload: {
        eyebrow: "La matière",
        title: "Le grain, la tranche, la finition — jugez sur pièce.",
        text: "",
        mediaIds: [],
      },
    },
    {
      key: "stats-production",
      type: "STATS",
      payload: {
        eyebrow: "En production",
        title: "Ce qu'on peut prouver, pas juste affirmer.",
        text: "",
        items: [
          { title: "À compléter", text: "Capacité grand format" },
          { title: "À compléter", text: "Délai moyen de production" },
          { title: "À compléter", text: "Taux de reprise qualité" },
        ],
      },
    },
    {
      key: "process",
      type: "STEPS",
      payload: {
        eyebrow: "Du fichier à l'objet",
        title: "Quatre étapes, zéro mauvaise surprise.",
        text: "",
        items: [
          {
            title: "Envoi du fichier",
            text: "Vous nous envoyez le fichier ou l'idée, même incomplète — on vous dit ce qu'il manque avant de lancer quoi que ce soit.",
          },
          {
            title: "Vérification & épreuve",
            text: "Contrôle technique et épreuve de validation avant impression — l'étape qui évite les mauvaises surprises.",
          },
          {
            title: "Production",
            text: "Impression et finition suivies de près, avec le même niveau d'exigence à chaque pièce.",
          },
          {
            title: "Livraison",
            text: "Réception sur place ou livraison, selon ce qui vous arrange.",
          },
        ],
      },
    },
    {
      key: "realisations",
      type: "CAROUSEL",
      payload: {
        eyebrow: "Réalisations",
        title: "Des pièces sorties d'ici, pas d'un mockup.",
        text: "",
        mediaIds: [],
      },
    },
    {
      key: "pxd-link",
      type: "MEDIA",
      payload: {
        eyebrow: "Le lien avec Pixel&Digital",
        title: "La même équipe gère la conception.",
        text: "Kwaliti Print est le bras production de Pixel&Digital : la stratégie, l'identité et le design sortent du même atelier que l'impression.",
        label: "Découvrir Pixel&Digital",
        href: "/",
        mediaId: "",
      },
    },
    {
      key: "faq-production",
      type: "ACCORDION",
      payload: {
        eyebrow: "Questions fréquentes production",
        title: "Avant de commander",
        text: "",
        items: [
          {
            title: "Quels formats de fichiers acceptez-vous ?",
            text: "Les formats standards d'impression professionnelle — on vous confirme le détail selon votre projet lors de la vérification.",
          },
          {
            title: "Y a-t-il une quantité minimale de commande ?",
            text: "Ça dépend du support. Dites-nous ce que vous avez en tête, on vous répond franchement, pas par un tableau générique.",
          },
          {
            title: "Combien de temps avant réception ?",
            text: "Le délai dépend du support et de la finition — il vous est confirmé avant validation de la commande, jamais après.",
          },
        ],
      },
    },
    {
      key: "closing",
      type: "CTA",
      payload: {
        eyebrow: "Un besoin précis ou juste une idée ?",
        title: "On vous aide à choisir la bonne manière de l'imprimer.",
        text: "",
        label: "Obtenir un devis",
        href: "/kwaliti-print/devis",
      },
    },
  ];
}

async function replaceHomeSections(
  client: PrismaClient,
  pageId: string,
  sections: readonly SectionSeed[],
): Promise<{ revisionNumber: number }> {
  return client.$transaction(
    async (transaction) => {
      const page = await transaction.page.findUniqueOrThrow({
        where: { id: pageId },
        select: { id: true, title: true, publishedRevisionId: true },
      });
      const aggregate = await transaction.pageRevision.aggregate({
        where: { pageId },
        _max: { revisionNumber: true },
      });
      const revisionNumber = (aggregate._max.revisionNumber ?? 0) + 1;
      const now = new Date();
      const revisionId = `revision_${randomUUID()}`;

      await transaction.pageRevision.create({
        data: {
          id: revisionId,
          pageId,
          revisionNumber,
          status: "PUBLISHED",
          title: page.title,
          version: 1,
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
          sections: {
            create: sections.map((section, order) => ({
              id: `revision_section_${randomUUID()}`,
              sectionKey: section.key,
              sectionType: section.type,
              order,
              payload: section.payload as Prisma.InputJsonValue,
              payloadSchemaVersion: 1,
              version: 1,
              createdAt: now,
              updatedAt: now,
            })),
          },
        },
      });

      if (page.publishedRevisionId) {
        await transaction.pageRevision.updateMany({
          where: { id: page.publishedRevisionId, pageId, status: "PUBLISHED" },
          data: { status: "SUPERSEDED", version: { increment: 1 }, updatedAt: now },
        });
      }

      await transaction.page.update({
        where: { id: pageId },
        data: {
          lifecycle: "PUBLISHED",
          publishedAt: now,
          publishedRevisionId: revisionId,
          version: { increment: 1 },
          updatedAt: now,
        },
      });

      return { revisionNumber };
    },
    { isolationLevel: "Serializable" },
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run this migration.");
  }
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const pxd = await replaceHomeSections(
      client,
      "a3e94834-1c7f-46df-953b-c5b00daf4ab8",
      pxdSections(),
    );
    console.log(
      `Pixel&Digital home: published revision #${pxd.revisionNumber} with ${pxdSections().length} sections.`,
    );
    const kwl = await replaceHomeSections(
      client,
      "9fd3677b-e35f-4be2-8b89-1cafb8c7736a",
      kwalitiSections(),
    );
    console.log(
      `Kwaliti Print home: published revision #${kwl.revisionNumber} with ${kwalitiSections().length} sections.`,
    );
    console.log(
      "Note: CASE_STUDY and TESTIMONIAL blocks were created empty (draft evidence) -- they stay hidden on the public site until a real editor fills and approves them in the workspace.",
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
