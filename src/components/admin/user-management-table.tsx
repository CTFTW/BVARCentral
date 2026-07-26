"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StaffRole = "ADMIN" | "SHOP_MANAGER" | "PARTS_MANAGER" | "TECHNICIAN" | "FRONT_DESK";

type StaffUser = {
  id: string;
  name: string | null;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
};

const ROLE_OPTIONS: StaffRole[] = ["ADMIN", "SHOP_MANAGER", "PARTS_MANAGER", "TECHNICIAN", "FRONT_DESK"];

export function UserManagementTable({ users, currentUserId }: { users: StaffUser[]; currentUserId: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function patchUser(id: string, data: Partial<Pick<StaffUser, "role" | "active">>) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update user");
      }
      toast.success("User updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Role</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u.name ?? "—"}</td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">
                <Select
                  value={u.role}
                  disabled={pendingId === u.id || u.id === currentUserId}
                  onValueChange={(role) => patchUser(u.id, { role: role as StaffRole })}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="p-2">
                <Badge variant={u.active ? "outline" : "destructive"}>
                  {u.active ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="p-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId === u.id || u.id === currentUserId}
                  onClick={() => patchUser(u.id, { active: !u.active })}
                >
                  {u.active ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td className="p-4 text-center text-muted-foreground" colSpan={5}>
                No staff users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
