import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [userCount, inactiveUserCount, activeProjects, pendingConsumptions] = await Promise.all([
    prisma.user.count({ where: { role: { not: "CUSTOMER" } } }),
    prisma.user.count({ where: { role: { not: "CUSTOMER" }, active: false } }),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.partConsumption.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <Link href="/dashboard/admin/users" className={buttonVariants({ size: "sm" })}>
          Manage Users
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Staff Users" value={userCount} />
        <StatCard label="Awaiting Activation" value={inactiveUserCount} />
        <StatCard label="Active Projects" value={activeProjects} />
        <StatCard label="Pending Part Approvals" value={pendingConsumptions} />
      </div>
      <p className="text-sm text-muted-foreground">
        Role management and account activation (including self-registered Google sign-ins) are
        available under Manage Users. System settings and a dedicated audit log viewer are next to
        be built on top of the existing AuditLog model.
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
