import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { jsonError } from "@/lib/api-utils";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { id } = await params;
  const consumption = await prisma.partConsumption.findUnique({
    where: { id },
    include: { part: true, jobPhase: { include: { project: true } }, tech: true, approver: true },
  });
  if (!consumption) return jsonError("Not found", 404);
  return NextResponse.json(consumption);
}
