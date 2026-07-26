import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  sku: z.string().min(1),
  description: z.string().min(1),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  quantityOnHand: z.number().int().nonnegative().optional(),
  reorderThreshold: z.number().int().nonnegative().optional(),
  location: z.string().optional(),
});

export async function GET(req: Request) {
  const { error } = await requireRole(
    "ADMIN",
    "SHOP_MANAGER",
    "PARTS_MANAGER",
    "TECHNICIAN",
    "FRONT_DESK"
  );
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const lowStock = searchParams.get("lowStock") === "true";
  const q = searchParams.get("q");

  if (lowStock) {
    // Filter quantityOnHand <= reorderThreshold in the database (a
    // column-to-column comparison Prisma's typed filters can't express)
    // instead of loading every Part row and filtering in JS.
    const parts = q
      ? await prisma.$queryRaw`
          SELECT * FROM "Part"
          WHERE "quantityOnHand" <= "reorderThreshold"
            AND ("sku" ILIKE ${`%${q}%`} OR "description" ILIKE ${`%${q}%`})
          ORDER BY "sku" ASC
        `
      : await prisma.$queryRaw`
          SELECT * FROM "Part"
          WHERE "quantityOnHand" <= "reorderThreshold"
          ORDER BY "sku" ASC
        `;
    return NextResponse.json(parts);
  }

  const parts = await prisma.part.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { sku: "asc" },
    take: 200,
  });

  return NextResponse.json(parts);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "PARTS_MANAGER");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const part = await prisma.part.create({ data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Part",
      entityId: part.id,
      action: "CREATE",
      after: part,
    });
    return NextResponse.json(part, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
