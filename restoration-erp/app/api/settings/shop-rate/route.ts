import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/session"
import { z } from "zod"

const shopRateSchema = z.object({
  value: z.number().min(0),
})

export async function GET() {
  try {
    await requireAuth()
    
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "shop_rate" },
    })

    return NextResponse.json({ value: setting?.value || null })
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN", "SHOP_MANAGER")
    const body = await request.json()
    const data = shopRateSchema.parse(body)

    const setting = await prisma.systemSetting.upsert({
      where: { key: "shop_rate" },
      update: { value: data.value.toString() },
      create: { key: "shop_rate", value: data.value.toString() },
    })

    return NextResponse.json({ value: setting.value })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
