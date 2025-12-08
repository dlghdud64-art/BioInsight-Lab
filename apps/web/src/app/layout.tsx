import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthSessionProvider } from "@/providers/session-provider";
import { LocaleProvider } from "@/components/layout/locale-provider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BioInsight Lab - 바이오·제약 시약·기구·장비 비교견적 플랫폼",
  description: "바이오·제약 연구자를 위한 AI 기반 시약·장비 검색·비교·견적 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <LocaleProvider>
          <AuthSessionProvider>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </AuthSessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}


