import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [userCount, activeProjects, pendingConsumptions] = await Promise.all([
    prisma.user.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.partConsumption.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Users" value={userCount} />
        <StatCard label="Active Projects" value={activeProjects} />
        <StatCard label="Pending Part Approvals" value={pendingConsumptions} />
      </div>
      <p className="text-sm text-muted-foreground">
        User management, role management, system settings, and audit log views are next to be
        built out on top of the existing API routes (/api/customers, /api/projects, /api/parts,
        /api/part-consumptions, etc.) and the AuditLog model.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
