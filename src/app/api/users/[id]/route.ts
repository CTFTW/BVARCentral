import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  role: z.enum(["ADMIN", "SHOP_MANAGER", "PARTS_MANAGER", "TECHNICIAN", "FRONT_DESK"]).optional(),
  active: z.boolean().optional(),
  name: z.string().min(1).optional(),
});

// Admin activates/deactivates a user or changes their role. Newly
// self-registered OAuth accounts default to active: false until an Admin
// approves them here.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN");
  if (error) return error;

  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return jsonError("Not found", 404);
    if (before.role === "CUSTOMER") return jsonError("Use the customer management flow for portal accounts", 400);

    const user = await prisma.user.update({
      where: { id },
      data: body,
      select: { id: true, email: true, name: true, role: true, active: true },
    });

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      before: { role: before.role, active: before.active },
      after: user,
    });
    return NextResponse.json(user);
  } catch (err) {
    return handleApiError(err);
  }
}
