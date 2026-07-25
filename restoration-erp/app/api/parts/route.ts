import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const createPartSchema = z.object({
  sku: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional(),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  quantity: z.number().int().min(0),
  reorderThreshold: z.number().int().min(0).optional(),
  location: z.string().optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    await requireAuth()
    
    const parts = await prisma.part.findMany({
      orderBy: { description: "asc" },
    })

    return NextResponse.json(parts)
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth()
    const body = await request.json()
    const data = createPartSchema.parse(body)

    const existingPart = await prisma.part.findUnique({
      where: { sku: data.sku },
    })

    if (existingPart) {
      return NextResponse.json({ error: "Part with this SKU already exists" }, { status: 400 })
    }

    const part = await prisma.part.create({
      data,
    })

    return NextResponse.json(part, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
