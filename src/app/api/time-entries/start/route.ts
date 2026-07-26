import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-utils";

const schema = z.object({ jobPhaseId: z.string().min(1) });

/**
 * Starts a new timer for the current technician. Any currently running
 * timer for this technician (startTime set, endTime null) is automatically
 * stopped first, per the "active timer auto-stops on new timer start" rule.
 */
export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "TECHNICIAN");
  if (error) return error;

  try {
    const { jobPhaseId } = schema.parse(await req.json());
    const techId = session!.user.id;
    const now = new Date();

    const entry = await prisma.$transaction(async (tx) => {
      await tx.timeEntry.updateMany({
        where: { techId, startTime: { not: null }, endTime: null },
        data: { endTime: now, status: "SUBMITTED" },
      });

      return tx.timeEntry.create({
        data: {
          jobPhaseId,
          techId,
          startTime: now,
          status: "OPEN",
        },
      });
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
