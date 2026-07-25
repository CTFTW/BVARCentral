import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const error = searchParams.error || "An error occurred during authentication"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/auth/login"
            className="text-blue-600 hover:underline"
          >
            Back to login
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
