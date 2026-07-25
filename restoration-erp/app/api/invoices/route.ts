import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/session"
import { z } from "zod"

const createInvoiceSchema = z.object({
  projectId: z.string(),
  billingCycleId: z.string().optional(),
  laborTotal: z.number().min(0),
  partsTotal: z.number().min(0),
  specialOrdersTotal: z.number().min(0),
  taxRate: z.number().min(0).max(100),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    type: z.string(),
    description: z.string(),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    total: z.number().min(0),
    phaseName: z.string().optional(),
    sortOrder: z.number().int().optional(),
  })).optional(),
})

export async function GET() {
  try {
    await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK")
    
    const invoices = await prisma.invoice.findMany({
      include: {
        project: {
          select: { id: true, title: true },
        },
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK")
    if (!session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const data = createInvoiceSchema.parse(body)

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { customerId: true },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const invoiceCount = await prisma.invoice.count()
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, "0")}`

    const subtotal = data.laborTotal + data.partsTotal + data.specialOrdersTotal
    const taxAmount = (subtotal * data.taxRate) / 100
    const total = subtotal + taxAmount

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        projectId: data.projectId,
        billingCycleId: data.billingCycleId || null,
        customerId: project.customerId,
        laborTotal: data.laborTotal,
        partsTotal: data.partsTotal,
        specialOrdersTotal: data.specialOrdersTotal,
        subtotal,
        taxRate: data.taxRate,
        taxAmount,
        total,
        balance: total,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes || null,
        createdById: session.user.id,
        lineItems: data.lineItems ? {
          create: data.lineItems.map((item) => ({
            ...item,
            sortOrder: item.sortOrder || 0,
          })),
        } : undefined,
      },
      include: {
        project: true,
        customer: true,
        lineItems: true,
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
