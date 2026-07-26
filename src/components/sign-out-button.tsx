import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

// Uses the server-side `signOut` from the NextAuth config via a Server
// Action, avoiding a client-side next-auth/react dependency just for this.
export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  );
}
