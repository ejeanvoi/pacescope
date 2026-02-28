import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import "@/types";

// Edge-safe auth config — no Prisma imports
// The actual authorize logic is in auth.ts
export default {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize is overridden in auth.ts
      authorize: () => null,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
      }
      return session;
    },
    authorized({ auth }) {
      return !!auth;
    },
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
