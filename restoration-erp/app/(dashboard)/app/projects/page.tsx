import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: {
      customer: true,
      vehicle: true,
      phases: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-gray-600">Manage restoration projects</p>
        </div>
        <Link href="/app/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600">No projects yet. Create your first project to get started.</p>
            </CardContent>
          </Card>
        ) : (
          projects.map((project: any) => (
            <Link key={project.id} href={`/app/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{project.title}</CardTitle>
                      <CardDescription>
                        {project.customer.name} - {project.vehicle.year} {project.vehicle.make} {project.vehicle.model}
                      </CardDescription>
                    </div>
                    <Badge variant={project.status === "COMPLETED" ? "default" : "secondary"}>
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{project.phases.length} phases</span>
                    <span>Priority: {project.priority}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
