import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "TECHNICIAN");
  if (error) return error;

  const entry = await prisma.timeEntry.findFirst({
    where: { techId: session!.user.id, startTime: { not: null }, endTime: null },
    include: { jobPhase: { include: { project: { include: { vehicle: true } } } } },
  });
  return NextResponse.json(entry);
}
