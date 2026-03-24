"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Github, Mail, ExternalLink } from "lucide-react";

function scrollToId(id: string) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function MainFooter() {
  const { data: session } = useSession();
  const year = new Date().getFullYear();

  const footerColumns = [
    {
      title: "서비스",
      links: [
        { label: "홈", href: "/", onClick: null },
        { label: "서비스 소개", href: "/intro", onClick: null },
        { label: "요금제", href: "/pricing", onClick: null },
      ],
    },
    {
      title: "바로가기",
      links: session
        ? [
            { label: "대시보드", href: "/dashboard", onClick: null },
          ]
        : [
            { label: "로그인", href: "/login", onClick: null },
            { label: "회원가입", href: "/register", onClick: null },
          ],
    },
    {
      title: "고객지원",
      links: [
        { label: "도입 문의", href: "/support", onClick: null },
        { label: "이메일 문의", href: "mailto:contact@labaxis.io", onClick: null },
      ],
    },
    {
      title: "법적 고지",
      links: [
        { label: "이용약관", href: "/terms", onClick: null },
        { label: "개인정보처리방침", href: "/privacy", onClick: null },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.04]" style={{ backgroundColor: "#0e1218" }}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* 상단: 로고 + 링크 그리드 */}
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          {/* 왼쪽: 로고/설명/소셜 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-100">LabAxis</span>
              <span className="rounded-full bg-st px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-300">
                Beta
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              바이오 시약·장비 검색, 견적, 구매, 재고 관리를
              <br />하나로 연결한 운영 플랫폼입니다.
            </p>
            <div className="flex items-center gap-3 text-slate-400">
              {/* GitHub */}
              <a
                href="https://github.com/..."
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-bs hover:border-slate-500 hover:text-slate-100 transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              {/* Mail */}
              <a
                href="mailto:contact@labaxis.io"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-bs hover:border-slate-500 hover:text-slate-100 transition-colors"
                aria-label="이메일 문의"
              >
                <Mail className="h-4 w-4" />
              </a>
              {/* Notion/Docs (선택) */}
              <a
                href="#"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-bs hover:border-slate-500 hover:text-slate-100 transition-colors"
                aria-label="문서"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* 오른쪽: 링크 컬럼 그리드 */}
          <div className="grid gap-6 grid-cols-2 sm:grid-cols-4 text-xs">
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
                          className="text-slate-400 hover:text-slate-100 transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : link.onClick ? (
                        <button
                          onClick={link.onClick}
                          className="text-slate-400 hover:text-slate-100 transition-colors text-left"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-slate-400 hover:text-slate-100 transition-colors"
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
        <div className="mt-8 flex flex-col md:flex-row md:justify-between gap-2 border-t border-bs pt-4 text-center md:text-left text-[11px] text-slate-500">
          <span>&copy; {year} LabAxis. All rights reserved.</span>
          <div className="flex items-center justify-center md:justify-end gap-3">
            <Link href="/terms" className="hover:text-slate-300 transition-colors">이용약관</Link>
            <span className="text-slate-600">|</span>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
