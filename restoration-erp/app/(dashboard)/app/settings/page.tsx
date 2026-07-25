"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface User {
  id: string
  name: string
  email: string
  role: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [shopRate, setShopRate] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchSettings()
  }, [])

  const fetchUsers = async () => {
    const res = await fetch("/api/users")
    if (res.ok) {
      const data = await res.json()
      setUsers(data)
    }
  }

  const fetchSettings = async () => {
    const res = await fetch("/api/settings/shop-rate")
    if (res.ok) {
      const data = await res.json()
      setShopRate(data.value || "")
    }
  }

  const updateShopRate = async () => {
    setLoading(true)
    const res = await fetch("/api/settings/shop-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: parseFloat(shopRate) }),
    })
    if (res.ok) {
      alert("Shop rate updated")
    }
    setLoading(false)
  }

  const updateUserRole = async (userId: string, role: string) => {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    if (res.ok) {
      await fetchUsers()
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-600">System configuration and user management</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Shop Rate</CardTitle>
            <CardDescription>Default hourly rate for labor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Hourly Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={shopRate}
                  onChange={(e) => setShopRate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={updateShopRate} disabled={loading}>
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage users and their roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{user.role}</Badge>
                    {session?.user?.id !== user.id && (
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateUserRole(user.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SHOP_MANAGER">Shop Manager</SelectItem>
                          <SelectItem value="PARTS_MANAGER">Parts Manager</SelectItem>
                          <SelectItem value="TECHNICIAN">Technician</SelectItem>
                          <SelectItem value="FRONT_DESK">Front Desk</SelectItem>
                          <SelectItem value="CUSTOMER">Customer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
