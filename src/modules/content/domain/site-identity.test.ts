import { describe, expect, it } from "vitest";

import {
  defaultSiteIdentity,
  validateSiteIdentityConfig,
  whatsappHref,
} from "./site-identity";

describe("site identity", () => {
  it("accepts a complete controlled identity", () => {
    expect(
      validateSiteIdentityConfig(
        defaultSiteIdentity("pixel-digital", "Pixel&Digital"),
      ),
    ).toMatchObject({ ok: true });
  });

  it("rejects unsafe navigation and unsupported fonts", () => {
    const result = validateSiteIdentityConfig({
      ...defaultSiteIdentity("pixel-digital", "Pixel&Digital"),
      headingFont: "COMIC_SANS",
      navigationItems: [{ label: "Piège", href: "javascript:alert(1)" }],
    });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });

  it("supports several menus assigned independently to header and footer", () => {
    const result = validateSiteIdentityConfig({
      ...defaultSiteIdentity("pixel-digital", "Pixel&Digital"),
      menus: [
        {
          id: "main",
          name: "Navigation principale",
          items: [{ label: "Accueil", href: "/" }],
        },
        {
          id: "footer",
          name: "Pied de page",
          items: [{ label: "Confidentialité", href: "/confidentialite" }],
        },
      ],
      primaryMenuId: "main",
      footerMenuId: "footer",
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        navigationItems: [{ label: "Accueil", href: "/" }],
        footerNavigationItems: [
          { label: "Confidentialité", href: "/confidentialite" },
        ],
      },
    });
  });

  it("normalizes a configured WhatsApp number to the public link", () => {
    expect(whatsappHref("+226 70 12 34 56")).toBe("https://wa.me/22670123456");
    expect(whatsappHref("123")).toBeNull();
  });

  it("rejects an invalid WhatsApp number", () => {
    const result = validateSiteIdentityConfig({
      ...defaultSiteIdentity("pixel-digital", "Pixel&Digital"),
      whatsappNumber: "appelez-moi demain",
    });
    expect(result).toMatchObject({ ok: false });
  });
});
