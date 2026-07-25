import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers/session-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Restoration ERP",
  description: "ERP for automotive restoration shops",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
