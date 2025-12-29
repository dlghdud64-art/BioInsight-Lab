import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import type { UserRole } from "@/types";
import { convertSSOConfigToProvider, validateSSOConfig } from "@/lib/auth/sso-config";

// 중복 정의 제거
// Google OAuth 설정 확인
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const hasGoogleOAuth = googleClientId && googleClientSecret && googleClientId !== "" && googleClientSecret !== "";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // JWT 전략을 사용할 때는 adapter를 사용하지 않습니다
  // adapter: PrismaAdapter(db),
  providers: [
    // Google OAuth가 설정된 경우에만 추가
    ...(hasGoogleOAuth ? [
      Google({
        clientId: googleClientId!,
        clientSecret: googleClientSecret!,
      }),
    ] : []),
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
          } else if (user.email) {
            // 사용자가 없으면 생성
            const newUser = await db.user.create({
              data: {
                email: user.email,
                name: user.name || null,
                image: user.image || null,
                role: "RESEARCHER", // 기본 역할
              },
            });
            token.id = newUser.id;
            token.role = newUser.role as UserRole;
          }
        }
        return token;
      } catch (error) {
        console.error("Error in jwt callback:", error);
        return token;
      }
    },
    async signIn({ user, account, profile }) {
      // JWT 전략에서는 signIn 콜백에서 사용자 생성하지 않음
      // jwt 콜백에서 처리
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
