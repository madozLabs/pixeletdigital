export type KwalitiQuoteDetailsInput = Readonly<{
  quantity: string;
  format: string;
  material: string;
  desiredDeadline: string;
  finishing: string;
}>;

export type QuoteDetailsResult =
  | Readonly<{ ok: true; value: string }>
  | Readonly<{
      ok: false;
      fieldErrors: Readonly<Record<string, string>>;
    }>;

const DETAIL_MAX_LENGTH = 160;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function buildKwalitiQuoteMessage(
  message: string,
  input: KwalitiQuoteDetailsInput,
): QuoteDetailsResult {
  const values = {
    quantity: input.quantity.trim(),
    format: input.format.trim(),
    material: input.material.trim(),
    desiredDeadline: input.desiredDeadline.trim(),
    finishing: input.finishing.trim(),
  };
  const fieldErrors: Record<string, string> = {};

  if (values.quantity) {
    const quantity = Number(values.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
      fieldErrors.quantity =
        "Indiquez une quantité entière comprise entre 1 et 1 000 000.";
    }
  }
  for (const [field, value] of Object.entries(values)) {
    if (
      field !== "quantity" &&
      field !== "desiredDeadline" &&
      value.length > DETAIL_MAX_LENGTH
    ) {
      fieldErrors[field] = "Ce champ ne peut pas dépasser 160 caractères.";
    }
  }
  if (values.desiredDeadline && !isValidDate(values.desiredDeadline)) {
    fieldErrors.desiredDeadline = "Indiquez une date souhaitée valide.";
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const structuredMessage = [
    "[Brief devis Kwaliti Print]",
    `Quantité : ${values.quantity || "Non renseignée"}`,
    `Format : ${values.format || "Non renseigné"}`,
    `Matière : ${values.material || "Non renseignée"}`,
    `Délai souhaité : ${values.desiredDeadline || "Non renseigné"}`,
    `Finition : ${values.finishing || "Non renseignée"}`,
    "",
    "[Message]",
    message.trim(),
  ].join("\n");

  if (structuredMessage.length > 4000) {
    return {
      ok: false,
      fieldErrors: {
        message:
          "Votre message et les précisions du devis dépassent 4000 caractères.",
      },
    };
  }
  return { ok: true, value: structuredMessage };
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
