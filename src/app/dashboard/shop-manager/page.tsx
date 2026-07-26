import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ShopManagerDashboardPage() {
  const projects = await prisma.project.findMany({
    where: { status: { in: ["ACTIVE", "ON_HOLD"] } },
    include: { vehicle: true, phases: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Shop Manager Dashboard</h1>
      <h2 className="text-lg font-medium">Work In Progress</h2>
      <div className="space-y-3">
        {projects.map((p) => {
          const done = p.phases.filter((ph) => ph.status === "COMPLETED").length;
          return (
            <div key={p.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.vehicle.year} {p.vehicle.make} {p.vehicle.model}
                  </p>
                </div>
                <Badge>{p.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Phases complete: {done}/{p.phases.length}
              </p>
            </div>
          );
        })}
        {projects.length === 0 && (
          <p className="text-sm text-muted-foreground">No active projects.</p>
        )}
      </div>
    </div>
  );
}
