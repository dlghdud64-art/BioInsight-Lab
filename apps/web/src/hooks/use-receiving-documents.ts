/**
 * §receiving-doc-attach-canonical (T1) — 입고 증빙 문서 훅 + 발주 id 해석.
 *
 * 배경: 입고 화면은 데모 배치(poId='po-003' 등 합성 id)를 들고 있고,
 *   문서 API 는 실제 Order.id 를 요구한다. §11.211 Path V 선례(entityId → Order.id
 *   useQuery resolve, 404 → null → 기능 disabled + 명시 사유) 를 그대로 재사용한다.
 *   해석 실패 시 업로드를 막고 사유를 노출한다 — 가짜 성공/dead button 0.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";

export interface ReceivingDocumentItem {
  id: string;
  docType: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  restockId: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
}

/** 데모/외부 id → 실제 Order.id 해석. 미존재(404) = null(연결 안 됨). */
export function useResolvedOrderId(candidateId: string | null | undefined) {
  const { data, isLoading } = useQuery<{ id: string } | null>({
    queryKey: ["receiving-order-resolve", candidateId],
    enabled: Boolean(candidateId),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const res = await csrfFetch(`/api/orders/${candidateId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Order resolve 실패");
      const json = (await res.json()) as { order?: { id: string } | null };
      return json.order ?? null;
    },
  });
  return { orderId: data?.id ?? null, isResolving: isLoading };
}

export function useReceivingDocuments(orderId: string | null) {
  const qc = useQueryClient();
  const key = ["receiving-documents", orderId];

  const { data, isLoading, isError } = useQuery<{ documents: ReceivingDocumentItem[] }>({
    queryKey: key,
    enabled: Boolean(orderId),
    queryFn: async () => {
      const res = await csrfFetch(`/api/receiving/documents/${orderId}`);
      if (!res.ok) throw new Error("문서 조회 실패");
      return res.json();
    },
  });

  const remove = useMutation({
    mutationFn: async (docId: string) => {
      const res = await csrfFetch(`/api/receiving/documents/${orderId}?docId=${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    documents: data?.documents ?? [],
    isLoading,
    isError,
    removeDocument: remove.mutateAsync,
    invalidate: () => qc.invalidateQueries({ queryKey: key }),
  };
}

/** 서버 확인(2xx) 후에만 성공 — 진행률은 XHR upload 이벤트로 산출. 취소 지원. */
export function uploadReceivingDocumentWithProgress(args: {
  orderId: string;
  file: File;
  docType: "invoice" | "photo" | "etc";
  restockId?: string | null;
  onProgress?: (percent: number) => void;
}): { promise: Promise<ReceivingDocumentItem>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<ReceivingDocumentItem>((resolve, reject) => {
    const form = new FormData();
    form.append("file", args.file);
    form.append("docType", args.docType);
    if (args.restockId) form.append("restockId", args.restockId);

    xhr.open("POST", `/api/receiving/documents/${args.orderId}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && args.onProgress) {
        args.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      // 서버 2xx 확인 후에만 성공 처리(front-only success 금지).
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as { document: ReceivingDocumentItem };
          resolve(json.document);
        } catch {
          reject(new Error("응답 해석 실패"));
        }
        return;
      }
      let message = "업로드 실패";
      try {
        const err = JSON.parse(xhr.responseText) as { error?: string };
        if (err?.error) message = err.error;
      } catch {
        // 본문이 JSON 아닐 수 있음 — 기본 메시지 유지.
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("네트워크 오류로 업로드에 실패했습니다."));
    xhr.onabort = () => reject(new Error("업로드를 취소했습니다."));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

/** §1 MSDS = 품목 단위 문서. 품목에 등록돼 있으면 자동 연동(매 입고 재첨부 불필요). */
export interface ProductMsdsDoc {
  id: string;
  fileName: string;
  createdAt: string;
  issuedAt: string | null;
  supersededAt: string | null;
}

export function useProductMsds(productId: string | null | undefined) {
  const { data, isLoading, isError } = useQuery<{ sdsDocuments: ProductMsdsDoc[] }>({
    queryKey: ["product-msds", productId],
    enabled: Boolean(productId),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await csrfFetch(`/api/products/${productId}/sds?docType=sds`);
      if (!res.ok) throw new Error("품목 MSDS 조회 실패");
      return res.json();
    },
  });
  // 현행 유효본만(교체 이력 supersededAt 제외) — 허위 "등록됨" 표시 방지.
  const current = (data?.sdsDocuments ?? []).filter((d) => !d.supersededAt);
  return {
    msdsDocs: current,
    hasProductMsds: current.length > 0,
    isLoading,
    isError,
  };
}
