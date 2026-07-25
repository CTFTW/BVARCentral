import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const updateProjectSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["ESTIMATING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "DELIVERED"]).optional(),
  shopRate: z.number().optional(),
  deposit: z.number().optional(),
  startDate: z.string().optional(),
  estimatedCompletion: z.string().optional(),
  actualCompletion: z.string().optional(),
  priority: z.number().min(1).max(5).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        phases: {
          include: {
            assignments: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, role: true },
                },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        estimates: {
          orderBy: { createdAt: "desc" },
        },
        billingCycles: {
          include: {
            invoices: true,
          },
        },
        timeEntries: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { workDate: "desc" },
        },
        consumptions: {
          include: {
            part: true,
            requestedBy: {
              select: { id: true, name: true },
            },
            approvedBy: {
              select: { id: true, name: true },
            },
          },
        },
        specialOrders: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await request.json()
    const data = updateProjectSchema.parse(body)

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        estimatedCompletion: data.estimatedCompletion ? new Date(data.estimatedCompletion) : undefined,
        actualCompletion: data.actualCompletion ? new Date(data.actualCompletion) : undefined,
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    
    await prisma.project.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
