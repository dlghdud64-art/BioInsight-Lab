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
    title: "제품",
    links: [
      { label: "개요", href: "/", onClick: null },
      { label: "기능 소개", href: "#features", onClick: () => scrollToId("features") },
      { label: "사용 흐름", href: "#flow", onClick: () => scrollToId("flow") },
      { label: "누가 쓰나요?", href: "#personas", onClick: () => scrollToId("personas") },
      { label: "요금 & 도입", href: "#pricing", onClick: () => scrollToId("pricing") },
    ],
  },
  {
    title: "기능",
    links: [
      { label: "검색 · AI 분석", href: "/test/search", onClick: null },
      { label: "비교 · 품목 리스트", href: "/test/quote", onClick: null },
      { label: "견적 요청", href: "/test/quote/request", onClick: null },
      { label: "예산 · 구매 리포트", href: "#", onClick: null }, // TODO: reports
    ],
  },
  {
    title: "활용 사례",
    links: [
      { label: "R&D 연구자", href: "#personas", onClick: () => scrollToId("personas") },
      { label: "QC/QA 실무자", href: "#personas", onClick: () => scrollToId("personas") },
      { label: "생산 엔지니어", href: "#personas", onClick: () => scrollToId("personas") },
      { label: "구매 담당자", href: "#personas", onClick: () => scrollToId("personas") },
    ],
  },
  {
    title: "회사",
    links: [
      { label: "서비스 소개", href: "#", onClick: null }, // TODO: /about or Notion link
      { label: "피드백 · 문의", href: "mailto:contact@bioinsight.lab", onClick: null },
      { label: "변경 로그", href: "#", onClick: null }, // TODO: /changelog or Notion
    ],
  },
  {
    title: "리소스",
    links: [
      { label: "도움말 · 가이드", href: "#", onClick: null }, // TODO: /help
      { label: "이용 약관", href: "#", onClick: null }, // TODO: /terms
      { label: "개인정보 처리방침", href: "#", onClick: null }, // TODO: /privacy
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
              <BioInsightLogo showText={false} className="h-6" />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-700">
                Beta
              </span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-600">
              연구·QC 현장의 시약·장비를 한 번에 검색·비교하고,
              사내 그룹웨어에 붙여넣을 수 있는 구매 준비 도구입니다.
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
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 text-xs">
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
        <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-4 text-[11px] text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span>한국어</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>© {year} BioInsight Lab. All rights reserved.</span>
            <span className="hidden h-3 w-px bg-slate-300 md:inline" />
            <Link href="#" className="hover:text-slate-900 transition-colors">
              이용 약관
            </Link>
            <span className="h-3 w-px bg-slate-300" />
            <Link href="#" className="hover:text-slate-900 transition-colors">
              개인정보 처리방침
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
