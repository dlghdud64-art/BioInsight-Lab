"use client";

import Link from "next/link";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { Github, Mail, ExternalLink } from "lucide-react";

function scrollToId(id: string) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
const footerColumns = [
  {
    title: "서비스",
    links: [
      { label: "홈", href: "/", onClick: null },
      { label: "서비스 소개", href: "/intro", onClick: null },
      { label: "기능", href: "/intro#features", onClick: () => scrollToId("features") },
    ],
  },
  {
    title: "바로가기",
    links: [
      { label: "대시보드", href: "/dashboard", onClick: null },
      { label: "로그인", href: "/login", onClick: null },
    ],
  },
];

export function MainFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* 상단: 로고 + 링크 그리드 */}
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          {/* 왼쪽: 로고/설명/소셜 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BioInsightLogo showText={true} className="h-6" />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-700">
                Beta
              </span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-600">
              연구·QC 현장의 시약·장비를 한 번에 검색·비교하고, 견적요청/구매요청용 리스트로 정리해 공유하는 도구입니다.
            </p>
            <div className="flex items-center gap-3 text-slate-600">
              {/* GitHub */}
              <a
                href="https://github.com/..."
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              {/* Mail */}
              <a
                href="mailto:contact@bioinsight.lab"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-colors"
                aria-label="이메일 문의"
              >
                <Mail className="h-4 w-4" />
              </a>
              {/* Notion/Docs (선택) */}
              <a
                href="#"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-colors"
                aria-label="문서"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* 오른쪽: 링크 컬럼 그리드 */}
          <div className="grid gap-8 sm:grid-cols-2 text-xs">
            {footerColumns.map((col) => (
              <div key={col.title} className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {col.title}
                </h4>
                <ul className="space-y-1">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("mailto:") || link.href.startsWith("http") ? (
                        <a
                          href={link.href}
                          target={link.href.startsWith("http") ? "_blank" : undefined}
                          rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                          className="text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : link.onClick ? (
                        <button
                          onClick={link.onClick}
                          className="text-slate-600 hover:text-slate-900 transition-colors text-left"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 바 */}
        <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
          <span>© {year} BioInsight Lab. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
