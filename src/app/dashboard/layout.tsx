import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b p-4">
        <span className="text-sm text-muted-foreground">
          Signed in as {session?.user?.name ?? session?.user?.email} ({session?.user?.role})
        </span>
        <SignOutButton />
      </header>
      {children}
    </div>
  );
}
