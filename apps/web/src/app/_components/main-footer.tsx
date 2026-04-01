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
        { label: "운영정책", href: "/operations-policy", onClick: null },
      ],
    },
  ];

  return (
    <footer>
      {/* Transition strip: warm neutral → dark closing */}
      <div style={{ backgroundColor: "#2C3340", borderTop: "1px solid #C5C3BE" }}>
        <div className="h-1.5" />
      </div>
      <div style={{ backgroundColor: "#111820" }}>
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-12">
        {/* 상단: 로고 + 링크 그리드 */}
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          {/* 왼쪽: 로고/설명/소셜 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-100">LabAxis</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-400" style={{ backgroundColor: "#1A2230" }}>
                Beta
              </span>
            </div>
            <p className="text-sm text-[#8A99AF] leading-relaxed max-w-xs">
              바이오 시약·장비 검색, 견적, 구매, 재고 관리를
              <br />하나로 연결한 운영 플랫폼입니다.
            </p>
            <div className="flex items-center gap-3">
              {/* GitHub */}
              <a
                href="https://github.com/..."
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#6A7A90] hover:text-slate-100 transition-colors"
                style={{ border: "1px solid #1E2A3A" }}
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              {/* Mail */}
              <a
                href="mailto:contact@labaxis.io"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#6A7A90] hover:text-slate-100 transition-colors"
                style={{ border: "1px solid #1E2A3A" }}
                aria-label="이메일 문의"
              >
                <Mail className="h-4 w-4" />
              </a>
              {/* Notion/Docs (선택) */}
              <a
                href="#"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#6A7A90] hover:text-slate-100 transition-colors"
                style={{ border: "1px solid #1E2A3A" }}
                aria-label="문서"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* 오른쪽: 링크 컬럼 그리드 */}
          <div className="grid gap-6 grid-cols-2 sm:grid-cols-4 text-xs">
            {footerColumns.map((col) => (
              <div key={col.title} className="space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-[#6A7A90]">
                  {col.title}
                </h4>
                <ul className="space-y-1.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("mailto:") || link.href.startsWith("http") ? (
                        <a
                          href={link.href}
                          target={link.href.startsWith("http") ? "_blank" : undefined}
                          rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                          className="text-[#9DADC0] hover:text-white transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : link.onClick ? (
                        <button
                          onClick={link.onClick}
                          className="text-[#9DADC0] hover:text-white transition-colors text-left"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-[#9DADC0] hover:text-white transition-colors"
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
        <div className="mt-10 flex flex-col md:flex-row md:justify-between gap-2 pt-5 text-center md:text-left text-[11px] text-[#6A7A90]" style={{ borderTop: "1px solid #1A2230" }}>
          <span>&copy; {year} LabAxis. All rights reserved.</span>
          <div className="flex items-center justify-center md:justify-end gap-3">
            <Link href="/terms" className="hover:text-[#C8D4E5] transition-colors">이용약관</Link>
            <span className="text-[#344257]">|</span>
            <Link href="/privacy" className="hover:text-[#C8D4E5] transition-colors">개인정보처리방침</Link>
            <span className="text-[#344257]">|</span>
            <Link href="/operations-policy" className="hover:text-[#C8D4E5] transition-colors">운영정책</Link>
          </div>
        </div>
      </div>
      </div>
    </footer>
  );
}
