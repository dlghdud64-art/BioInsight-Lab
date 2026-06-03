"use client";

// §11.348-B-1 B1-2 — 제품 SDS/COA 문서 섹션(목록 + 업로드 + 열람).
// products/[id] 안전·규제 정보에 same-canvas 마운트. 업로드=SDSDocument(보관),
// 열람=서명URL(B1-1). canonical 안전필드 승격은 사람 승인(apply) — 여기선 보관/열람만.

import { useEffect, useState, useCallback, useRef } from "react";
import { csrfFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, ExternalLink, Loader2 } from "lucide-react";

interface SdsDoc {
  id: string;
  fileName: string;
  source: string;
  createdAt: string;
}

export function SdsDocumentsSection({ productId }: { productId: string }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<SdsDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/sds`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocs(data.sdsDocuments ?? []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await csrfFetch(`/api/products/${productId}/sds`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.code === "STORAGE_NOT_CONFIGURED"
            ? "파일 스토리지가 아직 설정되지 않았습니다. 관리자에게 문의하세요."
            : data.error || "업로드 실패",
        );
      }
      toast({ title: "SDS 업로드 완료", description: file.name });
      await load();
    } catch (err: any) {
      toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleOpen = async (docId: string) => {
    setOpening(docId);
    try {
      const res = await csrfFetch(`/api/sds/${docId}/signed-url`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.signedUrl) throw new Error(data.error || "열람 링크를 만들 수 없습니다.");
      const w = window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      if (!w || w.closed) toast({ title: "팝업 차단됨", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "열람 실패", description: err.message, variant: "destructive" });
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-2" data-testid="sds-documents-section">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">등록된 SDS 문서{docs.length > 0 ? ` · ${docs.length}건` : ""}</div>
        <Button
          variant="outline" size="sm" disabled={uploading}
          className="h-8 text-xs gap-1.5"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          SDS 업로드
        </Button>
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleUpload} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 p-2"><Loader2 className="h-3 w-3 animate-spin" /> 불러오는 중…</div>
      ) : docs.length === 0 ? (
        <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded border border-slate-200">
          등록된 SDS 파일이 없습니다. 업로드하면 품목별로 보관·열람됩니다.
        </div>
      ) : (
        <div className="space-y-1.5">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-800 truncate">{d.fileName}</span>
                <span className="text-[10px] text-slate-400 flex-shrink-0">{String(d.createdAt).split("T")[0]}</span>
              </div>
              <Button variant="ghost" size="sm" disabled={opening === d.id}
                className="h-7 text-xs text-blue-600 gap-1 flex-shrink-0" onClick={() => handleOpen(d.id)}>
                {opening === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                열람
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
