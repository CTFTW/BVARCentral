"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyPortalLinkPage() {
  return (
    <Suspense>
      <VerifyPortalLinkInner />
    </Suspense>
  );
}

function VerifyPortalLinkInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing or invalid link.");
      return;
    }
    signIn("customer-magic-link", { token, redirect: false }).then((res) => {
      if (res?.error) {
        setError("This link is invalid or has expired. Please request a new one.");
      } else {
        router.push("/portal");
      }
    });
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 text-center">
      {error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <p className="text-muted-foreground">Signing you in...</p>
      )}
    </div>
  );
}
