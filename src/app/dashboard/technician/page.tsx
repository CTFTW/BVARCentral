import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TechnicianTimerPanel } from "@/components/technician/timer-panel";
import { computeTimeEntryHours } from "@/lib/time-entries";

export default async function TechnicianDashboardPage() {
  const session = await auth();
  const techId = session!.user.id;

  const [activeEntry, myPhases, recentEntries] = await Promise.all([
    prisma.timeEntry.findFirst({
      where: { techId, startTime: { not: null }, endTime: null },
      include: { jobPhase: { include: { project: { include: { vehicle: true } } } } },
    }),
    prisma.jobPhase.findMany({
      where: { assignedTechId: techId, status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] } },
      include: { project: { include: { vehicle: true } } },
      orderBy: { sequence: "asc" },
    }),
    prisma.timeEntry.findMany({
      where: { techId },
      include: { jobPhase: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">My Dashboard</h1>
      <TechnicianTimerPanel
        activeEntry={
          activeEntry
            ? {
                id: activeEntry.id,
                jobPhaseId: activeEntry.jobPhaseId,
                startTime: activeEntry.startTime!.toISOString(),
                jobPhaseName: activeEntry.jobPhase.name,
                projectName: activeEntry.jobPhase.project.name,
              }
            : null
        }
        assignedPhases={myPhases.map((p) => ({
          id: p.id,
          name: p.name,
          projectName: p.project.name,
          vehicleLabel: `${p.project.vehicle.year ?? ""} ${p.project.vehicle.make} ${p.project.vehicle.model}`.trim(),
          status: p.status,
        }))}
      />

      <section>
        <h2 className="mb-2 text-lg font-medium">Recent Time Entries</h2>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Phase</th>
                <th className="p-2 text-left">Hours</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((e) => {
                const hours = computeTimeEntryHours(e);
                return (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{e.jobPhase.name}</td>
                    <td className="p-2">{hours > 0 ? hours.toFixed(2) : "running"}</td>
                    <td className="p-2">{e.status}</td>
                    <td className="p-2">
                      {(e.workDate ?? e.startTime)?.toLocaleDateString?.() ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
