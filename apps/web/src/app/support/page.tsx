"use client";

/**
 * §contact-redesign P1 — 도입·문의 페이지(시안 A) 리디자인.
 *
 * 정본: contact/도입 문의 페이지 구현 지시문 + LabAxis 도입 문의 시안.html.
 * 호영님 룰링:
 *   ① 공개 예외 OK — 단 경계 = ontology 무접촉. 본 도우미는 제품 DB/실데이터(재고·가격·계정)
 *      조회 0, 정적 공개 FAQ(아래 TOPICS 큐레이션 + 제품사실)에만 근거. 넘으면 즉시 금지.
 *   ② P1 = 룰베이스 분류기 + 큐레이션 폴백(라이브 LLM 0). "AI" 라벨 금지 → "문의 도우미/빠른 답변"
 *      (라이브 모델 붙는 P2에서 "AI" 부여). 비용·키·인젝션·레이트리밋 전부 회피.
 *   ③ 정직성: 가격·SLA·고객사 단정 금지 → "문의 시 안내". 1인 운영 = "빠른 답변 + 담당자 비동기 회신"
 *      (전화·전담매니저·실시간 SLA 약속 금지). 신뢰 사이드바 = 실값 없으면 비움(가짜 숫자/고객사 0).
 *   - 제출: 기존 POST /api/support/inquiry 재사용(신규 API 0). classifyTopic 결과 → inquiryType 매핑.
 *
 * P2(후속): /api/support/ai-assist 라이브 AI(시스템프롬프트+looksListy/trimAns+폴백+레이트리밋·인젝션 가드).
 */

import { useMemo, useState, useRef } from "react";
import { csrfFetch } from "@/lib/api-client";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Sparkles, Send, Copy, Check, ArrowRight, FileText, ShieldCheck, Workflow, Mail } from "lucide-react";

// ── 주제 분류기(룰베이스) — 키워드 → 주제. inquiryType(API 계약: service/pricing/sourcing/account)에 매핑.
//   ontology 무접촉: 키워드 매칭만, DB 조회 0.
type Topic = {
  id: string;
  inquiryType: "service" | "pricing" | "sourcing" | "account";
  label: string;
  keywords: string[];
  // 큐레이션 즉답(정직 2문장, 가격·SLA·고객사 단정 0 → "문의 시 안내").
  answer: string;
};

const TOPICS: Topic[] = [
  {
    id: "pricing",
    inquiryType: "pricing",
    label: "가격·플랜",
    keywords: ["가격", "요금", "비용", "플랜", "무료", "유료", "팀", "기관", "견적가", "단가"],
    answer:
      "무료로 시작해 팀·기관 플랜으로 확장하는 구조이며, 기관 플랜은 사용 범위에 맞춰 상담으로 안내드립니다. 정확한 금액은 도입 규모에 따라 달라져 문의를 남겨주시면 담당자가 확인 후 회신드립니다.",
  },
  {
    id: "integration",
    inquiryType: "account",
    label: "연동·SSO·보안",
    keywords: ["연동", "erp", "sso", "보안", "계정", "권한", "암호화", "접속기록", "통합", "api"],
    answer:
      "ERP·SSO 연동은 기관 플랜 상담 범위에서 지원하며, 보안은 최소 권한·암호화·접속기록 보관을 기본으로 합니다. 연동 대상·환경을 문의에 적어주시면 담당자가 가능 범위를 확인해 안내드립니다.",
  },
  {
    id: "sourcing",
    inquiryType: "sourcing",
    label: "소싱·공급사·견적",
    keywords: ["소싱", "공급사", "벤더", "vendor", "rfq", "견적", "발주", "구매대행"],
    answer:
      "시약·소모품 검색·비교 후 견적 요청(RFQ)과 발주·입고·재고까지 한 흐름으로 처리할 수 있습니다. 취급 품목·공급사 범위가 궁금하시면 문의를 남겨주시면 구체적으로 안내드립니다.",
  },
  {
    id: "feature",
    inquiryType: "service",
    label: "기능·도입",
    keywords: ["기능", "검색", "비교", "재고", "lot", "유효기간", "도입", "시작", "사용법", "브리핑", "추출"],
    answer:
      "검색·비교·견적·발주·입고·재고와 Lot/유효기간 관리, AI 기반 비교·추출·브리핑 보조를 제공합니다. 도입 절차가 궁금하시면 문의를 남겨주시면 담당자가 단계별로 안내드립니다.",
  },
];

const DEFAULT_ANSWER =
  "문의 주신 내용은 담당자가 직접 확인해 영업일 기준 1일 이내 등록하신 이메일로 안내드립니다. 아래에 내용을 남겨주시면 더 정확히 도와드릴 수 있어요.";

