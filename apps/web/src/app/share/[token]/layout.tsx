import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Quote - AI BioCompare",
  description: "View shared quote information",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
