import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const stopTimerSchema = z.object({
  endTime: z.string(),
  description: z.string().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await request.json()
    const data = stopTimerSchema.parse(body)

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        endTime: new Date(data.endTime),
        description: data.description || undefined,
      },
    })

    return NextResponse.json(entry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
