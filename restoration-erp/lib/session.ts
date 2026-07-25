import { auth } from "@/lib/auth"

export async function getSession() {
  return await auth()
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
}

export async function requireAuth() {
  const session = await getSession()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function requireRole(...roles: string[]) {
  const session = await getSession()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (!roles.includes(session.user.role as string)) {
    throw new Error("Forbidden")
  }
  return session
}
