import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const createPhaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  estimatedHours: z.number().min(0).optional(),
  startDate: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await request.json()
    const data = createPhaseSchema.parse(body)

    const phase = await prisma.jobPhase.create({
      data: {
        projectId: id,
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
      },
    })

    return NextResponse.json(phase, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