/** 룰베이스 분류 — 키워드 매칭 최다 주제. 매칭 0이면 null(기본 안내). ontology 무접촉. */
function classifyTopic(text: string): Topic | null {
  const q = text.toLowerCase();
  let best: Topic | null = null;
  let bestScore = 0;
  for (const t of TOPICS) {
    const score = t.keywords.reduce((n, k) => (q.includes(k) ? n + 1 : n), 0);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore > 0 ? best : null;
}

const EXAMPLE_CHIPS = ["기관 도입은 어떻게 시작하나요?", "ERP 연동 되나요?", "어떤 기능이 있나요?", "보안은 어떤가요?"];
const DOC_LINKS = [
  { label: "서비스 소개", href: "/intro" },
  { label: "요금 & 도입", href: "/pricing" },
  { label: "자주 묻는 질문", href: "/faq" },
  { label: "도움말", href: "/help" },
];
const SUPPORT_EMAIL = "support@labaxis.co.kr";

export default function SupportContactPage() {
  // ── 문의 도우미(P2: 라이브 AI + P1 큐레이션 폴백) ──
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ topic: Topic | null; text: string; live: boolean } | null>(null);
  const [asking, setAsking] = useState(false);

  // ── 적응형 문의 폼 ──
  const [category, setCategory] = useState<Topic["inquiryType"]>("service");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; refId?: string; error?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // P2: 라이브 AI(/api/support/ai-assist) 호출 → 실패/폴백 시 P1 룰베이스 큐레이션으로 복귀(항상 동작).
  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || asking) return;
    setQuestion("");
    setAsking(true);
    const toFallback = () => {
      const topic = classifyTopic(q);
      setAnswer({ topic, text: topic ? topic.answer : DEFAULT_ANSWER, live: false });
    };
    try {
      // §support-csrf-fix — 공개 폼도 CSRF required(레지스트리 기본값). raw fetch → 토큰 미부착
      //   → "보안 검증 미완" 403. csrfFetch 가 쿠키/부트스트랩(/api/security/csrf-token)으로 토큰
      //   자동 부착(로그아웃 방문자도 발급). CAPTCHA·Resend 무관.
      const res = await csrfFetch("/api/support/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (res.ok && data?.answer) {
        setAnswer({ topic: classifyTopic(q), text: data.answer, live: true });
      } else {
        toFallback(); // { fallback:true } 또는 비정상 → P1 큐레이션
      }
    } catch {
      toFallback();
    } finally {
      setAsking(false);
    }
  };

  // 도우미 → 폼 핸드오프: 질문 주제로 카테고리 자동 분류 + 내용 prefill 후 폼으로 이동.
  const handoffToForm = () => {
    if (answer?.topic) setCategory(answer.topic.inquiryType);
    if (answer && !message) {
      setMessage(`[${answer.topic?.label ?? "일반 문의"}] 관련해 문의드립니다.\n\n`);
    }
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const emailValid = email.includes("@") && email.includes(".");
  const canSubmit = name.trim().length > 0 && emailValid && message.trim().length >= 10 && agree && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      // §support-csrf-fix — 제출도 CSRF required. csrfFetch 로 x-labaxis-csrf-token 자동 부착.
      const res = await csrfFetch("/api/support/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryType: category, name, email, message }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ ok: true, refId: data.referenceId });
        showToast("문의가 접수되었습니다.");
      } else {
        setResult({ ok: false, error: data.error ?? "접수 중 오류가 발생했습니다." });
      }
    } catch {
      setResult({ ok: false, error: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSubmitting(false);
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      showToast("이메일이 복사되었습니다.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("복사에 실패했습니다.");
    }
  };

  const CATEGORY_OPTIONS: { value: Topic["inquiryType"]; label: string }[] = useMemo(
    () => [
      { value: "service", label: "기능·도입" },
      { value: "pricing", label: "가격·플랜" },
      { value: "sourcing", label: "소싱·공급사" },
      { value: "account", label: "연동·SSO·보안" },
    ],
    [],
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9]">
      <MainHeader />

      {/* ── 히어로 + 문의 도우미 ── */}
      <div className="cp-hero relative overflow-hidden">
        <div className="cp-hero-dots" aria-hidden />
        <div className="relative z-10 max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a9c2f5] mb-3">도입 및 문의 · Contact</div>
          <h1 className="text-2xl md:text-[34px] font-bold text-white tracking-tight leading-tight mb-2">
            궁금한 점을 묻고, 그대로 문의를 남기세요
          </h1>
          <p className="text-sm md:text-[15px] text-[#c7d4ee] max-w-2xl mx-auto leading-relaxed">
            빠른 답변으로 먼저 확인하고, 답변 맥락 그대로 문의 폼으로 이어집니다. 정확한 안내는 담당자가 직접 확인해 드립니다.
          </p>

          {/* 문의 도우미 박스(룰베이스 빠른 답변 — "AI" 라벨 아님). */}
          <div className="cp-assist mt-7 mx-auto max-w-2xl rounded-2xl bg-white p-4 md:p-5 text-left shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#ecf2fe]">
                <Sparkles className="h-4 w-4 text-[#3b6ee5]" />
              </span>
              <span className="text-[13px] font-bold text-slate-900">문의 도우미</span>
              <span className="rounded-full bg-[#ecf2fe] px-2 py-0.5 text-[10px] font-bold text-[#244e9e]">빠른 답변</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") ask(question); }}
                placeholder="예: 기관 도입은 어떻게 시작하나요?"
                aria-label="문의 도우미 질문 입력"
                className="flex-1 min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#3b6ee5]"
              />
              <button
                type="button"
                onClick={() => ask(question)}
                disabled={!question.trim() || asking}
                aria-label="질문 전송"
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-[#3b6ee5] text-white transition-colors hover:bg-[#3461cf] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* 로딩 — 점 3개 타이핑 인디케이터(지시문 04) */}
            {asking && (
              <div className="mt-3 flex items-center gap-1.5 px-1" aria-live="polite" aria-label="답변 작성 중">
                <span className="cp-dot" /><span className="cp-dot" /><span className="cp-dot" />
              </div>
            )}

            {/* 예시 칩(답변 전·로딩 아닐 때만) */}
            {!answer && !asking && (
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => ask(c)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-[12px] text-slate-600 transition-colors hover:border-[#3b6ee5] hover:text-[#3b6ee5]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* 답변 블록(최신 1건) — 라이브 AI면 "AI 답변", 폴백 큐레이션이면 "빠른 답변"(룰링: AI 라벨은 라이브만). */}
            {answer && !asking && (
              <div className="mt-3 rounded-xl bg-[#f4f6f9] p-3.5">
                <div className="mb-1.5 inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#244e9e]">
                  {answer.live ? "AI 답변" : "빠른 답변"}
                </div>
                <p className="text-[13.5px] leading-relaxed text-slate-700">{answer.text}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    {answer.topic ? `주제: ${answer.topic.label}` : "담당자 확인이 필요한 문의"}
                  </span>
                  <button
                    type="button"
                    onClick={handoffToForm}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f1b34] px-3 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[#16284c]"
                  >
                    이 내용으로 문의 남기기
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 본문: 적응형 폼(좌) + 신뢰 사이드바(우) ── */}
      <div className="cp-body flex-1">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 items-start">
            {/* 폼 */}
            <div ref={formRef} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-1">문의 남기기</h2>
              <p className="text-[13px] text-slate-500 mb-5">담당자가 직접 확인해 영업일 기준 1일 이내 회신드립니다.</p>

              {result?.ok ? (
                <div className="rounded-xl border border-[#cfe8d8] bg-[#e6f5ec] p-5 text-center">
                  <Check className="mx-auto h-8 w-8 text-[#1b9e5a]" />
                  <p className="mt-2 text-sm font-bold text-slate-900">문의가 접수되었습니다</p>
                  <p className="mt-1 text-[13px] text-slate-600">
                    접수번호 <span className="font-bold tabular-nums">{result.refId}</span> · 영업일 기준 1일 이내 이메일로 안내드립니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">문의 유형</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setCategory(o.value)}
                          className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                            category === o.value
                              ? "bg-[#3b6ee5] text-white"
                              : "border border-slate-200 text-slate-600 hover:border-[#3b6ee5]"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cp-name" className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">이름 · 기관명</label>
                      <input id="cp-name" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#3b6ee5]" />
                    </div>
                    <div>
                      <label htmlFor="cp-email" className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">이메일</label>
                      <input id="cp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#3b6ee5]" />
                      {email.length > 0 && !emailValid && <p className="mt-1 text-[11px] text-[#c0443a]">올바른 이메일을 입력해 주세요.</p>}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cp-msg" className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">문의 내용</label>
                    <textarea id="cp-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
                      placeholder="도입 환경·규모·연동 대상 등 구체적으로 적어주시면 더 정확히 안내드립니다."
                      className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-[#3b6ee5] resize-y" />
                    <p className="mt-1 text-[11px] text-slate-400">{message.trim().length < 10 ? "10자 이상 입력해 주세요." : `${message.trim().length}자`}</p>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4" />
                    <span className="text-[12px] text-slate-600 leading-relaxed">
                      문의 처리를 위한 개인정보(이름·이메일·문의내용) 수집·이용에 동의합니다. 자세한 내용은{" "}
                      <a href="/legal#privacy" className="text-[#3b6ee5] underline">개인정보처리방침</a>을 따릅니다.
                    </span>
                  </label>

                  {result?.error && <p className="text-[12.5px] text-[#c0443a]">{result.error}</p>}

                  <button type="button" onClick={submit} disabled={!canSubmit}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#3b6ee5] px-5 text-sm font-bold text-white transition-colors hover:bg-[#3461cf] disabled:opacity-40">
                    {submitting ? "접수 중…" : "문의 접수"}
                    {!submitting && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>

            {/* 신뢰 사이드바 — 실값 없는 항목(도입 기관·실적 숫자)은 비움(가짜 금지). 정직한 운영 방식만. */}
            <aside className="lg:sticky lg:top-[86px] space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-[#3b6ee5]" />
                  <h3 className="text-[13px] font-bold text-slate-900">응답 방식</h3>
                </div>
                <p className="text-[12.5px] leading-relaxed text-slate-600">
                  빠른 답변으로 먼저 확인하고, 정확한 안내는 담당자가 직접 확인해 <strong className="text-slate-900">영업일 기준 1일 이내</strong> 이메일로 회신드립니다. (전화·실시간 상담은 운영하지 않습니다.)
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Workflow className="h-4 w-4 text-[#3b6ee5]" />
                  <h3 className="text-[13px] font-bold text-slate-900">진행 방식</h3>
                </div>
                <ol className="text-[12.5px] leading-relaxed text-slate-600 space-y-1.5 list-decimal pl-4">
                  <li>문의 접수 (접수번호 발급)</li>
                  <li>담당자 내용 확인</li>
                  <li>이메일로 안내 회신</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-[#3b6ee5]" />
                  <h3 className="text-[13px] font-bold text-slate-900">이메일 직접 문의</h3>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-[#f4f6f9] px-3 py-2">
                  <span className="text-[12.5px] text-slate-700 truncate">{SUPPORT_EMAIL}</span>
                  <button type="button" onClick={copyEmail} aria-label="이메일 복사"
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md hover:bg-slate-200">
                    {copied ? <Check className="h-4 w-4 text-[#1b9e5a]" /> : <Copy className="h-4 w-4 text-slate-500" />}
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-[#3b6ee5]" />
                  <h3 className="text-[13px] font-bold text-slate-900">관련 문서</h3>
                </div>
                <div className="flex flex-col gap-1.5">
                  {DOC_LINKS.map((d) => (
                    <a key={d.href} href={d.href} className="text-[12.5px] text-slate-600 hover:text-[#3b6ee5] transition-colors">{d.label} →</a>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <MainFooter />

      {toast && (
        <div className="cp-toast" role="status" aria-live="polite">{toast}</div>
      )}

      <style jsx global>{`
        .cp-hero { background: linear-gradient(160deg, #0a1124 0%, #0f1b34 60%, #16284c 130%); }
        .cp-hero-dots { position: absolute; top: 0; right: 0; width: 360px; height: 240px; z-index: 0; pointer-events: none;
          background-image: radial-gradient(circle, rgba(91,134,240,0.30) 1.2px, transparent 1.7px); background-size: 18px 18px;
          -webkit-mask-image: radial-gradient(ellipse at top right, #000 28%, transparent 72%);
          mask-image: radial-gradient(ellipse at top right, #000 28%, transparent 72%); }
        .cp-body { background: #f4f6f9; }
        .cp-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: #0a1124; color: #fff;
          padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; z-index: 60;
          box-shadow: 0 10px 28px -10px rgba(0,0,0,.45); animation: cpToast .25s ease; }
        @keyframes cpToast { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @media (prefers-reduced-motion: reduce) { .cp-toast { animation: none; } }
        .cp-dot { width: 6px; height: 6px; border-radius: 9999px; background: #9aa6c2; display: inline-block; animation: cpDot 1s infinite ease-in-out; }
        .cp-dot:nth-child(2) { animation-delay: .15s; }
        .cp-dot:nth-child(3) { animation-delay: .3s; }
        @keyframes cpDot { 0%, 80%, 100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        @media (prefers-reduced-motion: reduce) { .cp-dot { animation: none; } }
        @media print { .cp-assist, .cp-toast { display: none; } }
      `}</style>
    </div>
  );
}
