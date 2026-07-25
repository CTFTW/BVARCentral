import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { z } from "zod"

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "SHOP_MANAGER", "PARTS_MANAGER", "TECHNICIAN", "FRONT_DESK", "CUSTOMER"]),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN")
    const { id } = await params
    const body = await request.json()
    const data = updateRoleSchema.parse(body)

    const user = await prisma.user.update({
      where: { id },
      data: { role: data.role },
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
