import { describe, expect, it } from "vitest";
import { computeTimeEntryHours } from "./time-entries";

describe("computeTimeEntryHours", () => {
  it("prefers manualHours when present", () => {
    expect(
      computeTimeEntryHours({
        manualHours: 4.5,
        startTime: new Date("2026-01-01T08:00:00Z"),
        endTime: new Date("2026-01-01T09:00:00Z"),
      })
    ).toBe(4.5);
  });

  it("computes hours from start/end when manualHours is absent", () => {
    const startTime = new Date("2026-01-01T08:00:00Z");
    const endTime = new Date("2026-01-01T09:45:00Z");
    expect(computeTimeEntryHours({ startTime, endTime })).toBeCloseTo(1.75);
  });

  it("returns 0 for a still-running timer (no endTime)", () => {
    expect(computeTimeEntryHours({ startTime: new Date(), endTime: null })).toBe(0);
  });

  it("returns 0 when neither manualHours nor a complete start/end pair is present", () => {
    expect(computeTimeEntryHours({})).toBe(0);
  });

  it("coerces a Prisma Decimal-like manualHours value via Number()", () => {
    const decimalLike = { toString: () => "2.25" };
    expect(computeTimeEntryHours({ manualHours: decimalLike })).toBeCloseTo(2.25);
  });
});
