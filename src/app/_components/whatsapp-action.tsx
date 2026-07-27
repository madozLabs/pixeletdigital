import { whatsappHref } from "@/modules/content/domain/site-identity";

export function WhatsappAction({
  number,
  siteName,
}: Readonly<{ number: string; siteName: string }>) {
  const href = whatsappHref(number);
  if (!href) return null;
  return (
    <a
      className="public-whatsapp-action"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Contacter ${siteName} sur WhatsApp`}
    >
      <span aria-hidden="true">WA</span>
      <strong>WhatsApp</strong>
    </a>
  );
}
