import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// NOTE: The Prisma adapter's default schema is designed around OAuth + email
// verification flows. Staff credentials auth is handled separately below via
// a custom Credentials provider that checks passwordHash on the User model.
// Customer "magic-link" auth reuses NextAuth's Email provider semantics by
// issuing a verification token and emailing a portal login link (see
// src/lib/mailer.ts and the /api/auth/customer-link route).

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "staff-credentials",
      name: "Staff Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.active) return null;
        if (user.role === "CUSTOMER") return null; // customers use magic-link only

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      id: "customer-magic-link",
      name: "Customer Portal Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token as string | undefined;
        if (!token) return null;

        const record = await prisma.verificationToken.findFirst({
          where: { token, expires: { gt: new Date() } },
        });
        if (!record) return null;

        const user = await prisma.user.findUnique({
          where: { email: record.identifier },
        });
        if (!user || user.role !== "CUSTOMER" || !user.active) return null;

        // Consume the token (single use)
        await prisma.verificationToken.delete({
          where: { identifier_token: { identifier: record.identifier, token } },
        });

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      // Re-validate role/active from the database on every token refresh
      // (not just at initial sign-in) so deactivating a user or changing
      // their role takes effect without waiting for the JWT to expire.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, active: true },
        });
        token.role = dbUser?.role;
        token.active = dbUser?.active ?? false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.active = token.active as boolean;
      }
      return session;
    },
    async signIn({ user }) {
      // Blocks sign-in for inactive users, including newly self-registered
      // OAuth accounts (active defaults to false until an Admin activates
      // them via the admin user management API).
      if (user && (user as { active?: boolean }).active === false) return false;
      return true;
    },
  },
});
