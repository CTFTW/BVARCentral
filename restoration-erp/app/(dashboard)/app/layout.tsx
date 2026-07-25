import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-white">
        {children}
      </main>
    </div>
  )
}
