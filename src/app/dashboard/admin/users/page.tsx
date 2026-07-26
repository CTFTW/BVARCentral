import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { UserManagementTable } from "@/components/admin/user-management-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const inactiveCount = users.filter((u) => !u.active).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        {inactiveCount > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {inactiveCount} account{inactiveCount === 1 ? "" : "s"} awaiting activation (includes
            self-registered Google sign-ins).
          </p>
        )}
      </div>
      <UserManagementTable
        // Query already excludes role: CUSTOMER, so this narrowing is safe.
        users={users.map((u) => ({
          ...u,
          role: u.role as Exclude<Role, "CUSTOMER">,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={session!.user.id}
      />
    </div>
  );
}
