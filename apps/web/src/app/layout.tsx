import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthSessionProvider } from "@/providers/session-provider";
import { LocaleProvider } from "@/components/layout/locale-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "BioInsight Lab - 바이오·제약 시약·기구·장비 비교견적 플랫폼",
  description: "바이오·제약 연구자를 위한 AI 기반 시약·장비 검색·비교·견적 플랫폼",
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
      <body>
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


