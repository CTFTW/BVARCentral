import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Restoration Shop ERP</h1>
      <p className="max-w-md text-muted-foreground">
        Project management, inventory, time tracking, and progress billing for automotive
        restoration shops.
      </p>
      <Link href="/login" className={buttonVariants({ size: "lg" })}>
        Sign in
      </Link>
    </div>
  );
}
