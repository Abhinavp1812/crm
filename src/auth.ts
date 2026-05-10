import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days (your locked spec)
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
        // If user was marked on leave, bring them back when they successfully login
        if (user.onLeaveFrom || user.onLeaveUntil) {
          try {
            await prisma.user.update({ where: { id: user.id }, data: { onLeaveFrom: null, onLeaveUntil: null } });
          } catch {
            // ignore update errors for login
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as "ADMIN" | "AGENT";
      }
      return session;
    },
  },
});