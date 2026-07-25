import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"

export default async function InventoryPage() {
  const parts = await prisma.part.findMany({
    orderBy: { description: "asc" },
  })

  const lowStockParts = parts.filter((part: any) => part.quantity <= part.reorderThreshold)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-gray-600">Manage parts and inventory</p>
        </div>
        <Link href="/app/inventory/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Part
          </Button>
        </Link>
      </div>

      {lowStockParts.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Low Stock Alert</CardTitle>
            <CardDescription className="text-red-700">
              {lowStockParts.length} parts are below reorder threshold
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockParts.slice(0, 5).map((part: any) => (
                <div key={part.id} className="flex items-center justify-between text-sm">
                  <span>{part.description}</span>
                  <Badge variant="destructive">{part.quantity} in stock</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Parts Inventory</CardTitle>
          <CardDescription>{parts.length} parts in inventory</CardDescription>
        </CardHeader>
        <CardContent>
          {parts.length === 0 ? (
            <p className="text-center py-8 text-gray-600">No parts in inventory</p>
          ) : (
            <div className="space-y-3">
              {parts.map((part: any) => (
                <div key={part.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{part.description}</p>
                    <p className="text-sm text-gray-600">SKU: {part.sku}</p>
                    {part.category && (
                      <Badge variant="outline" className="mt-1">
                        {part.category}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${part.sellingPrice.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">
                      {part.quantity} in stock
                      {part.quantity <= part.reorderThreshold && (
                        <span className="text-red-600 ml-2">Low stock</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
