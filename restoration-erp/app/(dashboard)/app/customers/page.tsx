import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    include: {
      vehicles: true,
      projects: true,
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-gray-600">Manage customer information</p>
        </div>
        <Link href="/app/customers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>{customers.length} customers</CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-center py-8 text-gray-600">No customers yet</p>
          ) : (
            <div className="space-y-4">
              {customers.map((customer: any) => (
                <Link key={customer.id} href={`/app/customers/${customer.id}`}>
                  <div className="flex items-center justify-between border-b pb-4 last:border-0 hover:bg-gray-50 p-2 rounded">
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.email}</p>
                      {customer.phone && (
                        <p className="text-sm text-gray-600">{customer.phone}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">{customer.vehicles.length} vehicles</Badge>
                      <div className="text-sm text-gray-600 mt-1">
                        {customer.projects.length} projects
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
