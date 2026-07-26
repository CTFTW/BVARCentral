/**
 * Single source of truth for converting a TimeEntry into billable hours.
 * Used by estimate variance calculation, invoice generation, and the
 * technician dashboard so all three always agree on billed/estimated hours.
 */
export function computeTimeEntryHours(entry: {
  manualHours?: unknown;
  startTime?: Date | null;
  endTime?: Date | null;
}): number {
  if (entry.manualHours != null) return Number(entry.manualHours);
  if (entry.startTime && entry.endTime) {
    return (entry.endTime.getTime() - entry.startTime.getTime()) / 3_600_000;
  }
  return 0;
}
