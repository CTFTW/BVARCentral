import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError } from "@/lib/api-utils";

const schema = z.object({ id: z.string().min(1) });

export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "TECHNICIAN");
  if (error) return error;

  try {
    const { id } = schema.parse(await req.json());
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) return jsonError("Not found", 404);
    if (session!.user.role === "TECHNICIAN" && entry.techId !== session!.user.id) {
      return jsonError("Forbidden", 403);
    }
    if (!entry.startTime || entry.endTime) {
      return jsonError("Timer is not currently running", 400);
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: { endTime: new Date(), status: "SUBMITTED" },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
