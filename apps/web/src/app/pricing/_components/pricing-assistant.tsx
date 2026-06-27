"use client";
/**
 * §pricing-assistant — 요금 페이지 "AI에게 바로 물어보기" 카드.
 *   FAQ 제목 아래·아코디언 위. /api/pricing-assistant(서버 Anthropic) 호출.
 *   실패/미주입 시 서버가 항상 200+폴백을 주므로 프런트는 폴백 텍스트만 렌더.
 */
import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";

const D = { bg: "#0F172A", surface: "#1E293B", text1: "#F1F5F9", text2: "#94A3B8", border: "rgba(59,130,246,0.25)" } as const;
const BLUE = "#3B82F6";

// chip → fbKey (서버 FB 와 동일 매핑)
const CHIPS: [string, string][] = [
  ["우리 조직에 맞는 플랜은?", "0"],
  ["Basic이랑 Pro 차이가 뭔가요?", "def"],
  ["연간 결제하면 얼마나 절약되나요?", "def"],
  ["ERP랑 연동되나요?", "def"],
];

export function PricingAssistant() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<{ q: string; a: string | null } | null>(null);

  async function ask(text?: string, fbKey = "def") {
    const Q = (text ?? q).trim();
    if (!Q || busy) return;
    setBusy(true); setAns({ q: Q, a: null }); setQ("");
    try {
      const res = await fetch("/api/pricing-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: Q, fbKey }),
      });
      const data = (await res.json()) as { answer?: string };
      setAns({ q: Q, a: data.answer || "도입 문의를 남겨주시면 담당자가 정확히 안내드립니다." });
    } catch {
      setAns({ q: Q, a: "도입 문의를 남겨주시면 담당자가 정확히 안내드립니다." });
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl mx-auto mb-10 rounded-2xl p-6 md:p-7"
      style={{ background: "linear-gradient(180deg,#0f1b34,#0a1124)", border: `1px solid ${D.border}`, boxShadow: "0 18px 44px -16px rgba(10,17,36,.5)" }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="grid place-items-center h-9 w-9 rounded-[9px] flex-none text-white"
          style={{ background: `linear-gradient(135deg,${BLUE},#6f97ee)`, boxShadow: `0 6px 16px -6px ${BLUE}` }}>
          <Sparkles className="h-[19px] w-[19px]" />
        </span>
        <div>
          <b className="block text-[15px] font-extrabold" style={{ color: D.text1 }}>AI에게 바로 물어보기</b>
          <span className="text-[12.5px]" style={{ color: "rgba(255,255,255,.55)" }}>가격·기능·연동 질문에 즉시 답해드려요</span>
        </div>
      </div>
      <form className="flex gap-2.5 max-[560px]:flex-col" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 10명 팀이면 어떤 플랜이 좋나요?"
          className="flex-1 rounded-[10px] px-3.5 py-3 text-sm outline-none"
          style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", color: "#fff" }} />
        <button type="submit" disabled={busy || !q.trim()}
          className="flex-none rounded-[10px] px-[18px] py-3 font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg,${BLUE},#4f7cea)` }}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> 답변 중…</> : <>물어보기 <Send className="h-[15px] w-[15px]" /></>}
        </button>
      </form>
      <div className="flex flex-wrap gap-2 mt-3.5">
        {CHIPS.map(([c, fb]) => (
          <button key={c} type="button" onClick={() => ask(c, fb)}
            className="rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.8)" }}>
            {c}
          </button>
        ))}
      </div>
      {ans && (
        <div className="mt-4 rounded-2xl px-5 py-[18px]" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
          <div className="text-xs font-bold tracking-wide pb-2.5 mb-3 pl-[17px] relative"
            style={{ color: "#93b4fb", borderBottom: "1px solid rgba(255,255,255,.09)" }}>
            <span className="absolute left-0 -top-px font-extrabold opacity-85">Q</span>{ans.q}
          </div>
          <div className="text-[15px] leading-[1.78]" style={{ color: ans.a === null ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.94)", fontStyle: ans.a === null ? "italic" : "normal" }}>
            {ans.a === null ? "답변을 생각하고 있어요…" : ans.a}
          </div>
        </div>
      )}
      <div className="mt-3 text-[11.5px] flex items-center gap-2" style={{ color: "rgba(255,255,255,.4)" }}>
        <Sparkles className="h-3 w-3" /> AI 답변은 참고용입니다. 정확한 조건은
        <a href="#notify" className="font-bold" style={{ color: "#93b4fb" }}>도입 신청</a>으로 확인하세요.
      </div>
    </div>
  );
}
