import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// §11.210 Phase 1 — JetBrains Mono variable font (date / amount / id 표기 정합).
// tailwind.config.ts fontFamily.mono 가 var(--font-jetbrains-mono) 를 우선
// 잡아 93개 font-mono 사용처 모두 정합. 시안 "precise, technical feel" 정합.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
import { QueryProvider } from "@/providers/query-provider";
import { AuthSessionProvider } from "@/providers/session-provider";
import { AuthFocusGuard } from "@/components/auth/auth-focus-guard";
import { ThemeProvider } from "@/providers/theme-provider";
import { LocaleProvider } from "@/components/layout/locale-provider";
import { QRScannerProviderWrapper } from "@/providers/qr-scanner-provider";
import { Toaster } from "@/components/ui/toaster";
import { GlobalModal } from "@/components/global-modal";

import { Analytics } from "@vercel/analytics/react";

// §11.246d-2 #nprogress-page-transition — 호영님 P0 성능 #10 페이지 전환 NProgress 바.
//   indigo-500 / 4px / showSpinner:false. body 안 client-only render.
import { NProgressBar } from "@/components/nprogress-bar";

// §11.246d-3 #lcp-buffered-observer — 호영님 P0 §11.246e baseline 보강 (LCP RUM).
//   PerformanceObserver buffered:true 으로 LCP entry 캡처 → window.__labaxisLCP expose.
import { LcpObserverClient } from "@/components/observability/lcp-observer-client";

import { CompareFlowGuard } from "@/components/layout/compare-flow-guard";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${BRAND.domain}`),
  title: {
    default: `${BRAND.name} - 바이오 R&D 구매 플랫폼`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "바이오 시약·장비 검색, 견적, 구매, 재고 관리를 하나로 연결한 운영 플랫폼. 연구실과 조직의 구매 흐름을 통합합니다.",
  keywords: [
    "바이오",
    "제약",
    "시약",
    "연구장비",
    "견적비교",
    "RFQ",
    "실험실",
    "연구소",
    "구매 관리",
    "재고 관리",
  ],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: `https://${BRAND.domain}`,
    siteName: BRAND.name,
    title: `${BRAND.name} - 바이오 R&D 구매 플랫폼`,
    description:
      "바이오 시약·장비 검색, 견적, 구매, 재고 관리를 하나로 연결한 운영 플랫폼",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: BRAND.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} - 바이오 R&D 구매 플랫폼`,
    description:
      "바이오 시약·장비 검색, 견적, 구매, 재고 관리를 하나로 연결한 운영 플랫폼",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={jetbrainsMono.variable} suppressHydrationWarning>
      {/* §mobile-overscroll-bg(호영님 2026-07-31 지시문) — 구 bg-white가 globals.css base body
          배경(--surface-shell #F8FAFC)을 override → iOS 오버스크롤 영역 흰색 노출. bg-sh(동일 토큰)로 통일. */}
      <body className="min-h-screen bg-sh font-sans text-slate-900 antialiased">
        <NProgressBar />
        <LcpObserverClient />
        <ThemeProvider>
          <LocaleProvider>
            <AuthSessionProvider>
              <QueryProvider>
                <QRScannerProviderWrapper>
                  {children}
                  {/* §global-modal-root (2026-09-07) — 모달 렌더러를 **루트로 올린다.**
                      🔴 헤더 교체(§dashboard-header-swap)로 `DashboardHeader` 가 자체 셸 8곳에
                      붙었는데, 그 화면들은 `DashboardShell` 을 쓰지 않아 `GlobalModal` 이
                      없었다 → 스캔 버튼이 store 만 바꾸고 **아무것도 안 뜨는 dead button** 이 됐다.
                      🔑 마운트를 소비처가 기억해야 하는 규칙은 아홉 번째에서 또 빠진다 —
                      사이드바 spacer(§sidebar-spacer)와 같은 판단으로 컴포넌트를 위로 올린다.
                      🛑 `QRScannerProviderWrapper` **안**에 둔다. 원래 위치(dashboard-shell)가
                      children 안이라 이 프로바이더 아래였다 — `Toaster` 층(바깥)에 두면
                      컨텍스트 집합이 달라진다.
                      🛑 위로 올렸으면 아래는 비운다 — `dashboard-shell.tsx` 의 마운트를 제거했다.
                      안 지우면 `/dashboard/*` 에서 렌더러가 둘이 되어 store 하나에 모달 2개가
                      붙는다(포커스 트랩·애니메이션이 서로를 밟는다). */}
                  <GlobalModal />
                </QRScannerProviderWrapper>
                <Toaster />

                <CompareFlowGuard />
                {/* §auth §2 — 재포커스 세션 유효성 선제 게이트(보수적 additive, 기존 401 redirect 재사용). */}
                <AuthFocusGuard />

                <Analytics />
              </QueryProvider>
            </AuthSessionProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

