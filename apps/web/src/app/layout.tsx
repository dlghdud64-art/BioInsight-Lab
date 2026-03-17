import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthSessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { LocaleProvider } from "@/components/layout/locale-provider";
import { QRScannerProviderWrapper } from "@/providers/qr-scanner-provider";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/react";
// Theme toggle removed — app is dark-only
import { CompareFlowGuard } from "@/components/layout/compare-flow-guard";

export const metadata: Metadata = {
  title: {
    default: "LabAxis — 연구 구매 운영 플랫폼",
    template: "%s | LabAxis",
  },
  description:
    "검색부터 비교, 견적, 발주, 입고, 재고 운영까지. 연구팀의 구매·재고 운영 상태를 한눈에 관리하는 플랫폼.",
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
  authors: [{ name: "LabAxis" }],
  creator: "LabAxis",
  publisher: "LabAxis",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://labaxis.io",
    siteName: "LabAxis",
    title: "LabAxis — 연구 구매 운영 플랫폼",
    description:
      "검색부터 비교, 견적, 발주, 입고, 재고 운영까지. 연구팀의 구매·재고 운영을 한눈에 관리.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LabAxis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LabAxis — 연구 구매 운영 플랫폼",
    description:
      "검색부터 비교, 견적, 발주, 입고, 재고 운영까지. 연구팀의 구매·재고 운영을 한눈에 관리.",
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
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
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


