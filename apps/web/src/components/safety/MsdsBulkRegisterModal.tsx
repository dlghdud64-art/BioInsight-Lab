"use client";

/**
 * §msds-bulk-registration B-P4 (호영님 2026-07-04) — MSDS 일괄 등록 워크벤치.
 *
 * 실 등록(문서 첨부·보관). 3단계: 파일 선택 → 분석/매칭 확인 → 일괄 등록.
 *   preview(/api/safety/sds/bulk) 로 추출·자동매칭 → 사용자가 매칭 확인/수정 →
 *   commit(/api/safety/sds/bulk/commit) 으로 실 등록. no-op·fake success 0(실 저장만 등록).
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileWarning } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PoolOption { id: string; name: string; catalogNumber: string | null }
interface MatchCandidate { id: string; name: string; catalogNumber: string | null; basis: string; confidence: number }
interface PreviewItem {
  index: number; fileName: string; sizeBytes: number;
  extracted: { productName: string | null; casNumber: string | null };
  extractionReason: string | null;
  match: { productId: string | null; confidence: number; basis: string; ambiguous: boolean; candidates: MatchCandidate[] };
}
interface CommitResult { fileName: string; productId?: string; status: string; hazardBackfilled?: boolean }

type Phase = "select" | "analyzing" | "review" | "committing" | "done";

const REASON_LABEL: Record<string, string> = {
  no_api_key: "자동추출 비활성(수동 지정)", not_pdf: "PDF 아님(수동 지정)",
  no_text: "본문 없음(수동 지정)", extract_failed: "추출 실패(수동 지정)",
};

export function MsdsBulkRegisterModal({
  open, onOpenChange, onRegistered,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRegistered?: () => void;
}) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("select");
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [pool, setPool] = useState<PoolOption[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [results, setResults] = useState<CommitResult[]>([]);
  const [registeredCount, setRegisteredCount] = useState(0);

  const reset = () => {
    setFiles([]); setPhase("select"); setItems([]); setPool([]); setMapping({}); setResults([]); setRegisteredCount(0);
  };
  const close = () => { reset(); onOpenChange(false); };

  const analyze = async () => {
    if (files.length === 0) return;
    setPhase("analyzing");
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/safety/sds/bulk", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      const its: PreviewItem[] = data.items ?? [];
      setItems(its);
      setPool(data.pool ?? []);
      const init: Record<number, string> = {};
      its.forEach((it) => { if (it.match.productId) init[it.index] = it.match.productId; });
      setMapping(init);
      setPhase("review");
    } catch (e) {
      toast({ title: "분석 실패", description: e instanceof Error ? e.message : "다시 시도하세요.", variant: "destructive" });
      setPhase("select");
    }
  };

  const confirmedCount = items.filter((it) => mapping[it.index]).length;

  const commit = async () => {
    if (confirmedCount === 0) { toast({ title: "등록 대상 없음", description: "매칭할 품목을 1개 이상 지정하세요." }); return; }
    setPhase("committing");
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const map = files.map((_, i) => ({ productId: mapping[i] || null }));
      fd.append("mapping", JSON.stringify(map));
      const res = await fetch("/api/safety/sds/bulk/commit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      setResults(data.results ?? []);
      setRegisteredCount(data.registeredCount ?? 0);
      setPhase("done");
      if ((data.registeredCount ?? 0) > 0) {
        toast({ title: "MSDS 등록 완료", description: `${data.registeredCount}건이 등록되었습니다. 안전 지수를 갱신합니다.` });
        onRegistered?.();
      } else {
        toast({ title: "등록된 건 없음", description: "매칭·저장에 성공한 문서가 없습니다.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "등록 실패", description: e instanceof Error ? e.message : "다시 시도하세요.", variant: "destructive" });
      setPhase("review");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="sm:max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Upload className="h-4 w-4 text-blue-600" /></div>
            MSDS 일괄 등록
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            MSDS 문서(PDF)를 업로드하면 CAS·제품명으로 재고 품목에 매칭합니다. 확인 후 실제 등록됩니다.
          </DialogDescription>
        </DialogHeader>

        {phase === "select" && (
          <div className="space-y-3 py-2">
            <input
              type="file" accept=".pdf" multiple
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="text-xs text-slate-500">{files.length}개 파일 선택됨 (최대 20)</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={close}>취소</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" disabled={files.length === 0} onClick={analyze}>
                <FileWarning className="h-3.5 w-3.5" />분석 · 매칭
              </Button>
            </div>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="py-8 flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">{files.length}개 문서 추출·매칭 중...</p>
          </div>
        )}

        {phase === "review" && (
          <div className="space-y-2 py-1 max-h-[55vh] overflow-y-auto">
            <p className="text-[11px] text-slate-500">매칭을 확인·수정하세요. 미지정 건은 등록에서 제외됩니다.</p>
            {items.map((it) => (
              <div key={it.index} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 truncate">{it.fileName}</p>
                  {it.match.productId && !it.match.ambiguous
                    ? <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">자동매칭 {it.match.basis}</span>
                    : <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">확인 필요{it.extractionReason ? ` · ${REASON_LABEL[it.extractionReason] ?? ""}` : ""}</span>}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  추출: {[it.extracted.productName, it.extracted.casNumber].filter(Boolean).join(" · ") || "—"}
                </p>
                <select
                  className="mt-1.5 w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
                  value={mapping[it.index] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [it.index]: e.target.value }))}
                >
                  <option value="">— 등록 안 함(건너뛰기) —</option>
                  {pool.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.catalogNumber ? ` (${p.catalogNumber})` : ""}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 pt-2 sticky bottom-0 bg-white">
              <span className="text-[11px] text-slate-500">{confirmedCount}/{items.length}종 등록 예정</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={close}>취소</Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" disabled={confirmedCount === 0} onClick={commit}>
                  <CheckCircle2 className="h-3.5 w-3.5" />{confirmedCount}종 등록
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase === "committing" && (
          <div className="py-8 flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">등록 중...</p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-2 py-1 max-h-[55vh] overflow-y-auto">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-800">{registeredCount}건 등록 완료</p>
            </div>
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs px-2 py-1">
                <span className="truncate text-slate-600">{r.fileName}</span>
                {r.status === "registered"
                  ? <span className="shrink-0 text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />등록됨</span>
                  : r.status === "skipped"
                    ? <span className="shrink-0 text-slate-400">건너뜀</span>
                    : <span className="shrink-0 text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{r.status === "forbidden" ? "권한 없음" : r.status === "storage_not_configured" ? "스토리지 미설정" : "실패"}</span>}
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={close}>닫기</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
