import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"

export default async function BillingPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      project: true,
      customer: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const totalOutstanding = invoices.reduce((sum: number, inv: any) => sum + inv.balance, 0)
  const totalPaid = invoices.reduce((sum: number, inv: any) => sum + inv.amountPaid, 0)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-gray-600">Manage invoices and payments</p>
        </div>
        <Link href="/app/billing/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalOutstanding.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>Latest invoices created</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center py-8 text-gray-600">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice: any) => (
                <Link key={invoice.id} href={`/app/billing/${invoice.id}`}>
                  <div className="flex items-center justify-between border-b pb-3 last:border-0 hover:bg-gray-50 p-2 rounded">
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-gray-600">
                        {invoice.customer.name} - {invoice.project.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${invoice.total.toFixed(2)}</p>
                      <Badge variant={invoice.status === "PAID" ? "default" : "secondary"}>
                        {invoice.status}
                      </Badge>
                      {invoice.balance > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          Balance: ${invoice.balance.toFixed(2)}
                        </p>
                      )}
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
