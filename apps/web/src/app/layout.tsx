import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthSessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { LocaleProvider } from "@/components/layout/locale-provider";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: {
    default: "BioInsight Lab - 바이오 R&D 구매 플랫폼",
    template: "%s | BioInsight Lab",
  },
  description:
    "바이오·제약 연구자를 위한 AI 기반 시약·장비 검색·비교·견적 플랫폼. 프로토콜 자동 분석, 다중 벤더 견적 비교, ERP 연동 지원으로 연구 효율을 극대화하세요.",
  keywords: [
    "바이오",
    "제약",
    "시약",
    "연구장비",
    "견적비교",
    "RFQ",
    "실험실",
    "연구소",
    "AI 프로토콜",
    "ERP 연동",
  ],
  authors: [{ name: "BioInsight Lab" }],
  creator: "BioInsight Lab",
  publisher: "BioInsight Lab",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://bioinsight-lab.com",
    siteName: "BioInsight Lab",
    title: "BioInsight Lab - 바이오 R&D 구매 플랫폼",
    description:
      "AI 기반 시약·장비 검색·비교·견적 플랫폼. 프로토콜 자동 분석으로 연구 효율 극대화",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BioInsight Lab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BioInsight Lab - 바이오 R&D 구매 플랫폼",
    description:
      "AI 기반 시약·장비 검색·비교·견적 플랫폼. 프로토콜 자동 분석으로 연구 효율 극대화",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <AuthSessionProvider>
              <QueryProvider>
                {children}
                <Toaster />
                <Analytics />
              </QueryProvider>
            </AuthSessionProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


