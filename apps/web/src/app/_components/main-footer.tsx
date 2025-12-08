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

const footerColumns = [
  {
    title: "?œí’ˆ",
    links: [
      { label: "ê°œìš”", href: "/", onClick: null },
      { label: "ê¸°ëŠ¥ ?Œê°œ", href: "#features", onClick: () => scrollToId("features") },
      { label: "?¬ìš© ?ë¦„", href: "#flow", onClick: () => scrollToId("flow") },
      { label: "?„ê? ?°ë‚˜??", href: "#personas", onClick: () => scrollToId("personas") },
      { label: "?”ê¸ˆ & ?„ì…", href: "#pricing", onClick: () => scrollToId("pricing") },
    ],
  },
  {
    title: "ê¸°ëŠ¥",
    links: [
      { label: "ê²€??Â· AI ë¶„ì„", href: "/test/search", onClick: null },
      { label: "ë¹„êµ Â· ?ˆëª© ë¦¬ìŠ¤??, href: "/test/quote", onClick: null },
      { label: "ê²¬ì  ?”ì²­", href: "/test/quote/request", onClick: null },
      { label: "?ˆì‚° Â· êµ¬ë§¤ ë¦¬í¬??, href: "#", onClick: null }, // TODO: reports
    ],
  },
  {
    title: "?œìš© ?¬ë?",
    links: [
      { label: "R&D ?°êµ¬??, href: "#personas", onClick: () => scrollToId("personas") },
      { label: "QC/QA ?¤ë¬´??, href: "#personas", onClick: () => scrollToId("personas") },
      { label: "?ì‚° ?”ì??ˆì–´", href: "#personas", onClick: () => scrollToId("personas") },
      { label: "êµ¬ë§¤ ?´ë‹¹??, href: "#personas", onClick: () => scrollToId("personas") },
    ],
  },
  {
    title: "?Œì‚¬",
    links: [
      { label: "?œë¹„???Œê°œ", href: "#", onClick: null }, // TODO: /about or Notion link
      { label: "?¼ë“œë°?Â· ë¬¸ì˜", href: "mailto:contact@bioinsight.lab", onClick: null },
      { label: "ë³€ê²?ë¡œê·¸", href: "#", onClick: null }, // TODO: /changelog or Notion
    ],
  },
  {
    title: "ë¦¬ì†Œ??,
    links: [
      { label: "?„ì?ë§?Â· ê°€?´ë“œ", href: "#", onClick: null }, // TODO: /help
      { label: "?´ìš© ?½ê?", href: "#", onClick: null }, // TODO: /terms
      { label: "ê°œì¸?•ë³´ ì²˜ë¦¬ë°©ì¹¨", href: "#", onClick: null }, // TODO: /privacy
    ],
  },
];

export function MainFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* ?ë‹¨: ë¡œê³  + ë§í¬ ê·¸ë¦¬??*/}
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          {/* ?¼ìª½: ë¡œê³ /?¤ëª…/?Œì…œ */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BioInsightLogo showText={false} className="h-6" />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-700">
                Beta
              </span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-600">
              ?°êµ¬Â·QC ?„ì¥???œì•½Â·?¥ë¹„ë¥???ë²ˆì— ê²€?‰Â·ë¹„êµí•˜ê³?
              ?¬ë‚´ ê·¸ë£¹?¨ì–´??ë¶™ì—¬?£ì„ ???ˆëŠ” êµ¬ë§¤ ì¤€ë¹??„êµ¬?…ë‹ˆ??
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
                aria-label="?´ë©”??ë¬¸ì˜"
              >
                <Mail className="h-4 w-4" />
              </a>
              {/* Notion/Docs (? íƒ) */}
              <a
                href="#"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-colors"
                aria-label="ë¬¸ì„œ"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* ?¤ë¥¸ìª? ë§í¬ ì»¬ëŸ¼ ê·¸ë¦¬??*/}
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

        {/* ?˜ë‹¨ ë°?*/}
        <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-4 text-[11px] text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span>?œêµ­??/span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>Â© {year} BioInsight Lab. All rights reserved.</span>
            <span className="hidden h-3 w-px bg-slate-300 md:inline" />
            <Link href="#" className="hover:text-slate-900 transition-colors">
              ?´ìš© ?½ê?
            </Link>
            <span className="h-3 w-px bg-slate-300" />
            <Link href="#" className="hover:text-slate-900 transition-colors">
              ê°œì¸?•ë³´ ì²˜ë¦¬ë°©ì¹¨
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
