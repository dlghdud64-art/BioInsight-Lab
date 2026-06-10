// §catalog-A Phase 2 — Core Ingest 실행 레이어 (호영님 P1, 2026-06-10)
// data.go.kr 품목목록 페이징 fetch → transform(Phase 1) → idempotent upsert 소비.
// canonical(db.product) write 0 — upsert 대상은 procurementCatalogRef만(주입식).
// 일일 트래픽 1000/operation → maxRequests 예산 + 잔여 코드 cursor 반환(조용한 overrun 금지).

import {
  transformProcurementItem,
  buildRefUpsertArgs,
  type ProcurementApiItem,
  type RefUpsertArgs,
} from "@/lib/catalog/procurement-ref";

// SCOPING_catalog-public-ingest-phase0 §3-pre 확정 base/operation.
// ⚠️ 분류 필터 파라미터 실명(dtilPrdctClsfcNo vs prdctClsfcNo)은 미리보기 확정 전 —
//   PARAM_CLSFC 상수 1곳만 교체하면 되도록 격리. (추정 통과 금지 — Phase 4 smoke에서 확정)
const API_BASE = "https://apis.data.go.kr/1230000/ao/ThngListInfoService";
const OPERATION = "getThngPrdnmLocplcAccotListInfoInfoPrdlstSearch";
const PARAM_CLSFC = "dtilPrdctClsfcNo";

export interface ItemSearchParams {
  serviceKey: string;
  /** 8자리 물품분류번호 (Seg 12·41 화이트리스트 단위 순회) */
  clsfcNo: string;
  pageNo: number;
  numOfRows: number;
}

export function buildItemSearchUrl(p: ItemSearchParams): string {
  const q = new URLSearchParams({
    serviceKey: p.serviceKey,
    pageNo: String(p.pageNo),
    numOfRows: String(p.numOfRows),
    type: "json",
    [PARAM_CLSFC]: p.clsfcNo,
  });
  return `${API_BASE}/${OPERATION}?${q.toString()}`;
}

interface ProcurementResponseShape {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: unknown; totalCount?: number; pageNo?: number; numOfRows?: number };
  };
}

export interface ParsedPage {
  items: ProcurementApiItem[];
  totalCount: number;
}

/** resultCode 00 강제 — 비정상 응답을 빈 페이지로 silent skip 하지 않는다. */
export function parseProcurementResponse(json: unknown): ParsedPage {
  const r = (json as ProcurementResponseShape)?.response;
  const code = r?.header?.resultCode;
  if (code !== "00") {
    throw new Error(
      `[procurement-ingest] API 비정상 응답 resultCode=${code ?? "없음"} (${r?.header?.resultMsg ?? "no message"})`,
    );
  }
  const rawItems = r?.body?.items;
  const items = Array.isArray(rawItems) ? (rawItems as ProcurementApiItem[]) : [];
  return { items, totalCount: r?.body?.totalCount ?? 0 };
}

/** 의존성 주입 — 실 fetch/db 는 cron route(Phase 4)에서 바인딩. unit은 fixture. */
export interface IngestDeps {
  serviceKey: string;
  fetchJson: (url: string) => Promise<unknown>;
  /** db.procurementCatalogRef.upsert 바인딩 — Phase 1 RefUpsertArgs 그대로 전달 */
  upsertRef: (args: RefUpsertArgs) => Promise<void>;
}

export interface IngestRunInput {
  /** 순회할 8자리 분류 코드 (Phase 0 backbone 1,108의 부분집합) */
  codes: string[];
  /** 이번 run 요청 예산 (일일 1000/operation 내에서 호출자가 배분) */
  maxRequests: number;
  numOfRows: number;
}

export interface IngestRunResult {
  processedCodes: string[];
  /** 예산 소진으로 못 돈 코드 — 다음 run cursor (조용한 overrun 금지) */
  remainingCodes: string[];
  fetched: number;
  upserted: number;
  /** 물품식별번호 부재로 제외된 항목 수 (silent drop 금지 — 카운트 보고) */
  skipped: number;
  requestsUsed: number;
}

/**
 * 분류 코드 단위 페이징 완주 ingest.
 * - 코드별 totalCount 도달까지 페이지 순회(무한루프 가드: 빈 페이지 즉시 종료).
 * - 예산(maxRequests) 도달 시 현재 코드 이후 전부 remainingCodes로 반환.
 * - 코드 중간 중단 방지: 다음 코드 진입 전 예산 확인(부분 코드 적재로 인한 어중간 상태 방지).
 */
export async function runIngest(input: IngestRunInput, deps: IngestDeps): Promise<IngestRunResult> {
  if (!deps.serviceKey) {
    throw new Error("[procurement-ingest] serviceKey 누락 — PROCUREMENT_API_KEY env 확인");
  }
  const result: IngestRunResult = {
    processedCodes: [],
    remainingCodes: [],
    fetched: 0,
    upserted: 0,
    skipped: 0,
    requestsUsed: 0,
  };

  for (let i = 0; i < input.codes.length; i++) {
    const code = input.codes[i];
    // 코드 1개 최소 1요청 — 예산 없으면 이 코드부터 전부 cursor로.
    if (result.requestsUsed >= input.maxRequests) {
      result.remainingCodes = input.codes.slice(i);
      break;
    }

    let pageNo = 1;
    let total = Infinity;
    let fetchedForCode = 0;
    let aborted = false;

    while (fetchedForCode < total) {
      if (result.requestsUsed >= input.maxRequests) {
        // 코드 중간 예산 소진 — 이 코드는 미완 처리(다음 run에서 재시작, upsert는 idempotent라 안전).
        result.remainingCodes = input.codes.slice(i);
        aborted = true;
        break;
      }
      const url = buildItemSearchUrl({
        serviceKey: deps.serviceKey,
        clsfcNo: code,
        pageNo,
        numOfRows: input.numOfRows,
      });
      result.requestsUsed += 1;
      const page = parseProcurementResponse(await deps.fetchJson(url));
      total = page.totalCount;
      if (page.items.length === 0) break; // 무한루프 가드

      for (const item of page.items) {
        result.fetched += 1;
        fetchedForCode += 1;
        const row = transformProcurementItem(item);
        if (!row) {
          result.skipped += 1;
          continue;
        }
        await deps.upsertRef(buildRefUpsertArgs(row));
        result.upserted += 1;
      }
      pageNo += 1;
    }

    if (aborted) break;
    result.processedCodes.push(code);
  }

  return result;
}
