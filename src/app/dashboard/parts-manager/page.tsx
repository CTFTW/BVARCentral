import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PartsManagerDashboardPage() {
  const [parts, pendingConsumptions, openOrders] = await Promise.all([
    prisma.part.findMany({ orderBy: { sku: "asc" } }),
    prisma.partConsumption.findMany({
      where: { status: "PENDING" },
      include: { jobPhase: { include: { project: true } }, tech: true },
    }),
    prisma.specialOrder.findMany({
      where: { status: { in: ["REQUESTED", "PO_SENT", "DELIVERED"] } },
      include: { project: { include: { vehicle: true } } },
    }),
  ]);

  const lowStock = parts.filter((p) => p.quantityOnHand <= p.reorderThreshold);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Parts Manager Dashboard</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium">Approval Queue</h2>
        <div className="space-y-2">
          {pendingConsumptions.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">
                  {c.skuEntered} x{c.quantity}
                </p>
                <p className="text-sm text-muted-foreground">
                  {c.jobPhase.project.name} — requested by {c.tech.name}
                </p>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
          ))}
          {pendingConsumptions.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending approvals.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Low Stock Alerts</h2>
        <div className="space-y-2">
          {lowStock.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{p.sku}</p>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
              <Badge variant="destructive">
                {p.quantityOnHand} on hand (reorder at {p.reorderThreshold})
              </Badge>
            </div>
          ))}
          {lowStock.length === 0 && <p className="text-sm text-muted-foreground">Stock levels healthy.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">PO Tracking</h2>
        <div className="space-y-2">
          {openOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">
                  {o.poNumber ?? "(no PO#)"} — {o.vendorName}
                </p>
                <p className="text-sm text-muted-foreground">{o.project.name}</p>
              </div>
              <Badge variant="outline">{o.status}</Badge>
            </div>
          ))}
          {openOrders.length === 0 && <p className="text-sm text-muted-foreground">No open special orders.</p>}
        </div>
      </section>
    </div>
  );
}
