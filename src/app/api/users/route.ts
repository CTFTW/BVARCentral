import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "SHOP_MANAGER", "PARTS_MANAGER", "TECHNICIAN", "FRONT_DESK"]),
  password: z.string().min(8).optional(),
  active: z.boolean().optional(),
});

// Admin-only user directory: lists staff so an Admin can activate accounts
// (including self-registered OAuth sign-ins, which start inactive) and
// assign/adjust roles.
export async function GET() {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const users = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

// Admin can also directly create pre-provisioned staff accounts with a
// password (rather than relying on OAuth self-registration).
export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : undefined;

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        role: body.role,
        passwordHash,
        active: body.active ?? true,
      },
      select: { id: true, email: true, name: true, role: true, active: true },
    });

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "User",
      entityId: user.id,
      action: "CREATE",
      after: user,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
