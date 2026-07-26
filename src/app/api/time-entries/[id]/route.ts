import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  status: z.enum(["OPEN", "SUBMITTED", "APPROVED", "BILLED", "REJECTED"]).optional(),
  manualHours: z.number().positive().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { id } = await params;
  const before = await prisma.timeEntry.findUnique({ where: { id } });
  if (!before) return jsonError("Not found", 404);

  try {
    const body = updateSchema.parse(await req.json());

    if (session!.user.role === "TECHNICIAN") {
      if (before.techId !== session!.user.id) return jsonError("Forbidden", 403);
      if (before.status !== "OPEN" && before.status !== "SUBMITTED") {
        return jsonError("Cannot edit an entry that has been reviewed", 400);
      }
      if (body.status && !["SUBMITTED"].includes(body.status)) {
        return jsonError("Technicians may only submit entries", 403);
      }
    }

    // Approval/rejection billing lock: once BILLED an entry is immutable.
    if (before.status === "BILLED") {
      return jsonError("Entry has already been billed and is immutable", 400);
    }

    const entry = await prisma.timeEntry.update({ where: { id }, data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "TimeEntry",
      entityId: id,
      action: "UPDATE",
      before,
      after: entry,
    });
    return NextResponse.json(entry);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER");
  if (error) return error;

  const { id } = await params;
  const before = await prisma.timeEntry.findUnique({ where: { id } });
  if (!before) return jsonError("Not found", 404);
  if (before.status === "BILLED") return jsonError("Cannot delete a billed entry", 400);

  await prisma.timeEntry.delete({ where: { id } });
  await writeAuditLog({
    userId: session!.user.id,
    entityType: "TimeEntry",
    entityId: id,
    action: "DELETE",
    before,
  });
  return NextResponse.json({ ok: true });
}
