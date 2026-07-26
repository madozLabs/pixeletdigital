import { describe, expect, it } from "vitest";

import {
  evidencePublicationErrors,
  isEvidencePublishable,
} from "./evidence-section";

const common = {
  title: "Preuve approuvée",
  claimOwner: "Responsable contenu",
  sourceLocation: "Référence interne contrôlée",
  sourceOwner: "Responsable projet",
  verificationDate: "2026-07-26",
  attributionPermission: "Anonymisation approuvée",
  mediaRights: "Usage web approuvé",
  accessibleAlternative: "Description textuelle complète",
  relatedService: "Conseil",
  label: "Parler d’un projet similaire",
  href: "/contact",
  evidenceStatus: "Approved",
};

describe("evidence publication gate", () => {
  it("accepts a governed deliverable-only case study", () => {
    expect(
      isEvidencePublishable("CASE_STUDY", {
        ...common,
        evidenceClass: "Deliverable",
        context: "Contexte vérifié",
        scope: "Périmètre approuvé",
        evidence: "Livrable contrôlé",
        outcome: "Présentation limitée au livrable, sans résultat revendiqué",
        outcomeTreatment: "Deliverable-only",
      }),
    ).toBe(true);
  });

  it("blocks a testimonial without approval, source or rights", () => {
    const errors = evidencePublicationErrors("TESTIMONIAL", {
      title: "Témoignage",
      quote: "Texte",
      attribution: "Anonyme",
      evidenceClass: "Testimonial",
      evidenceStatus: "Proposed",
    });
    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining([
        "evidenceStatus",
        "sourceLocation",
        "mediaRights",
      ]),
    );
  });
});
