import { NextResponse } from "next/server";

// Lightweight, unauthenticated liveness endpoint used by the Docker/Compose
// healthcheck to gate nginx from proxying to the app before it's ready.
export async function GET() {
  return NextResponse.json({ ok: true });
}
