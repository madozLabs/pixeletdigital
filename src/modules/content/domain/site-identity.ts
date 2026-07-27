export const SITE_FONT_CHOICES = [
  "OUTFIT",
  "MANROPE",
  "BALOO",
  "SYSTEM",
] as const;
export type SiteFontChoice = (typeof SITE_FONT_CHOICES)[number];

export type SiteNavigationItem = Readonly<{
  label: string;
  href: string;
}>;

export type SiteMenu = Readonly<{
  id: string;
  name: string;
  items: readonly SiteNavigationItem[];
}>;

export type SiteIdentityConfig = Readonly<{
  siteName: string;
  tagline: string;
  logoMediaId: string;
  faviconMediaId: string;
  headingFont: SiteFontChoice;
  bodyFont: SiteFontChoice;
  menus: readonly SiteMenu[];
  primaryMenuId: string;
  footerMenuId: string;
  navigationItems: readonly SiteNavigationItem[];
  footerNavigationItems: readonly SiteNavigationItem[];
  footerText: string;
  contactLabel: string;
  contactHref: string;
  defaultSeoDescription: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  address: string;
  linkedinHref: string;
  instagramHref: string;
  legalNoticeHref: string;
  privacyPolicyHref: string;
}>;

export function validateSiteIdentityConfig(
  input: Readonly<Record<string, unknown>>,
):
  | { ok: true; value: SiteIdentityConfig }
  | { ok: false; errors: readonly string[] } {
  const errors: string[] = [];
  const siteName = stringValue(input.siteName);
  const tagline = stringValue(input.tagline);
  const logoMediaId = stringValue(input.logoMediaId);
  const faviconMediaId = stringValue(input.faviconMediaId);
  const footerText = stringValue(input.footerText);
  const contactLabel = stringValue(input.contactLabel);
  const contactHref = stringValue(input.contactHref);
  const defaultSeoDescription = stringValue(input.defaultSeoDescription);
  const contactEmail = stringValue(input.contactEmail);
  const contactPhone = stringValue(input.contactPhone);
  const whatsappNumber = stringValue(input.whatsappNumber);
  const address = stringValue(input.address);
  const linkedinHref = stringValue(input.linkedinHref);
  const instagramHref = stringValue(input.instagramHref);
  const legalNoticeHref = stringValue(input.legalNoticeHref);
  const privacyPolicyHref = stringValue(input.privacyPolicyHref);
  const headingFont = fontValue(input.headingFont);
  const bodyFont = fontValue(input.bodyFont);
  const legacyNavigationItems = navigationValue(input.navigationItems, errors);
  const menus = menuValue(input.menus, legacyNavigationItems, errors);
  const primaryMenuId = menuAssignment(
    input.primaryMenuId,
    menus,
    menus[0]?.id ?? "main",
  );
  const footerMenuId = menuAssignment(
    input.footerMenuId,
    menus,
    menus[1]?.id ?? primaryMenuId,
  );
  const navigationItems =
    menus.find((menu) => menu.id === primaryMenuId)?.items ?? [];
  const footerNavigationItems =
    menus.find((menu) => menu.id === footerMenuId)?.items ?? [];

  if (!siteName || siteName.length > 100)
    errors.push("Le nom du site est requis (100 caractères maximum). ");
  if (tagline.length > 180) errors.push("La baseline dépasse 180 caractères.");
  if (footerText.length > 500)
    errors.push("Le texte de footer dépasse 500 caractères.");
  if (!contactLabel || contactLabel.length > 80)
    errors.push("Le libellé de contact est requis.");
  if (!isSafeLink(contactHref))
    errors.push("Le lien de contact n’est pas autorisé.");
  if (defaultSeoDescription.length > 180)
    errors.push("La description SEO par défaut dépasse 180 caractères.");
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
    errors.push("L’adresse e-mail de contact est invalide.");
  if (contactPhone.length > 40)
    errors.push("Le numéro de téléphone est trop long.");
  if (whatsappNumber && !isValidWhatsappNumber(whatsappNumber))
    errors.push("Le numéro WhatsApp est invalide.");
  if (address.length > 220) errors.push("L’adresse est trop longue.");
  for (const [label, href] of [
    ["LinkedIn", linkedinHref],
    ["Instagram", instagramHref],
    ["Mentions légales", legalNoticeHref],
    ["Confidentialité", privacyPolicyHref],
  ] as const) {
    if (href && !isSafeLink(href))
      errors.push(`Le lien ${label} n’est pas autorisé.`);
  }
  if (!headingFont || !bodyFont)
    errors.push("Une police sélectionnée n’est pas autorisée.");
  if (errors.length > 0 || !headingFont || !bodyFont)
    return { ok: false, errors };

  return {
    ok: true,
    value: {
      siteName,
      tagline,
      logoMediaId,
      faviconMediaId,
      headingFont,
      bodyFont,
      menus,
      primaryMenuId,
      footerMenuId,
      navigationItems,
      footerNavigationItems,
      footerText,
      contactLabel,
      contactHref,
      defaultSeoDescription,
      contactEmail,
      contactPhone,
      whatsappNumber,
      address,
      linkedinHref,
      instagramHref,
      legalNoticeHref,
      privacyPolicyHref,
    },
  };
}

