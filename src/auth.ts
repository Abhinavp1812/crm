import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.toLowerCase().trim();
        const password = credentials?.password as string;
        if (!email || !password) return null;

        // Super admin — lives only in env, never in DB
        const superEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
        const superPassword = process.env.SUPER_ADMIN_PASSWORD;
        if (superEmail && superPassword && email === superEmail && password === superPassword) {
          return { id: "super-admin", email: superEmail, name: "Super Admin", role: "ADMIN" };
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        if (user.onLeaveFrom || user.onLeaveUntil) {
          try {
            await prisma.user.update({ where: { id: user.id }, data: { onLeaveFrom: null, onLeaveUntil: null } });
          } catch { /* ignore */ }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          // photoUpdatedAt lets the client build a cache-busting URL for /api/profile/photo
          // We never store the actual photo data in the JWT — that causes HTTP 431
          photoUpdatedAt: user.updatedAt.getTime(),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.photoUpdatedAt = (user as { photoUpdatedAt?: number }).photoUpdatedAt ?? 0;
      }

      // Re-sync name + photoUpdatedAt from DB when:
      // 1. trigger === "update" — user just saved their profile
      // 2. photoUpdatedAt is missing — old session that pre-dates this field
      const needsSync =
        (trigger === "update" || token.photoUpdatedAt === undefined) &&
        token.uid &&
        token.uid !== "super-admin";

      if (needsSync) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { name: true, updatedAt: true },
        });
        if (dbUser) {
          token.name = dbUser.name;
          token.photoUpdatedAt = dbUser.updatedAt.getTime();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as "ADMIN" | "AGENT";
        if (token.name) session.user.name = token.name as string;
        session.user.photoUpdatedAt = token.photoUpdatedAt as number ?? 0;
      }
      return session;
    },
  },
});
