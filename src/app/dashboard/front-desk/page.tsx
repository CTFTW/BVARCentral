import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function FrontDeskDashboardPage() {
  const [estimatesAwaiting, outstandingInvoices, customers] = await Promise.all([
    prisma.projectEstimate.findMany({
      where: { approvedAt: null },
      include: { project: { include: { vehicle: { include: { customer: true } } } } },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_PAID"] } },
      include: { customer: true },
    }),
    prisma.customer.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Front Desk Dashboard</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium">Estimates Awaiting Approval</h2>
        <div className="space-y-2">
          {estimatesAwaiting.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{e.project.name}</p>
                <p className="text-sm text-muted-foreground">{e.project.vehicle.customer.name}</p>
              </div>
              <Badge variant="outline">Awaiting Approval</Badge>
            </div>
          ))}
          {estimatesAwaiting.length === 0 && (
            <p className="text-sm text-muted-foreground">No estimates awaiting approval.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Outstanding Invoices</h2>
        <div className="space-y-2">
          {outstandingInvoices.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{i.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">{i.customer.name}</p>
              </div>
              <Badge variant="outline">${Number(i.total).toFixed(2)}</Badge>
            </div>
          ))}
          {outstandingInvoices.length === 0 && (
            <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Recent Customers</h2>
        <ul className="space-y-1 text-sm">
          {customers.map((c) => (
            <li key={c.id}>{c.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
