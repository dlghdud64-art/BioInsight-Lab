/**
 * §scan-registration-reason (호영님 2026-09-04) — 500 응답에 붙일 **사유 요약**.
 *
 * 왜 필요한가:
 *   smart-receiving 의 catch-all 이 `console.error` + 고정 문구만 반환해서,
 *   존재하지 않는 enum 값(`"OTHER" as ProductCategory`)이 prod 에서 **완전히 침묵**했다.
 *   신규 품목 스캔 입고가 100% 실패하는데 UI 는 `스마트 입고 처리에 실패했습니다` 한 줄만
 *   띄웠고, 브라우저에서는 더 팔 수 없었다(2026-09-04 실측 · Product 314건 중 OTHER 0건).
 *   스캔 차단의 `skipReason` 과 같은 계약 — 실패에는 사유가 따라붙는다.
 *
 * 노출 범위:
 *   Prisma 에러 코드 + 위반 대상(meta) 까지. 값 자체는 싣지 않는다(입력 데이터 반사 금지).
 *   자사 운영 앱의 인증된 사용자에게만 도달하며, 길이는 상한으로 자른다.
 */

import { Prisma } from "@prisma/client";

const MAX_LEN = 300;

function clamp(s: string): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > MAX_LEN ? `${one.slice(0, MAX_LEN)}…` : one;
}

/**
 * 어떤 throw 든 한 줄 사유로 요약한다. 실패해도 절대 throw 하지 않는다.
 *
 * @returns 사람이 읽고 원인 지점을 특정할 수 있는 한 줄. 알 수 없으면 "unknown".
 */
export function describeFailure(error: unknown): string {
  try {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const target = error.meta?.target;
      const where = Array.isArray(target) ? target.join(",") : (target ?? "");
      return clamp(
        `prisma ${error.code}${where ? ` (${where})` : ""}: ${error.message}`,
      );
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      // 검증 에러는 여러 줄로 오고 마지막 유의미 줄에 원인(예: Expected ProductCategory)이 있다.
      const lines = error.message
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return clamp(`prisma validation: ${lines[lines.length - 1] ?? error.message}`);
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return clamp(`prisma init${error.errorCode ? ` ${error.errorCode}` : ""}: ${error.message}`);
    }
    if (error instanceof Error) {
      return clamp(`${error.name}: ${error.message}`);
    }
    return clamp(String(error));
  } catch {
    return "unknown";
  }
}
