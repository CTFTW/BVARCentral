"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  FolderKanban,
  Package,
  Clock,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Projects", href: "/app/projects", icon: FolderKanban },
  { name: "Customers", href: "/app/customers", icon: Users },
  { name: "Inventory", href: "/app/inventory", icon: Package },
  { name: "Time Tracking", href: "/app/time-tracking", icon: Clock },
  { name: "Billing", href: "/app/billing", icon: FileText },
  { name: "Reports", href: "/app/reports", icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r bg-gray-50">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/app" className="flex items-center space-x-2">
          <span className="text-xl font-bold">Restoration ERP</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-200 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-3">
        <Link href="/app/settings">
          <Button variant="ghost" className="w-full justify-start gap-3">
            <Settings className="h-5 w-5" />
            Settings
          </Button>
        </Link>
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => signOut()}>
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}

function signOut() {
  window.location.href = "/api/auth/signout"
}
