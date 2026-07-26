import { describe, expect, it } from "vitest";

import { buildKwalitiQuoteMessage } from "./kwaliti-quote-details";

const emptyDetails = {
  quantity: "",
  format: "",
  material: "",
  desiredDeadline: "",
  finishing: "",
};

describe("buildKwalitiQuoteMessage", () => {
  it("serializes supplied and unknown quote details explicitly", () => {
    const result = buildKwalitiQuoteMessage("Besoin pour un événement", {
      ...emptyDetails,
      quantity: "250",
      material: "À conseiller",
    });
    expect(result).toEqual({
      ok: true,
      value: expect.stringContaining(
        "Quantité : 250\nFormat : Non renseigné\nMatière : À conseiller",
      ),
    });
  });

  it("accepts every quote detail as optional", () => {
    expect(
      buildKwalitiQuoteMessage("Je souhaite être conseillé", emptyDetails).ok,
    ).toBe(true);
  });

  it("returns field-specific validation errors", () => {
    const result = buildKwalitiQuoteMessage("Message", {
      ...emptyDetails,
      quantity: "2.5",
      desiredDeadline: "26/07/2026",
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: expect.objectContaining({
        quantity: expect.any(String),
        desiredDeadline: expect.any(String),
      }),
    });
  });

  it("rejects calendar dates that only normalize to another day", () => {
    const result = buildKwalitiQuoteMessage("Message", {
      ...emptyDetails,
      desiredDeadline: "2026-02-31",
    });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { desiredDeadline: expect.any(String) },
    });
  });
});
