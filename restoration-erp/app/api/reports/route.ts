import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"

export async function GET(request: Request) {
  try {
    await requireAuth()
    
    const { searchParams } = new URL(request.url)
    const period = parseInt(searchParams.get("period") || "30")
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)

    const [
      totalProjects,
      completedProjects,
      invoices,
      timeEntries,
      parts,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({
        where: { status: "COMPLETED" },
      }),
      prisma.invoice.findMany({
        select: {
          amountPaid: true,
          balance: true,
        },
      }),
      prisma.timeEntry.findMany({
        include: {
          user: {
            select: { name: true },
          },
        },
      }),
      prisma.part.findMany({
        select: {
          costPrice: true,
          quantity: true,
          reorderThreshold: true,
        },
      }),
    ])

    const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + inv.amountPaid, 0)
    const outstandingBalance = invoices.reduce((sum: number, inv: any) => sum + inv.balance, 0)

    const totalHoursLogged = timeEntries.reduce((sum: number, entry: any) => {
      if (entry.manualHours) return sum + entry.manualHours
      if (entry.startTime && entry.endTime) {
        const hours = (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 3600000
        return sum + hours
      }
      return sum
    }, 0)

    const inventoryValue = parts.reduce((sum: number, part: any) => sum + part.costPrice * part.quantity, 0)
    const lowStockCount = parts.filter((part: any) => part.quantity <= part.reorderThreshold).length

    const techMap = new Map<string, { hours: number; chargeableHours: number }>()
    timeEntries.forEach((entry: any) => {
      const hours = entry.manualHours || 
        (entry.startTime && entry.endTime
          ? (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 3600000
          : 0)
      
      const existing = techMap.get(entry.user.name) || { hours: 0, chargeableHours: 0 }
      existing.hours += hours
      if (entry.isChargeable) {
        existing.chargeableHours += hours
      }
      techMap.set(entry.user.name, existing)
    })

    const technicianUtilization = Array.from(techMap.entries()).map(([name, data]) => ({
      name,
      ...data,
    }))

    return NextResponse.json({
      totalProjects,
      completedProjects,
      totalRevenue,
      outstandingBalance,
      totalHoursLogged,
      inventoryValue,
      lowStockCount,
      technicianUtilization,
    })
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
