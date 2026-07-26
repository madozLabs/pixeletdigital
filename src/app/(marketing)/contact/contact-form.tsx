"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitContactAction, type ContactFormState } from "./actions";

const initialState: ContactFormState = { status: "idle" };

export function ContactForm({
  worldKey = "pixel-digital",
  serviceSlug,
  sourcePage,
  submitLabel = "Envoyer",
}: Readonly<{
  worldKey?: string;
  serviceSlug: string | null;
  sourcePage: string;
  submitLabel?: string;
}>) {
  const [state, formAction] = useActionState(submitContactAction, initialState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const isKwalitiQuote = worldKey === "kwaliti-print";

  if (state.status === "success") {
    return (
      <div className="contact-form__success" role="status">
        <p className="section__lede">Votre message a bien été reçu.</p>
        <p className="section__note">
          Notre équipe examinera votre demande. Référence : {state.receiptId}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="contact-form" noValidate>
      <input type="hidden" name="worldKey" value={worldKey} />
      {serviceSlug ? (
        <input type="hidden" name="serviceSlug" value={serviceSlug} />
      ) : null}
      <input type="hidden" name="sourcePage" value={sourcePage} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="contact-form__honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Laissez ce champ vide</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <label className="contact-form__field">
        <span>Nom</span>
        <input name="name" type="text" required maxLength={160} />
        {fieldErrors.name ? (
          <span className="contact-form__field-error">{fieldErrors.name}</span>
        ) : null}
      </label>

      {isKwalitiQuote ? (
        <fieldset className="contact-form__quote-details">
          <legend>Précisions du devis (optionnelles)</legend>
          <p>
            Renseignez ce que vous connaissez déjà. Nous vous conseillerons pour
            le reste.
          </p>
          <div className="contact-form__quote-grid">
            <QuoteField
              label="Quantité"
              name="quantity"
              error={fieldErrors.quantity}
            >
              <input
                name="quantity"
                type="number"
                min="1"
                max="1000000"
                step="1"
                inputMode="numeric"
              />
            </QuoteField>
            <QuoteField label="Format" name="format" error={fieldErrors.format}>
              <input
                name="format"
                type="text"
                maxLength={160}
                placeholder="Dimensions ou format souhaité"
              />
            </QuoteField>
            <QuoteField
              label="Matière"
              name="material"
              error={fieldErrors.material}
            >
              <input
                name="material"
                type="text"
                maxLength={160}
                placeholder="Si connue"
              />
            </QuoteField>
            <QuoteField
              label="Délai souhaité"
              name="desiredDeadline"
              error={fieldErrors.desiredDeadline}
            >
              <input name="desiredDeadline" type="date" />
            </QuoteField>
            <QuoteField
              label="Finition"
              name="finishing"
              error={fieldErrors.finishing}
            >
              <input
                name="finishing"
                type="text"
                maxLength={160}
                placeholder="Si connue"
              />
            </QuoteField>
          </div>
        </fieldset>
      ) : null}

      <label className="contact-form__field">
        <span>E-mail</span>
        <input name="email" type="email" required maxLength={254} />
        {fieldErrors.email ? (
          <span className="contact-form__field-error">{fieldErrors.email}</span>
        ) : null}
      </label>

      <label className="contact-form__field">
        <span>Téléphone (optionnel)</span>
        <input name="phone" type="tel" maxLength={32} />
        {fieldErrors.phone ? (
          <span className="contact-form__field-error">{fieldErrors.phone}</span>
        ) : null}
      </label>

      <label className="contact-form__field">
        <span>Votre message</span>
        <textarea
          name="message"
          required
          maxLength={isKwalitiQuote ? 3200 : 4000}
          rows={6}
        />
        {fieldErrors.message ? (
          <span className="contact-form__field-error">
            {fieldErrors.message}
          </span>
        ) : null}
      </label>

      <label className="contact-form__consent">
        <input name="consent" type="checkbox" required />
        <span>
          J&rsquo;accepte que ces informations soient utilisées pour traiter ma
          demande.
        </span>
      </label>
      {fieldErrors.consent ? (
        <span className="contact-form__field-error">{fieldErrors.consent}</span>
      ) : null}

      {state.status === "error" ? (
        <p className="contact-form__error" role="alert">
          {state.message}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}

function QuoteField({
  label,
  name,
  error,
  children,
}: Readonly<{
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}>) {
  const errorId = `${name}-error`;
  return (
    <label className="contact-form__field">
      <span>{label}</span>
      {error ? (
        <span id={errorId} className="contact-form__field-error">
          {error}
        </span>
      ) : null}
      {children}
    </label>
  );
}

function SubmitButton({ label }: Readonly<{ label: string }>) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button button--primary" disabled={pending}>
      {pending ? "Envoi..." : label}
    </button>
  );
}
