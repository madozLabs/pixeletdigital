import { describe, expect, it } from "vitest";

import {
  createDraftQuote,
  markQuoteConverted,
  restoreQuote,
  setQuoteStatus,
} from "./quote";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("createDraftQuote", () => {
  it("creates a DRAFT quote with computed totals", () => {
    const result = createDraftQuote(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("DRAFT");
    expect(result.value.version).toBe(1);
    expect(result.value.totalCents).toBe(45000);
    expect(result.value.convertedAt).toBeNull();
  });

  it("rejects a quote with no lines", () => {
    const result = createDraftQuote({ ...validInput(), lines: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LINES");
  });
});

describe("setQuoteStatus", () => {
  it("moves DRAFT to SENT", () => {
    const quote = validQuote();
    const result = setQuoteStatus(quote, "SENT", now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("SENT");
    expect(result.value.version).toBe(2);
  });

  it("rejects changing status on a converted quote", () => {
    const quote = validQuote();
    const accepted = setQuoteStatus(quote, "ACCEPTED", now);
    if (!accepted.ok) throw new Error("expected transition to succeed");
    const converted = markQuoteConverted(accepted.value, now);
    if (!converted.ok) throw new Error("expected conversion to succeed");

    const result = setQuoteStatus(converted.value, "CANCELLED", now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });

  it("rejects setting status to CONVERTED directly", () => {
    const quote = validQuote();
    const result = setQuoteStatus(quote, "CONVERTED", now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STATUS");
  });
});

describe("markQuoteConverted", () => {
  it("requires the quote to be ACCEPTED", () => {
    const quote = validQuote();

    const result = markQuoteConverted(quote, now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });

  it("converts an accepted quote and stamps convertedAt", () => {
    const quote = validQuote();
    const accepted = setQuoteStatus(quote, "ACCEPTED", now);
    if (!accepted.ok) throw new Error("expected transition to succeed");

    const result = markQuoteConverted(accepted.value, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("CONVERTED");
    expect(result.value.convertedAt).toEqual(now);
  });
});

describe("restoreQuote", () => {
  it("round-trips a persisted quote", () => {
    const quote = validQuote();

    const result = restoreQuote(quote);

    expect(result).toEqual({ ok: true, value: quote });
  });
});

function validInput() {
  return {
    id: "quote_test_01",
    worldKey: "pixel-digital",
    clientId: "client_test_01",
    number: "PD-DV-2026-0001",
    lines: [
      {
        id: "line_01",
        label: "Création de logo",
        quantity: 1,
        unitPriceCents: 45000,
      },
    ],
    issuedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function validQuote() {
  const result = createDraftQuote(validInput());
  if (!result.ok) throw new Error("expected a valid draft quote");
  return result.value;
}
