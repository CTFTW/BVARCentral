import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationBell } from "@/components/notification-bell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b p-4">
        <span className="text-sm text-muted-foreground">
          Signed in as {session?.user?.name ?? session?.user?.email}
        </span>
        <div className="flex items-center gap-2">
          {session?.user && <NotificationBell />}
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
