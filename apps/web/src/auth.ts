import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { requiresDestructiveConfirmation } from "@/lib/security/production-database";
import { db } from "@/lib/db";
import type { UserRole } from "@/types";
import { convertSSOConfigToProvider, validateSSOConfig } from "@/lib/auth/sso-config";
// §onboarding-blocker 3a — 가입 시 조직 자동 생성. 별도 코드가 아니라 이 경로를 탄다
//   (OWNER 부여 + workspace 생성이 여기 붙어 있다).
import { createOrganization } from "@/lib/api/organizations";
import { deriveDefaultOrgName } from "@/lib/organization/default-name";

// 중복 정의 제거
// Google OAuth 설정 확인
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const hasGoogleOAuth = googleClientId && googleClientSecret && googleClientId !== "" && googleClientSecret !== "";

/**
 * §auth-dev-login — 개발 전용 로그인 활성 조건.
 *
 * `requiresDestructiveConfirmation()` = (운영 DB host) OR (NODE_ENV=production).
 * 그 부정이 곧 "개발 환경" 이다 — 판정 규칙을 새로 만들지 않는다.
 */
const ALLOW_DEV_LOGIN = !requiresDestructiveConfirmation();

export const { handlers, signIn, signOut, auth } = NextAuth({
  // §11.370 영구화 — NextAuth v5 host 신뢰를 env(AUTH_TRUST_HOST) 의존에서
  // 코드 보장으로 전환. env 누락/재배포 누락 시에도 로그인 Configuration 재발 차단.
  // known custom domain(www.labaxis.co.kr) self-host 표준.
  trustHost: true,
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
    // §auth-dev-login — 개발 전용 로그인 (운영에서는 존재 자체가 없다)
    //
    //   왜 필요한가: 인증 수단이 Google OAuth 단독이라 우리 스스로 제품을 끝까지
    //   밟을 수단이 없었다. "사용자 앞에 세운다" 는 결정을 실행하려면 왕복 검증이
    //   상시 가능해야 한다.
    //
    //   게이트: `requiresDestructiveConfirmation()` 을 **그대로 재사용**한다
    //   (= 운영 DB host 이거나 NODE_ENV=production 이면 true).
    //   판정 규칙을 여기에 다시 쓰지 않는다 — 두 곳에 있으면 갈리고, 갈리면 뚫린다.
    //   `.env` 를 개발 DB 로 바꾸는 순간 자동으로 살아나고, 운영을 가리키면 사라진다.
    //
    //   ⚠️ 비밀번호를 검증하지 않는다. 개발 DB 의 기존 사용자로 세션을 여는 도구일 뿐이며
    //   운영에서는 배열에 **포함되지도 않는다**.
    ...(ALLOW_DEV_LOGIN ? [
      Credentials({
        id: "dev-login",
        name: "개발 로그인 (dev only)",
        credentials: { email: { label: "Email", type: "email" } },
        async authorize(credentials) {
          if (ALLOW_DEV_LOGIN !== true) return null; // 런타임 재확인 (이중 방어)
          const email = typeof credentials?.email === "string" ? credentials.email : "";
          if (!email) return null;
          const user = await db.user.findUnique({
            where: { email },
            select: { id: true, email: true, name: true, image: true, deletedAt: true },
          });
          if (user?.deletedAt) return null;

          /**
           * §auth-bootstrap-coupling — 없으면 **생성**한다 (호영님 결정 2026-08-12).
           *
           * 이전에는 기존 사용자만 로그인시켰다. 그래서 **가입 경로 자체를 검증할 수
           * 없었다** — 신규 가입은 OAuth 로만 도달했고, 조직 부트스트랩이 그 분기에
           * 묶여 있어 결함이 드러나지 않았다.
           *
           * 위험 없음: 운영 차단이 **두 겹** 앞에 있다 —
           *   `ALLOW_DEV_LOGIN`(모듈 로드 시) + `authorize` 안 런타임 재확인,
           *   그리고 그 판정은 §dev-prod-db-separation 의 **project ref** 기반이다.
           *
           * ⚠️ 생성 사실을 **반드시 로그로 남긴다** — 조용히 사용자가 생기면
           *   나중에 "이 계정 뭐지" 가 된다.
           */
          if (!user) {
            const created = await db.user.create({
              data: { email, name: null, image: null, role: "RESEARCHER" },
              select: { id: true, email: true, name: true, image: true },
            });
            console.warn(
              "[auth] dev-login — 신규 사용자 **생성** (개발 DB 전용)",
              { email, userId: created.id },
            );
            return created;
          }

          console.warn("[auth] dev-login 사용 — 개발 DB 전용 경로", { email });
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        },
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
    async jwt({ token, user, account, trigger }) {
      try {
        if (user) {
          // Prisma에서 사용자 정보 가져오기
          const dbUser = await db.user.findUnique({
            where: { email: user.email! },
            select: {
              id: true,
              role: true,
              emailVerified: true,
              name: true,
              image: true,
              deletedAt: true,
            },
          });

          // §11.133 — soft-deleted user OAuth 차단
          if (dbUser?.deletedAt) {
            console.warn(
              "[auth] OAuth attempted by soft-deleted user — refusing token",
              { email: user.email, deletedAt: dbUser.deletedAt },
            );
            return token; // token.id / token.role 미설정 → session 무효
          }

          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role as UserRole;
            // §11.116 invite acceptance — admin 이 미리 생성한 user 의
            // emailVerified 가 null 이면 OAuth 첫 로그인 시점에 자동 set.
            // image / name 도 OAuth profile 로 보강 (admin invite 시 미입력 케이스).
            if (!dbUser.emailVerified) {
              try {
                await db.user.update({
                  where: { id: dbUser.id },
                  data: {
                    emailVerified: new Date(),
                    name: dbUser.name ?? user.name ?? null,
                    image: dbUser.image ?? user.image ?? null,
                  },
                });
              } catch (linkError) {
                console.error(
                  "Error linking invited user emailVerified:",
                  linkError,
                );
              }
            }
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

          /**
           * §auth-bootstrap-coupling — 조직 부트스트랩은 **provider 와 무관**하다
           *   (호영님 결정 2026-08-12).
           *
           * 이전: 이 로직이 **신규 사용자 분기 안**에 있었다(OAuth 로 처음 들어온 경우만).
           *   그래서 dev-login·SSO·초대 등 **다른 진입 경로로 들어오면 타지 않았고**,
           *   그 사실이 드러나지 않았다 — 조용히 조직 0 인 사용자가 생길 뿐이다.
           *   dev-login 이 그것을 드러냈을 뿐, 결함은 **부트스트랩이 provider 에 결합**된 것이다.
           *
           * 지금: 조건이 "신규 사용자인가" 가 아니라 **"조직이 0 인가"** 다.
           *   어느 경로로 로그인하든 조직이 없으면 만든다.
           *
           * ⚠️ `trigger === "signIn"` 일 때만 확인한다 — jwt 콜백은 **토큰 갱신마다** 돌고,
           *   매번 조직 count 를 치면 비싸다. 로그인 시점 1회면 충분하다.
           *
           * ⚠️ `createOrganization` 을 그대로 타는 계약은 **유지**한다 — 그것이 생성자를
           *   OWNER 로 만들고 workspace 를 함께 만드는 **유일한 경로**다. 별도 코드로 만들면
           *   ① 생성자가 다시 ADMIN 이 되고 ② billing 17 라우트가 여전히 빈다.
           *
           * 이름은 **제안**이며 확정이 아니다(`OrganizationNamePrompt` 가 확인시킨다).
           * 도출 불가면 **건너뛴다** — 지어내지 않는다.
           *
           * try/catch: 조직 생성 실패가 **로그인을 막아서는 안 된다.** 실패해도 세션은
           * 유지되고 프롬프트가 조직 부재를 감지해 생성 경로를 제공한다(무음 실패 금지 —
           * 실패는 console.error 로 남기고 UI 가 이어받는다).
           */
          if (trigger === "signIn" && typeof token.id === "string") {
            try {
              const orgCount = await db.organizationMember.count({
                where: { userId: token.id },
              });
              if (orgCount === 0) {
                const defaultOrgName = deriveDefaultOrgName({
                  name: (user.name as string | null | undefined) ?? null,
                  email: (user.email as string | null | undefined) ?? null,
                });
                if (defaultOrgName) {
                  await createOrganization(token.id, { name: defaultOrgName });
                  console.warn("[auth] 조직 부트스트랩 — 조직 0 이라 자동 생성", {
                    userId: token.id,
                  });
                } else {
                  console.warn(
                    "[auth] 조직 부트스트랩 — 기본 조직명을 도출할 수 없어 건너뜁니다",
                    { userId: token.id },
                  );
                }
              }
            } catch (orgErr) {
              console.error(
                "[auth] 조직 부트스트랩 실패 (로그인은 계속)",
                orgErr,
              );
            }
          }
        }

        // ✅ 복구 로직: 최초 로그인 분기에서 DB 조회/생성이 실패했거나
        // 기존에 id 없이 캐싱된 세션 토큰을 매 요청마다 email 기반으로 복구.
        // 에러가 발생해도 세션 자체는 유지하되, id/role 누락 시 한 번 더 시도한다.
        if (!token.id && token.email) {
          try {
            const dbUser = await db.user.findUnique({
              where: { email: token.email as string },
              select: { id: true, role: true },
            });
            if (dbUser) {
              token.id = dbUser.id;
              token.role = dbUser.role as UserRole;
            }
          } catch (recoverError) {
            console.error("Error recovering token.id from email:", recoverError);
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
