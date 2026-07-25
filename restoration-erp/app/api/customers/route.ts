import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { z } from "zod"

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    await requireAuth()
    
    const customers = await prisma.customer.findMany({
      include: {
        vehicles: true,
        projects: {
          select: { id: true, status: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(customers)
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth()
    const body = await request.json()
    const data = createCustomerSchema.parse(body)

    const existingCustomer = await prisma.customer.findUnique({
      where: { email: data.email },
    })

    if (existingCustomer) {
      return NextResponse.json({ error: "Customer with this email already exists" }, { status: 400 })
    }

    const customer = await prisma.customer.create({
      data,
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
