import type { NextAuthConfig } from "next-auth";
import "@/types";

// Edge-safe auth config — no Prisma imports
// Providers are defined in auth.ts (non-edge-safe due to Prisma)
export default {
  providers: [],
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
