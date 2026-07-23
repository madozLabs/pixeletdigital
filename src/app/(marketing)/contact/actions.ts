"use server";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { submitGeneralContact } from "@/modules/enquiries/application/submit-general-contact";
import { PrismaEnquiryRepository } from "@/modules/enquiries/infrastructure/prisma-enquiry-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

export type ContactFormState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "success"; receiptId: string }>
  | Readonly<{
      status: "error";
      message: string;
      fieldErrors: Readonly<Record<string, string>>;
    }>;

const FIELD_ERROR_BY_VALIDATION_CODE: Readonly<
  Record<string, Readonly<{ field: string; message: string }>>
> = {
  INVALID_NAME: { field: "name", message: "Merci d'indiquer votre nom." },
  INVALID_EMAIL: {
    field: "email",
    message: "Merci d'indiquer une adresse e-mail valide.",
  },
  INVALID_PHONE: {
    field: "phone",
    message: "Ce numéro de téléphone n'est pas reconnu.",
  },
  INVALID_MESSAGE: {
    field: "message",
    message: "Merci de décrire votre demande (4000 caractères maximum).",
  },
  INVALID_RESPONSE: {
    field: "consent",
    message: "Merci d'accepter l'utilisation de vos informations.",
  },
};

function dependencies() {
  return {
    enquiries: new PrismaEnquiryRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
    services: new PrismaServiceRepository(prisma),
    clock: { now: () => new Date() },
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitContactAction(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const serviceSlug = text(formData, "serviceSlug").trim() || null;
  const worldKey = text(formData, "worldKey").trim() || "pixel-digital";

  const result = await submitGeneralContact(dependencies(), {
    id: crypto.randomUUID(),
    consentRecordId: crypto.randomUUID(),
    worldKey,
    serviceSlug,
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone").trim() || null,
    message: text(formData, "message"),
    sourcePage: text(formData, "sourcePage") || "/contact",
    idempotencyKey: text(formData, "idempotencyKey"),
    consentGiven: formData.get("consent") === "on",
    honeypot: text(formData, "website"),
  });

  if (result.ok) {
    return { status: "success", receiptId: result.value.receiptId };
  }

  if (result.error.code === "RATE_LIMITED") {
    return {
      status: "error",
      message:
        "Trop de tentatives récentes depuis cette adresse. Merci de réessayer dans quelques minutes.",
      fieldErrors: {},
    };
  }

  if (result.error.code === "NOT_FOUND") {
    return {
      status: "error",
      message: "Cette destination n'est plus disponible.",
      fieldErrors: {},
    };
  }

  if (result.error.code !== "VALIDATION_ERROR") {
    return {
      status: "error",
      message: "Votre demande n'a pas pu être envoyée. Merci de réessayer.",
      fieldErrors: {},
    };
  }

  const fieldError =
    FIELD_ERROR_BY_VALIDATION_CODE[result.error.validationCode];
  return {
    status: "error",
    message: fieldError
      ? "Merci de corriger les champs indiqués."
      : "Votre demande n'a pas pu être envoyée. Merci de vérifier le formulaire.",
    fieldErrors: fieldError ? { [fieldError.field]: fieldError.message } : {},
  };
}
