import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const createTimeEntrySchema = z.object({
  projectId: z.string(),
  jobId: z.string().optional(),
  workDate: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  manualHours: z.number().min(0).optional(),
  description: z.string().optional(),
  isChargeable: z.boolean().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const projectId = searchParams.get("projectId")

    const where: any = {}
    if (userId) where.userId = userId
    if (projectId) where.projectId = projectId

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true },
        },
        project: {
          select: { id: true, title: true },
        },
        jobPhase: {
          select: { id: true, name: true },
        },
      },
      orderBy: { workDate: "desc" },
    })

    return NextResponse.json(entries)
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    if (!session.user) {
      throw new Error("Unauthorized")
    }
    const body = await request.json()
    const data = createTimeEntrySchema.parse(body)

    if (data.startTime && !data.endTime) {
      await prisma.timeEntry.updateMany({
        where: {
          userId: session.user.id,
          endTime: null,
        },
        data: {
          endTime: new Date(),
        },
      })
    }

    const entry = await prisma.timeEntry.create({
      data: {
        userId: session.user.id,
        projectId: data.projectId,
        jobId: data.jobId || null,
        workDate: new Date(data.workDate),
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        manualHours: data.manualHours || null,
        description: data.description || null,
        isChargeable: data.isChargeable ?? true,
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
