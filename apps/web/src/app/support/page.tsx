"use client";

import Link from "next/link";
import { useState } from "react";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Button } from "@/components/ui/button";
import {
  Search,
  Building2,
  FileText,
  LogIn,
  Mail,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";

const INQUIRY_TYPES = [
  {
    key: "service",
    icon: Search,
    label: "기능",
    title: "서비스 이용 문의",
    description: "플랫폼 기능 사용 중 궁금한 점",
    formTitle: "어떤 기능을 검토 중이신가요?",
    placeholder: "사용 중인 기능, 발생한 문제, 기대하는 동작 등을 구체적으로 남겨주세요.",
  },
  {
    key: "pricing",
    icon: Building2,
    label: "도입",
    title: "도입 및 요금 문의",
    description: "기관·기업 단위 도입, 플랜, 계약 조건",
    formTitle: "팀 규모와 도입 목적을 알려주세요",
    placeholder: "기관/기업명, 예상 사용자 수, 필요한 기능, 도입 희망 시기 등을 남겨주세요.",
  },
  {
    key: "sourcing",
    icon: FileText,
    label: "견적",
    title: "견적·소싱 관련 문의",
    description: "특정 품목 소싱 지원이나 맞춤 견적 요청",
    formTitle: "어떤 품목 또는 흐름에서 도움이 필요한가요?",
    placeholder: "필요한 품목, 용도, 수량, 희망 제조사 또는 조건 등을 남겨주세요.",
  },
  {
    key: "account",
    icon: LogIn,
    label: "계정",
    title: "계정 및 로그인 문제",
    description: "로그인 오류, 계정 연동, 비밀번호",
    formTitle: "문제가 발생한 계정 정보를 알려주세요",
    placeholder: "문제가 발생한 계정, 로그인 오류 내용, 발생 시점 등을 적어주세요.",
  },
];

const DEFAULT_FORM_TITLE = "문의 내용을 남겨주세요";
const DEFAULT_PLACEHOLDER = "문의 내용을 자세히 적어주세요. 도입 문의라면 기관/기업 정보를 함께 남겨주시면 더 빠르게 안내해드립니다.";

export default function SupportPage() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [copied, setCopied] = useState(false);

  const selectedInquiry = INQUIRY_TYPES.find((t) => t.key === selectedType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setSelectedType(null);
    setForm({ name: "", email: "", message: "" });
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("support@labaxis.io");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <MainHeader />

      {/* ═══ LAYER 1: Branded Hero — deep navy, 짧고 간결 ═══ */}
      <section
        className="pt-14"
        style={{
          background: "linear-gradient(180deg, #020617 0%, #0B1A33 60%, #1A2D4D 100%)",
        }}
      >
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400/70 mb-3">
            SUPPORT
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
            도입 문의 및 서비스 안내
          </h1>
          <p className="text-sm md:text-base text-slate-400 leading-relaxed">
            담당팀이 확인 후 빠르게 안내해드립니다.
          </p>
        </div>
      </section>

      {/* ═══ LAYER 2: Execution Surface — 밝은 중성 배경 ═══ */}
      <div className="flex-1" style={{ backgroundColor: "#F3F6FB" }}>
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-10 md:py-14 space-y-10">

          {/* ── 문의 유형 selector ── */}
          <section>
            <h2 style={{ color: "#0F1728" }} className="text-base font-bold mb-5">
              어떤 문의가 필요하신가요?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {INQUIRY_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedType === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedType(item.key)}
                    className="w-full text-left transition-all duration-150 rounded-lg p-4"
                    style={{
                      backgroundColor: isSelected ? "#FFFFFF" : "#FFFFFF",
                      border: isSelected ? "2px solid #2F6BFF" : "1px solid #E3EAF4",
                      boxShadow: isSelected ? "0 2px 8px rgba(47,107,255,0.10)" : "none",
                    }}
                  >
                    {/* accent bar on selected */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: isSelected ? "#EBF1FF" : "#F3F6FB",
                        }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: isSelected ? "#2F6BFF" : "#8A97AA" }}
                        />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-3.5 w-3.5 ml-auto flex-shrink-0" style={{ color: "#2F6BFF" }} />
                      )}
                    </div>
                    <p
                      className="text-sm font-semibold mb-0.5"
                      style={{ color: isSelected ? "#0F1728" : "#3D4A5C" }}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#8A97AA" }}>
                      {item.description}
                    </p>
                    <span
                      className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: isSelected ? "#EBF1FF" : "#F3F6FB",
                        color: isSelected ? "#2F6BFF" : "#A0AABB",
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 문의 폼 — light execution panel ── */}
          <section
            className="rounded-xl p-6 md:p-8"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E3EAF4",
            }}
          >
            <h2 className="text-base font-bold mb-1" style={{ color: "#0F1728" }}>
              {selectedInquiry?.formTitle ?? DEFAULT_FORM_TITLE}
            </h2>
            <p className="text-xs mb-6" style={{ color: "#8A97AA" }}>
              확인 후 순차적으로 답변드립니다. 도입 상담은 우선 검토 후 별도 안내드립니다.
            </p>

            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-3" style={{ color: "#10B981" }} />
                <p className="text-base font-semibold mb-1" style={{ color: "#0F1728" }}>
                  문의가 접수되었습니다.
                </p>
                <p className="text-sm" style={{ color: "#5B6678" }}>
                  확인 후 순차적으로 답변 드리겠습니다. 평일 기준으로 처리됩니다.
                </p>
                <button
                  onClick={handleReset}
                  className="mt-5 text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                  style={{
                    color: "#2F6BFF",
                    border: "1px solid #D5DFEF",
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  다른 문의 남기기
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {selectedInquiry && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{
                      backgroundColor: "#F0F4FF",
                      border: "1px solid #D5DFEF",
                      color: "#2F6BFF",
                    }}
                  >
                    <span className="font-semibold">선택:</span>
                    <span>{selectedInquiry.title}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3D4A5C" }}>
                      이름 또는 기관명
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="홍길동 / BioLab Institute"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      style={{
                        backgroundColor: "#F8FAFC",
                        border: "1px solid #E3EAF4",
                        color: "#0F1728",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3D4A5C" }}>
                      이메일
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      style={{
                        backgroundColor: "#F8FAFC",
                        border: "1px solid #E3EAF4",
                        color: "#0F1728",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#3D4A5C" }}>
                    문의 내용
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder={selectedInquiry?.placeholder ?? DEFAULT_PLACEHOLDER}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                    style={{
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E3EAF4",
                      color: "#0F1728",
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: "#A0AABB" }}>
                    구체적으로 작성할수록 빠르게 안내해드릴 수 있습니다.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    className="font-semibold h-11 px-7 flex items-center gap-2 rounded-lg text-sm shadow-sm"
                    style={{ backgroundColor: "#2F6BFF", color: "#FFFFFF" }}
                  >
                    문의 남기기
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <p className="text-xs" style={{ color: "#A0AABB" }}>
                    평일 기준 순차적으로 답변드립니다.
                  </p>
                </div>
              </form>
            )}
          </section>

          {/* ── 이메일 직접 문의 — compact strip ── */}
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-5 py-3"
            style={{
              backgroundColor: "#EDF2F8",
              border: "1px solid #E3EAF4",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="h-4 w-4 flex-shrink-0" style={{ color: "#8A97AA" }} />
              <span className="text-xs" style={{ color: "#5B6678" }}>
                이메일로 직접 문의
              </span>
              <a
                href="mailto:support@labaxis.io"
                className="text-xs font-medium hover:underline"
                style={{ color: "#2F6BFF" }}
              >
                support@labaxis.io
              </a>
            </div>
            <button
              onClick={handleCopyEmail}
              className="flex items-center gap-1 text-xs flex-shrink-0 px-2.5 py-1.5 rounded-md transition-colors"
              style={{
                color: copied ? "#10B981" : "#8A97AA",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E3EAF4",
              }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>

          {/* ── 추가 문서 — compact utility links ── */}
          <nav>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8A97AA" }}>
              추가로 확인할 수 있는 문서
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { href: "/intro", label: "서비스 소개" },
                { href: "/pricing", label: "요금 & 도입" },
                { href: "/auth/signin", label: "로그인" },
                { href: "/privacy", label: "개인정보처리방침" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-xs font-medium px-3 py-2.5 rounded-lg text-center transition-colors"
                  style={{
                    color: "#5B6678",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E3EAF4",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

        </div>
      </div>

      {/* ═══ LAYER 3: Footer ═══ */}
      <MainFooter />
    </div>
  );
}