export function defaultSiteIdentity(
  worldKey: string,
  displayName: string,
): SiteIdentityConfig {
  const kwaliti = worldKey === "kwaliti-print";
  return {
    siteName: displayName,
    tagline: kwaliti
      ? "Impression · Personnalisation · Production"
      : "Agence créative & digitale",
    logoMediaId: "",
    faviconMediaId: "",
    headingFont: kwaliti ? "BALOO" : "OUTFIT",
    bodyFont: kwaliti ? "MANROPE" : "OUTFIT",
    menus: [
      { id: "main", name: "Menu principal", items: [] },
      { id: "footer", name: "Pied de page", items: [] },
    ],
    primaryMenuId: "main",
    footerMenuId: "footer",
    navigationItems: [],
    footerNavigationItems: [],
    footerText: "",
    contactLabel: kwaliti ? "Demander un devis" : "Nous contacter",
    contactHref: kwaliti ? "/kwaliti-print/devis" : "/contact",
    defaultSeoDescription: "",
    contactEmail: "",
    contactPhone: "",
    whatsappNumber: "",
    address: "Ouagadougou · Afrique de l’Ouest & au-delà",
    linkedinHref: "",
    instagramHref: "",
    legalNoticeHref: "",
    privacyPolicyHref: "",
  };
}

function navigationValue(
  value: unknown,
  errors: string[],
): SiteNavigationItem[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 12)
    errors.push("La navigation ne peut pas dépasser 12 liens.");
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push("Un lien de navigation est invalide.");
      return [];
    }
    const record = item as Record<string, unknown>;
    const label = stringValue(record.label);
    const href = stringValue(record.href);
    if (!label || label.length > 80 || !isSafeLink(href)) {
      errors.push("Un lien de navigation est incomplet ou interdit.");
      return [];
    }
    return [{ label, href }];
  });
}

function menuValue(
  value: unknown,
  legacyItems: readonly SiteNavigationItem[],
  errors: string[],
): SiteMenu[] {
  if (!Array.isArray(value)) {
    return [
      { id: "main", name: "Menu principal", items: legacyItems },
      { id: "footer", name: "Pied de page", items: [] },
    ];
  }
  if (value.length === 0 || value.length > 8) {
    errors.push("Le site doit contenir entre 1 et 8 menus.");
  }
  const seen = new Set<string>();
  return value.flatMap((menu, index) => {
    if (!menu || typeof menu !== "object" || Array.isArray(menu)) {
      errors.push("Un menu est invalide.");
      return [];
    }
    const record = menu as Record<string, unknown>;
    const id = stringValue(record.id) || `menu-${index + 1}`;
    const name = stringValue(record.name);
    if (!/^[a-z0-9-]{1,60}$/i.test(id) || seen.has(id)) {
      errors.push("Chaque menu doit avoir un identifiant unique.");
      return [];
    }
    seen.add(id);
    if (!name || name.length > 80) {
      errors.push("Chaque menu doit avoir un nom (80 caractères maximum).");
    }
    const items = navigationValue(record.items, errors);
    return [{ id, name, items }];
  });
}

function menuAssignment(
  value: unknown,
  menus: readonly SiteMenu[],
  fallback: string,
): string {
  const id = stringValue(value);
  return menus.some((menu) => menu.id === id) ? id : fallback;
}

function fontValue(value: unknown): SiteFontChoice | null {
  const candidate = stringValue(value) as SiteFontChoice;
  return SITE_FONT_CHOICES.includes(candidate) ? candidate : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSafeLink(value: string): boolean {
  return /^(\/|https:\/\/|mailto:|tel:|#)/i.test(value);
}

export function whatsappHref(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15
    ? `https://wa.me/${digits}`
    : null;
}

function isValidWhatsappNumber(value: string): boolean {
  return /^[+()\d\s.-]+$/.test(value) && whatsappHref(value) !== null;
}
