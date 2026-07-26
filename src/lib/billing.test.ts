import { describe, expect, it } from "vitest";
import {
  buildLaborLines,
  buildPartLines,
  buildSpecialOrderLines,
  computeInvoiceTotals,
  formatInvoiceNumber,
  resolveShopRate,
} from "./billing";

describe("resolveShopRate", () => {
  it("prefers the project override when set", () => {
    expect(resolveShopRate(120, 95)).toBe(120);
  });

  it("falls back to the shop default when no override", () => {
    expect(resolveShopRate(null, 95)).toBe(95);
  });

  it("falls back to 95 when neither is set", () => {
    expect(resolveShopRate(null, null)).toBe(95);
  });

  it("respects a custom fallback", () => {
    expect(resolveShopRate(undefined, undefined, 80)).toBe(80);
  });

  it("coerces Prisma Decimal-like values via Number()", () => {
    // Prisma Decimal instances stringify to their numeric value.
    const decimalLike = { toString: () => "110.50" };
    expect(resolveShopRate(decimalLike, 95)).toBeCloseTo(110.5);
  });
});

describe("buildLaborLines", () => {
  const phase = { name: "Bodywork & Paint" };

  it("computes hours from start/end timestamps and prices at the shop rate", () => {
    const start = new Date("2026-01-01T08:00:00Z");
    const end = new Date("2026-01-01T10:30:00Z"); // 2.5 hours
    const lines = buildLaborLines(
      [{ jobPhaseId: "phase-1", jobPhase: phase, startTime: start, endTime: end }],
      100
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBeCloseTo(2.5);
    expect(lines[0].unitPrice).toBe(100);
    expect(lines[0].lineTotal).toBeCloseTo(250);
    expect(lines[0].type).toBe("LABOR");
  });

  it("prefers manualHours over start/end when both are present", () => {
    const lines = buildLaborLines(
      [
        {
          jobPhaseId: "phase-1",
          jobPhase: phase,
          manualHours: 3,
          startTime: new Date("2026-01-01T08:00:00Z"),
          endTime: new Date("2026-01-01T08:15:00Z"),
        },
      ],
      50
    );
    expect(lines[0].quantity).toBe(3);
    expect(lines[0].lineTotal).toBe(150);
  });

  it("skips entries with zero or negative computed hours (e.g. a still-running timer)", () => {
    const lines = buildLaborLines(
      [{ jobPhaseId: "phase-1", jobPhase: phase, startTime: new Date(), endTime: null }],
      100
    );
    expect(lines).toHaveLength(0);
  });
});

describe("buildPartLines", () => {
  it("prioritizes overridePrice over sellingPriceLockedAt over the part's catalog price", () => {
    const [line] = buildPartLines([
      {
        jobPhaseId: "phase-1",
        skuEntered: "SKU-1",
        quantity: 2,
        overridePrice: 10,
        sellingPriceLockedAt: 20,
        part: { sellingPrice: 30, description: "Widget" },
      },
    ]);
    expect(line.unitPrice).toBe(10);
    expect(line.lineTotal).toBe(20);
  });

  it("falls back to sellingPriceLockedAt when no override is set", () => {
    const [line] = buildPartLines([
      {
        jobPhaseId: "phase-1",
        skuEntered: "SKU-1",
        quantity: 3,
        sellingPriceLockedAt: 15,
        part: { sellingPrice: 30, description: "Widget" },
      },
    ]);
    expect(line.unitPrice).toBe(15);
    expect(line.lineTotal).toBe(45);
  });

  it("falls back to 0 when the consumption has no linked part or locked price", () => {
    const [line] = buildPartLines([{ jobPhaseId: "phase-1", skuEntered: "UNKNOWN-SKU", quantity: 1 }]);
    expect(line.unitPrice).toBe(0);
    expect(line.lineTotal).toBe(0);
    expect(line.description).toContain("UNKNOWN-SKU");
  });
});

describe("buildSpecialOrderLines", () => {
  it("prices each item at quantity x sellingPrice", () => {
    const [line] = buildSpecialOrderLines([
      { description: "Custom Chrome Bumper", quantity: 1, sellingPrice: 450, specialOrder: { vendorName: "Acme" } },
    ]);
    expect(line.lineTotal).toBe(450);
    expect(line.description).toContain("Acme");
  });
});

describe("computeInvoiceTotals", () => {
  const laborLine = {
    type: "LABOR" as const,
    description: "Labor",
    quantity: 2,
    unitPrice: 100,
    lineTotal: 200,
  };
  const partLine = {
    type: "PART" as const,
    description: "Part",
    quantity: 1,
    unitPrice: 50,
    lineTotal: 50,
  };

  it("sums line totals into a subtotal with no deposit", () => {
    const result = computeInvoiceTotals([laborLine, partLine]);
    expect(result.subtotal).toBe(250);
    expect(result.total).toBe(250);
    expect(result.lines).toHaveLength(2);
  });

  it("subtracts the deposit from the total and appends a DEPOSIT line", () => {
    const result = computeInvoiceTotals([laborLine, partLine], 100);
    expect(result.subtotal).toBe(250);
    expect(result.total).toBe(150);
    expect(result.lines).toHaveLength(3);
    const depositLine = result.lines.find((l) => l.type === "DEPOSIT");
    expect(depositLine?.lineTotal).toBe(-100);
  });

  it("does not append a DEPOSIT line when depositApplied is 0", () => {
    const result = computeInvoiceTotals([laborLine], 0);
    expect(result.lines).toHaveLength(1);
  });

  it("rounds subtotal/total to the nearest cent to avoid floating-point drift", () => {
    const lines = Array.from({ length: 3 }, () => ({
      type: "LABOR" as const,
      description: "Labor",
      quantity: 1,
      unitPrice: 33.333,
      lineTotal: 33.333,
    }));
    const result = computeInvoiceTotals(lines);
    // 33.333 * 3 = 99.999 -> rounds to 100.00 at 2 decimal places.
    expect(result.subtotal).toBeCloseTo(100.0, 2);
  });
});

describe("formatInvoiceNumber", () => {
  it("pads the sequence to 5 digits", () => {
    expect(formatInvoiceNumber(2026, 7)).toBe("INV-2026-00007");
  });

  it("does not truncate sequences with 5+ digits", () => {
    expect(formatInvoiceNumber(2026, 123456)).toBe("INV-2026-123456");
  });
});
