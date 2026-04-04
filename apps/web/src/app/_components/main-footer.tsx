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
    <footer style={{ backgroundColor: "#040c1a" }}>
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-10">
        {/* 상단: 로고 + 링크 그리드 */}
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          {/* 왼쪽: 로고/설명/소셜 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight" style={{ color: "#D9E2F1" }}>LabAxis</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide" style={{ backgroundColor: "#152035", color: "#8A97AA" }}>
                Beta
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "#8A97AA" }}>
              바이오 시약·장비 검색, 견적, 구매, 재고 관리를
              <br />하나로 연결한 운영 플랫폼입니다.
            </p>
            <div className="flex items-center gap-3">
              {/* GitHub */}
              <a
                href="https://github.com/..."
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ border: "1px solid rgba(217,226,241,0.10)", color: "#8A97AA" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#8A97AA"; }}
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              {/* Mail */}
              <a
                href="mailto:contact@labaxis.io"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ border: "1px solid rgba(217,226,241,0.10)", color: "#8A97AA" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#8A97AA"; }}
                aria-label="이메일 문의"
              >
                <Mail className="h-4 w-4" />
              </a>
              {/* Notion/Docs (선택) */}
              <a
                href="#"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ border: "1px solid rgba(217,226,241,0.10)", color: "#8A97AA" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#8A97AA"; }}
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
                <h4 className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#8A97AA" }}>
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
                          className="transition-colors" style={{ color: "#8A97AA" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#8A97AA"; }}
                        >
                          {link.label}
                        </a>
                      ) : link.onClick ? (
                        <button
                          onClick={link.onClick}
                          className="transition-colors text-left"
                          style={{ color: "#8A97AA" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#8A97AA"; }}
                        >
                          {link.label}
                        </button>
                      ) : (
                        <Link
                          href={link.href}
                          className="transition-colors" style={{ color: "#8A97AA" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#8A97AA"; }}
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
        <div className="mt-8 flex flex-col md:flex-row md:justify-between gap-2 pt-5 text-center md:text-left text-[11px]" style={{ borderTop: "1px solid rgba(217,226,241,0.10)", color: "#8A97AA" }}>
          <span>&copy; {year} LabAxis. All rights reserved.</span>
          <div className="flex items-center justify-center md:justify-end gap-3">
            <Link href="/terms" className="transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "inherit"; }}>이용약관</Link>
            <span style={{ color: "rgba(217,226,241,0.15)" }}>|</span>
            <Link href="/privacy" className="transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "inherit"; }}>개인정보처리방침</Link>
            <span style={{ color: "rgba(217,226,241,0.15)" }}>|</span>
            <Link href="/operations-policy" className="transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.color = "#D9E2F1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "inherit"; }}>운영정책</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
