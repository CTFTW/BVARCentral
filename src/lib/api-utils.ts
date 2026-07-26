import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

/**
 * Parses `take`/`skip` from a request's search params with a sane default
 * and hard cap, so list endpoints don't load unbounded result sets as
 * tables grow.
 */
export function parsePagination(searchParams: URLSearchParams) {
  const takeParam = Number(searchParams.get("take"));
  const skipParam = Number(searchParams.get("skip"));
  const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  const skip = Number.isFinite(skipParam) && skipParam > 0 ? skipParam : 0;
  return { take, skip };
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", issues: err.flatten() }, { status: 400 });
  }
  console.error(err);
  return jsonError("Internal server error", 500);
}

export async function writeAuditLog(params: {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      before: params.before as never,
      after: params.after as never,
    },
  });
}
