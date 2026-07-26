import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { jsonError } from "@/lib/api-utils";

// Marks a notification as read. Only the owning user may update it.
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole();
  if (error) return error;

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return jsonError("Not found", 404);
  if (notification.userId !== session!.user.id) return jsonError("Forbidden", 403);

  const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
  return NextResponse.json(updated);
}
