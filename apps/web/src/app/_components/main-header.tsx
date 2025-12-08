"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { Button } from "@/components/ui/button";

function scrollToId(id: string) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function MainHeader() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Ï¢åÏ∏°: Î°úÍ≥† + ?πÏÖò ?§ÎπÑ */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <BioInsightLogo />
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-slate-600">
            <button
              onClick={() => scrollToId("features")}
              className="hover:text-slate-900 transition-colors"
            >
              Í∏∞Îä• ?åÍ∞ú
            </button>
            <button
              onClick={() => scrollToId("flow")}
              className="hover:text-slate-900 transition-colors"
            >
              ?¨Ïö© ?êÎ¶Ñ
            </button>
            <button
              onClick={() => scrollToId("personas")}
              className="hover:text-slate-900 transition-colors"
            >
              ?ÑÍ? ?∞ÎÇò??
            </button>
          </nav>
        </div>

        {/* ?∞Ï∏°: CTA/?†Ìã∏ */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => scrollToId("pricing")}
            className="text-xs text-slate-600 hover:text-slate-900 transition-colors"
          >
            ?îÍ∏à & ?ÑÏûÖ
          </button>
          <Button
            size="sm"
            onClick={() => router.push("/test/search")}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            Í∏∞Îä• Ï≤¥Ìóò
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
