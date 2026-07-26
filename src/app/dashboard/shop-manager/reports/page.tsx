import { prisma } from "@/lib/prisma";
import { resolveShopRate } from "@/lib/billing";
import { computeTimeEntryHours } from "@/lib/time-entries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getJobProfitability() {
  const settings = await prisma.shopSettings.findUnique({ where: { id: "singleton" } });
  const projects = await prisma.project.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED", "ON_HOLD"] } },
    include: {
      vehicle: true,
      estimate: { include: { lines: true } },
      phases: {
        include: {
          timeEntries: { where: { status: { in: ["SUBMITTED", "APPROVED", "BILLED"] } } },
          partConsumptions: { where: { status: "APPROVED" } },
        },
      },
      specialOrders: { include: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return projects.map((p) => {
    const shopRate = resolveShopRate(p.shopRateOverride, settings?.defaultShopRate);

    const estimatedLabor = (p.estimate?.lines ?? [])
      .filter((l) => l.type === "LABOR")
      .reduce((sum, l) => sum + Number(l.estimatedQuantity) * Number(l.estimatedUnitCost), 0);
    const estimatedParts = (p.estimate?.lines ?? [])
      .filter((l) => l.type !== "LABOR")
      .reduce((sum, l) => sum + Number(l.estimatedQuantity) * Number(l.estimatedUnitCost), 0);

    const actualHours = p.phases.flatMap((ph) => ph.timeEntries).reduce((sum, e) => sum + computeTimeEntryHours(e), 0);
    const actualLaborCost = actualHours * shopRate;
    const actualParts = p.phases
      .flatMap((ph) => ph.partConsumptions)
      .reduce((sum, c) => sum + Number(c.sellingPriceLockedAt ?? c.overridePrice ?? 0) * c.quantity, 0);
    const actualSpecialOrders = p.specialOrders
      .flatMap((o) => o.items)
      .reduce((sum, i) => sum + Number(i.sellingPrice) * i.quantity, 0);

    const estimatedTotal = estimatedLabor + estimatedParts;
    const actualTotal = actualLaborCost + actualParts + actualSpecialOrders;

    return {
      id: p.id,
      name: p.name,
      vehicleLabel: `${p.vehicle.year ?? ""} ${p.vehicle.make} ${p.vehicle.model}`.trim(),
      status: p.status,
      estimatedTotal,
      actualTotal,
      variance: actualTotal - estimatedTotal,
    };
  });
}

async function getTechnicianUtilization() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [entries, techs] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { status: { in: ["SUBMITTED", "APPROVED", "BILLED"] }, createdAt: { gte: since } },
      select: { techId: true, manualHours: true, startTime: true, endTime: true },
    }),
    prisma.user.findMany({ where: { role: "TECHNICIAN" }, select: { id: true, name: true, email: true } }),
  ]);

  const hoursByTech = new Map<string, number>();
  for (const e of entries) {
    const hours = computeTimeEntryHours(e);
    hoursByTech.set(e.techId, (hoursByTech.get(e.techId) ?? 0) + hours);
  }

  return techs
    .map((t) => ({
      id: t.id,
      name: t.name ?? t.email,
      hoursLast30Days: hoursByTech.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.hoursLast30Days - a.hoursLast30Days);
}

async function getInventoryValuation() {
  const parts = await prisma.part.findMany({
    select: { sku: true, description: true, quantityOnHand: true, costPrice: true, sellingPrice: true },
    orderBy: { sku: "asc" },
  });

  const rows = parts.map((p) => ({
    ...p,
    costValue: p.quantityOnHand * Number(p.costPrice),
    sellingValue: p.quantityOnHand * Number(p.sellingPrice),
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      costValue: acc.costValue + r.costValue,
      sellingValue: acc.sellingValue + r.sellingValue,
    }),
    { costValue: 0, sellingValue: 0 }
  );

  return { rows, totals };
}

async function getReceivablesAging() {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIALLY_PAID"] } },
    include: { payments: true, customer: true },
  });

  const now = Date.now();
  const buckets = { current: 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const rows = invoices.map((inv) => {
    const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Number(inv.total) - paid;
    const ageDays = Math.floor((now - (inv.sentAt ?? inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const bucket = ageDays <= 30 ? "current" : ageDays <= 60 ? "31-60" : ageDays <= 90 ? "61-90" : "90+";
    buckets[bucket] += balance;
    return { id: inv.id, invoiceNumber: inv.invoiceNumber, customerName: inv.customer.name, balance, ageDays, bucket };
  });

  return { rows, buckets };
}

export default async function ReportsPage() {
  const [profitability, utilization, valuation, aging] = await Promise.all([
    getJobProfitability(),
    getTechnicianUtilization(),
    getInventoryValuation(),
    getReceivablesAging(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <Tabs defaultValue="profitability">
        <TabsList>
          <TabsTrigger value="profitability">Job Profitability</TabsTrigger>
          <TabsTrigger value="utilization">Tech Utilization</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Valuation</TabsTrigger>
          <TabsTrigger value="aging">Receivables Aging</TabsTrigger>
        </TabsList>

        <TabsContent value="profitability" className="space-y-2">
          {profitability.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.vehicleLabel}</p>
              </div>
              <div className="text-right text-sm">
                <p>Estimated: ${p.estimatedTotal.toFixed(2)}</p>
                <p>Actual: ${p.actualTotal.toFixed(2)}</p>
                <Badge variant={p.variance > 0 ? "destructive" : "outline"}>
                  {p.variance > 0 ? "+" : ""}
                  {p.variance.toFixed(2)} variance
                </Badge>
              </div>
            </div>
          ))}
          {profitability.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
        </TabsContent>

        <TabsContent value="utilization" className="space-y-2">
          <p className="text-sm text-muted-foreground">Hours logged in the last 30 days.</p>
          {utilization.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-md border p-3">
              <span>{t.name}</span>
              <span className="font-medium">{t.hoursLast30Days.toFixed(1)} hrs</span>
            </div>
          ))}
          {utilization.length === 0 && <p className="text-sm text-muted-foreground">No technicians yet.</p>}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-2">
          <div className="flex justify-end gap-6 text-sm font-medium">
            <span>Cost basis: ${valuation.totals.costValue.toFixed(2)}</span>
            <span>Selling value: ${valuation.totals.sellingValue.toFixed(2)}</span>
          </div>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">SKU</th>
                  <th className="p-2 text-left">Qty</th>
                  <th className="p-2 text-left">Cost Value</th>
                  <th className="p-2 text-left">Selling Value</th>
                </tr>
              </thead>
              <tbody>
                {valuation.rows.map((r) => (
                  <tr key={r.sku} className="border-t">
                    <td className="p-2">{r.sku}</td>
                    <td className="p-2">{r.quantityOnHand}</td>
                    <td className="p-2">${r.costValue.toFixed(2)}</td>
                    <td className="p-2">${r.sellingValue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="aging" className="space-y-2">
          <div className="grid grid-cols-4 gap-4 text-sm">
            {Object.entries(aging.buckets).map(([bucket, amount]) => (
              <div key={bucket} className="rounded-md border p-3">
                <p className="text-muted-foreground">{bucket} days</p>
                <p className="text-lg font-semibold">${amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {aging.rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{r.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">{r.customerName}</p>
                </div>
                <Badge variant="outline">
                  ${r.balance.toFixed(2)} ({r.ageDays}d)
                </Badge>
              </div>
            ))}
            {aging.rows.length === 0 && <p className="text-sm text-muted-foreground">No outstanding invoices.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
