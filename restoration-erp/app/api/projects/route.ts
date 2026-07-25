import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const createProjectSchema = z.object({
  customerId: z.string(),
  vehicleId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  shopRate: z.number().optional(),
  deposit: z.number().optional(),
  startDate: z.string().optional(),
  estimatedCompletion: z.string().optional(),
  priority: z.number().min(1).max(5).optional(),
})

export async function GET() {
  try {
    await requireAuth()
    
    const projects = await prisma.project.findMany({
      include: {
        customer: true,
        vehicle: true,
        phases: {
          include: {
            assignments: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json(projects)
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const data = createProjectSchema.parse(body)

    const project = await prisma.project.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        estimatedCompletion: data.estimatedCompletion ? new Date(data.estimatedCompletion) : null,
      },
      include: {
        customer: true,
        vehicle: true,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
