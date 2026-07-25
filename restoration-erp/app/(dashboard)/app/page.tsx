import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderKanban, Users, Package, Clock } from "lucide-react"

export default async function DashboardPage() {
  const [
    projectCount,
    customerCount,
    partCount,
    activeTimerCount,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.customer.count(),
    prisma.part.count(),
    prisma.timeEntry.count({
      where: {
        endTime: null,
      },
    }),
  ])

  const recentProjects = await prisma.project.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    include: {
      customer: true,
      vehicle: true,
    },
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">Welcome to Restoration ERP</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
            <Package className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Timers</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTimerCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>Latest updated projects</CardDescription>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-gray-600">No projects yet</p>
          ) : (
            <div className="space-y-4">
              {recentProjects.map((project: any) => (
                <div key={project.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <p className="font-medium">{project.title}</p>
                    <p className="text-sm text-gray-600">
                      {project.customer.name} - {project.vehicle.year} {project.vehicle.make} {project.vehicle.model}
                    </p>
                  </div>
                  <span className="text-sm text-gray-600 capitalize">
                    {project.status.toLowerCase().replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
