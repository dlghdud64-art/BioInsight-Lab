"use client";

import Link from "next/link";
import { useState } from "react";
import { MainLayout } from "../_components/main-layout";
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
} from "lucide-react";

const INQUIRY_TYPES = [
  {
    key: "service",
    icon: Search,
    title: "서비스 이용 문의",
    description: "검색·비교·견적 요청 등 플랫폼 기능 사용 중 궁금한 점",
    placeholder: "사용 중 궁금한 점이나 불편한 점을 구체적으로 남겨주세요.",
  },
  {
    key: "pricing",
    icon: Building2,
    title: "도입 및 요금 문의",
    description: "기관·기업 단위 도입, 플랜 선택, 계약 조건 관련 문의",
    placeholder: "기관/기업명, 예상 사용자 수, 필요한 기능, 도입 시기 등을 남겨주세요.",
  },
  {
    key: "sourcing",
    icon: FileText,
    title: "견적·소싱 관련 문의",
    description: "특정 시약·장비 소싱 지원이나 맞춤 견적 요청",
    placeholder: "필요한 품목, 용도, 수량, 희망 제조사 또는 조건 등을 남겨주세요.",
  },
  {
    key: "account",
    icon: LogIn,
    title: "계정 및 로그인 문제",
    description: "로그인 오류, 계정 연동, 비밀번호 재설정 등",
    placeholder: "문제가 발생한 계정, 로그인 오류 내용, 발생 시점 등을 적어주세요.",
  },
];

const DEFAULT_PLACEHOLDER = "문의 내용을 자세히 적어주세요. 도입 문의라면 기관/기업 정보를 함께 남겨주시면 더 빠르게 안내해드립니다.";

export default function SupportPage() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

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

  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full pt-14">

        {/* ── 페이지 헤더 ── */}
        <section className="bg-[#09090b] border-b border-[#1e1e23] py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-4 md:px-6 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">
              Support &amp; Contact
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100 mb-4 tracking-tight leading-[1.4]">
              도입 문의 및 서비스 안내
            </h1>
            <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-xl mx-auto">
              LabAxis 도입을 검토 중이거나, 요금·기능에 대해 궁금한 점이 있으신가요?
              <br className="hidden sm:block" />
              담당팀이 확인 후 빠르게 안내해드립니다.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-16 space-y-12">

          {/* ── 문의 유형 선택 ── */}
          <section>
            <h2 className="text-sm font-semibold text-slate-100 mb-5">어떤 문의가 필요하신가요?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INQUIRY_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedType === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedType(item.key)}
                    className={`w-full text-left rounded-md border p-4 flex items-start gap-3 transition-all duration-150 ${
                      isSelected
                        ? "border-blue-500/60 bg-blue-500/5"
                        : "border-[#1e1e23] bg-[#131316] hover:border-[#2a2a30] hover:bg-[#16161a]"
                    }`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium mb-0.5 ${isSelected ? "text-slate-100" : "text-slate-200"}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 문의 폼 ── */}
          <section>
            <h2 className="text-sm font-semibold text-slate-100 mb-1.5">문의 남기기</h2>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              문의 내용을 남겨주시면 확인 후 순차적으로 답변드립니다.
              도입 상담이나 기관·기업 문의는 우선 검토 후 별도로 안내드립니다.
            </p>

            {submitted ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-6 py-8 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-100 mb-1">문의가 접수되었습니다.</p>
                <p className="text-xs text-slate-400">확인 후 순차적으로 답변 드리겠습니다. 평일 기준으로 처리됩니다.</p>
                <Button
                  variant="outline"
                  className="mt-5 border-[#2a2a30] text-slate-300 hover:bg-[#1a1a1e]"
                  onClick={handleReset}
                >
                  다른 문의 남기기
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {selectedInquiry && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-500/5 border border-blue-500/20">
                    <span className="text-[11px] font-medium text-slate-400">선택된 문의 유형:</span>
                    <span className="text-[11px] text-blue-400 font-medium">{selectedInquiry.title}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">이름 또는 기관명</label>
                    <input
                      type="text"
                      required
                      placeholder="홍길동 / BioLab Institute"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-md border border-[#1e1e23] bg-[#131316] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">이메일</label>
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-md border border-[#1e1e23] bg-[#131316] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">문의 내용</label>
                  <textarea
                    required
                    rows={5}
                    placeholder={selectedInquiry?.placeholder ?? DEFAULT_PLACEHOLDER}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full rounded-md border border-[#1e1e23] bg-[#131316] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition resize-none"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-10 px-6 flex items-center gap-2 text-sm"
                  >
                    문의 남기기
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <p className="text-[11px] text-slate-500">평일 기준 순차적으로 답변드립니다.</p>
                </div>
              </form>
            )}
          </section>

          {/* ── 이메일 직접 문의 ── */}
          <section className="rounded-md border border-[#1e1e23] bg-[#131316] px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-200 mb-0.5">이메일로 직접 문의하기</p>
              <p className="text-xs text-slate-500">위 양식 대신 이메일로 바로 문의하실 수도 있습니다.</p>
            </div>
            <a
              href="mailto:support@labaxis.io"
              className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
            >
              <Mail className="h-4 w-4" />
              support@labaxis.io
            </a>
          </section>

          {/* ── 문의 후 다음 단계 ── */}
          <section className="rounded-md border border-[#1e1e23] bg-[#131316] p-5 space-y-4">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">문의 후 다음 단계</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { href: "/intro", icon: FileText, label: "서비스 소개" },
                { href: "/pricing", icon: Building2, label: "요금 & 도입" },
                { href: "/auth/signin", icon: LogIn, label: "로그인" },
                { href: "/support", icon: Mail, label: "고객 지원" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-col items-center gap-1.5 rounded-md border border-[#1e1e23] bg-[#0e0e12] px-3 py-3 hover:border-[#2a2a30] hover:bg-[#16161a] transition-colors"
                  >
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span className="text-[11px] font-medium text-slate-400">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>

        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
