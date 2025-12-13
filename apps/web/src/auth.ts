import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import type { UserRole } from "@/types";
import { convertSSOConfigToProvider, validateSSOConfig } from "@/lib/auth/sso-config";

// 중복 정의 제거
export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      try {
        if (session.user && token) {
          session.user.id = token.id as string;
          session.user.role = token.role as UserRole;
        }
        return session;
      } catch (error) {
        console.error("Error in session callback:", error);
        return session;
      }
    },
    async jwt({ token, user, account }) {
      try {
        if (user) {
          // Prisma에서 사용자 정보 가져오기
          const dbUser = await db.user.findUnique({
            where: { email: user.email! },
            select: { id: true, role: true },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role as UserRole;
          }
        }
        return token;
      } catch (error) {
        console.error("Error in jwt callback:", error);
        return token;
      }
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user.email) {
        // 사용자가 없으면 생성
        const existingUser = await db.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          await db.user.create({
            data: {
              email: user.email,
              name: user.name || null,
              image: user.image || null,
              role: "RESEARCHER", // 기본 역할
            },
          });
        }
      }
      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
