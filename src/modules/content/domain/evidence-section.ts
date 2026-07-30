type PageSectionPayload = Readonly<Record<string, unknown>>;

export const EVIDENCE_SECTION_TYPES = ["CASE_STUDY", "TESTIMONIAL"] as const;
export type EvidenceSectionType = (typeof EVIDENCE_SECTION_TYPES)[number];

const PUBLIC_STATUSES = new Set(["Approved", "Published"]);
const EVIDENCE_CLASSES = new Set([
  "Deliverable",
  "Outcome",
  "Before/after",
  "Testimonial",
  "Process evidence",
  "Capability evidence",
]);

export type EvidencePublicationError = Readonly<{
  field: string;
  message: string;
}>;

export function isEvidenceSectionType(
  type: string,
): type is EvidenceSectionType {
  return EVIDENCE_SECTION_TYPES.includes(type as EvidenceSectionType);
}

export function evidencePublicationErrors(
  type: EvidenceSectionType,
  payload: PageSectionPayload,
): readonly EvidencePublicationError[] {
  const errors: EvidencePublicationError[] = [];
  const required = (field: string, label: string) => {
    if (!value(payload, field))
      errors.push({ field, message: `${label} est requis.` });
  };

  required("title", "Le titre");
  required("claimOwner", "Le responsable de la preuve");
  required("sourceLocation", "La source");
  required("sourceOwner", "Le responsable de la source");
  required("verificationDate", "La date de vérification");
  required(
    "attributionPermission",
    "L’autorisation d’attribution ou d’anonymisation",
  );
  required("mediaRights", "Le statut des droits média");
  required("accessibleAlternative", "L’alternative accessible");
  required("relatedService", "Le service ou la capacité liée");
  required("label", "Le libellé de l’action");
  required("href", "Le lien de l’action");

  const status = value(payload, "evidenceStatus");
  if (!PUBLIC_STATUSES.has(status)) {
    errors.push({
      field: "evidenceStatus",
      message: "La preuve doit être approuvée avant publication.",
    });
  }
  const evidenceClass = value(payload, "evidenceClass");
  if (!EVIDENCE_CLASSES.has(evidenceClass)) {
    errors.push({
      field: "evidenceClass",
      message: "La classe de preuve est invalide.",
    });
  }

  if (type === "CASE_STUDY") {
    required("context", "Le contexte et le défi vérifiés");
    required("scope", "Le périmètre approuvé");
    required("evidence", "La preuve du travail ou du processus");
    required("outcome", "Le résultat ou traitement qualitatif");
    required("outcomeTreatment", "Le niveau d’attribution du résultat");
  } else {
    required("quote", "Le témoignage approuvé");
    required("attribution", "Le niveau d’attribution du témoignage");
  }

  if (value(payload, "mediaId") && !value(payload, "mediaCredit")) {
    errors.push({
      field: "mediaCredit",
      message: "Le crédit du média est requis.",
    });
  }
  return errors;
}

export function isEvidencePublishable(
  type: EvidenceSectionType,
  payload: PageSectionPayload,
): boolean {
  return evidencePublicationErrors(type, payload).length === 0;
}

export function evidenceValue(
  payload: PageSectionPayload,
  field: string,
): string {
  return value(payload, field);
}

function value(payload: PageSectionPayload, field: string): string {
  return typeof payload[field] === "string" ? payload[field].trim() : "";
}
