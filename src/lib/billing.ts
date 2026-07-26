import { computeTimeEntryHours } from "@/lib/time-entries";

export type InvoiceLineDraft = {
  type: "LABOR" | "PART" | "SPECIAL_ORDER" | "DEPOSIT";
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  jobPhaseId?: string;
};

type TimeEntryLike = {
  manualHours?: unknown;
  startTime?: Date | null;
  endTime?: Date | null;
  jobPhaseId: string;
  jobPhase: { name: string };
};

type PartConsumptionLike = {
  overridePrice?: unknown;
  sellingPriceLockedAt?: unknown;
  part?: { sellingPrice?: unknown; description?: string } | null;
  skuEntered: string;
  quantity: number;
  jobPhaseId: string;
};

type SpecialOrderItemLike = {
  description: string;
  quantity: number;
  sellingPrice: unknown;
  specialOrder: { vendorName: string };
};

/**
 * Resolves the effective shop rate for a project: its own override if set,
 * otherwise the shop-wide default. Pure function — no DB access — so it's
 * unit-testable and shared between invoice generation and estimate
 * variance calculation.
 */
export function resolveShopRate(
  projectShopRateOverride: unknown,
  defaultShopRate: unknown,
  fallback = 95
): number {
  if (projectShopRateOverride != null) return Number(projectShopRateOverride);
  if (defaultShopRate != null) return Number(defaultShopRate);
  return fallback;
}

/** Builds LABOR invoice line drafts from a set of time entries. */
export function buildLaborLines(timeEntries: TimeEntryLike[], shopRate: number): InvoiceLineDraft[] {
  const lines: InvoiceLineDraft[] = [];
  for (const entry of timeEntries) {
    const hours = computeTimeEntryHours(entry);
    if (hours <= 0) continue;
    lines.push({
      type: "LABOR",
      description: `Labor - ${entry.jobPhase.name}`,
      quantity: hours,
      unitPrice: shopRate,
      lineTotal: hours * shopRate,
      jobPhaseId: entry.jobPhaseId,
    });
  }
  return lines;
}

/**
 * Builds PART invoice line drafts. Price precedence: explicit per-line
 * override > the price locked in at consumption/approval time > the part's
 * current catalog selling price > 0 (defensive fallback, e.g. an orphaned
 * consumption with no linked part).
 */
export function buildPartLines(consumptions: PartConsumptionLike[]): InvoiceLineDraft[] {
  return consumptions.map((c) => {
    const unitPrice = Number(c.overridePrice ?? c.sellingPriceLockedAt ?? c.part?.sellingPrice ?? 0);
    return {
      type: "PART" as const,
      description: `Part - ${c.part?.description ?? c.skuEntered}`,
      quantity: c.quantity,
      unitPrice,
      lineTotal: unitPrice * c.quantity,
      jobPhaseId: c.jobPhaseId,
    };
  });
}

/** Builds SPECIAL_ORDER invoice line drafts. */
export function buildSpecialOrderLines(items: SpecialOrderItemLike[]): InvoiceLineDraft[] {
  return items.map((item) => {
    const unitPrice = Number(item.sellingPrice);
    return {
      type: "SPECIAL_ORDER" as const,
      description: `Special Order - ${item.description} (${item.specialOrder.vendorName})`,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    };
  });
}

/**
 * Combines labor/part/special-order line drafts into a full invoice total,
 * optionally appending a DEPOSIT line for any deposit applied. Rounds to
 * cents to avoid floating-point drift accumulating across many line items.
 */
export function computeInvoiceTotals(lines: InvoiceLineDraft[], depositApplied = 0) {
  const roundCents = (n: number) => Math.round(n * 100) / 100;

  const subtotal = roundCents(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const total = roundCents(subtotal - depositApplied);

  const allLines: InvoiceLineDraft[] =
    depositApplied > 0
      ? [
          ...lines,
          {
            type: "DEPOSIT",
            description: "Deposit applied",
            quantity: 1,
            unitPrice: -depositApplied,
            lineTotal: -depositApplied,
          },
        ]
      : lines;

  return { subtotal, depositApplied, total, lines: allLines };
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(5, "0")}`;
}
