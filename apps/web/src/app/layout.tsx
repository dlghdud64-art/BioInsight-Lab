import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthSessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { LocaleProvider } from "@/components/layout/locale-provider";
import { QRScannerProviderWrapper } from "@/providers/qr-scanner-provider";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/react";

import { CompareFlowGuard } from "@/components/layout/compare-flow-guard";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
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
    <html lang="ko" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-shell font-sans text-slate-100 antialiased">
        <ThemeProvider>
          <LocaleProvider>
            <AuthSessionProvider>
              <QueryProvider>
                <QRScannerProviderWrapper>
                  {children}
                </QRScannerProviderWrapper>
                <Toaster />
                <CompareFlowGuard />

                <Analytics />
              </QueryProvider>
            </AuthSessionProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

