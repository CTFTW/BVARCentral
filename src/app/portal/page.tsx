import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CustomerPortalPage() {
  const session = await auth();
  const customer = await prisma.customer.findUnique({
    where: { userId: session!.user.id },
    include: {
      vehicles: { include: { projects: { include: { phases: true } } } },
      invoices: { include: { payments: true } },
    },
  });

  if (!customer) {
    return <div className="p-6">No customer profile found.</div>;
  }

  const balance = customer.invoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    return sum + (Number(inv.total) - paid);
  }, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Welcome, {customer.name}</h1>
      <div className="rounded-md border p-4">
        <p className="text-sm text-muted-foreground">Current Balance</p>
        <p className="text-2xl font-semibold">${balance.toFixed(2)}</p>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Vehicle Progress</h2>
        {customer.vehicles.map((v) => (
          <div key={v.id} className="mb-3 rounded-md border p-4">
            <p className="font-medium">
              {v.year} {v.make} {v.model}
            </p>
            {v.projects.map((p) => (
              <div key={p.id} className="mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm">{p.name}</p>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
                <ul className="mt-1 space-y-1">
                  {p.phases.map((ph) => (
                    <li key={ph.id} className="flex items-center justify-between text-sm">
                      <span>{ph.name}</span>
                      <span className="text-muted-foreground">{ph.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Invoice History</h2>
        <div className="space-y-2">
          {customer.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-md border p-3">
              <span>{inv.invoiceNumber}</span>
              <Badge variant="outline">{inv.status}</Badge>
              <span>${Number(inv.total).toFixed(2)}</span>
            </div>
          ))}
          {customer.invoices.length === 0 && (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
