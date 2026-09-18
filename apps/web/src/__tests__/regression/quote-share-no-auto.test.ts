/**
 * §quote-share-no-auto (2026-09-18 · 릴레이 P1 판정) · **견적 공유 링크는 사용자가 만들 때만, 기간을 정해서 만든다.**
 *
 * ── 왜 ──
 * POST /api/quotes 가 견적마다 QuoteShare 를 **자동 생성**했다 — enabled · expiresAt 없음 · 사용자 요청 없음.
 *   prod 실측(2026-09-18 · 로컬 operator-shell → Supabase xhid… · SELECT + 비로그인 GET):
 *     견적 8 · 공유 8 전부 활성·무기한 · 견적당 1개.
 *     비로그인 GET /api/share/<token> → 200 · 제목·요청 문구(요청 조건 포함)·품목명·단가 노출.
 *   그런데 응답의 shareToken·shareUrl 을 **읽는 클라이언트는 0곳**이었다(워크벤치 「공유」 카드는 별개 기능
 *   SharedList 를 쓴다 · 메일 템플릿에도 없음). 사용자는 존재를 모르고, 끄는 화면도 없었다.
 *   토큰은 85자(UUIDv4 + 192bit)라 추측은 불가 → P0 아님. 그러나 새면 회수 수단이 없다 → P1.
 *   기존 8건은 삭제가 아니라 **비활성화**(유출 조사 흔적 보존 · 2026-09-18 트랜잭션 정확히 8행 · 비로그인 404 확인).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 견적 생성 경로는 공유 링크를 만들지 않는다(QuoteShare create 0 · 토큰 생성기 import 0).
 *   ② 견적 생성 응답에 공유 링크 필드가 없다(항상 null 인 죽은 키를 남기지 않는다).
 *   ③ 수동 생성 API 는 **켜는 요청에 만료 기간을 요구**한다(무기한 활성 링크 생성 0).
 *   ④ 끄는 요청은 기존 만료일을 null 로 덮지 않는다(끄다가 무기한이 되지 않는다).
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. SharedList(`/api/shared-lists`) — 사용자가 명시적으로 만드는 별개 공유 기능. 기본 30일 · 선택지에
 *      「만료 없음」 이 있다(prod 0행). 릴레이 판정(2026-09-18): 지금 손대지 않는다 · 큐 기록.
 *   2. 다른 경로에서 QuoteShare 를 만드는 코드가 새로 생기는 경우 — ①은 견적 생성 라우트만 본다.
 *      ⑤가 src 전체의 QuoteShare 생성 지점을 집합으로 고정해 보완한다.
 *   3. 런타임(실제 행 생성) — 배포 후 새 견적 1건으로 DB 실측.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));
const CREATE = "app/api/quotes/route.ts";
const SHARE = "app/api/quotes/[id]/share/route.ts";

function walk(): string[] {
  const out: string[] = [];
  const visit = (abs: string) => {
    for (const name of readdirSync(abs)) {
      if (name === "__tests__" || name === "node_modules" || name === "generated") continue;
      const p = join(abs, name);
      if (statSync(p).isDirectory()) visit(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(SRC, p).split("\\").join("/"));
    }
  };
  visit(SRC);
  return out;
}

describe("§quote-share-no-auto · 공유 링크는 요청할 때만, 기간을 정해서", () => {
  it("① 견적 생성 경로는 공유 링크를 만들지 않는다", () => {
    const src = code(CREATE);
    expect(src).not.toMatch(/quoteShare\s*\.\s*(create|upsert|createMany)/);
    expect(src).not.toMatch(/generateShareToken/);
  });

  it("② 견적 생성 응답에 공유 링크 필드가 없다", () => {
    const src = code(CREATE);
    expect(src).toMatch(/return NextResponse\.json\(\{ quote \}, \{ status: 201 \}\)/);
    expect(src).not.toMatch(/\bshare(Token|Url)\b/);
  });

  it("③ 수동 생성 API 는 켜는 요청에 만료 기간을 요구한다", () => {
    const src = code(SHARE);
    // 스키마 단계에서 enabled 이면 expiresInDays 필수
    expect(src).toMatch(/\.refine\(\(d\) => !d\.enabled \|\| d\.expiresInDays !== undefined/);
  });

  it("④ 끄는 요청은 기존 만료일을 null 로 덮지 않는다", () => {
    const src = code(SHARE);
    expect(src).toMatch(/expiresAt: expiresAt \?\? existingShare\.expiresAt/);
  });

  it("⑤ src 전체에서 QuoteShare 를 만드는 파일은 수동 생성 API 하나뿐 (집합 고정)", () => {
    const creators = walk().filter((rel) => /quoteShare\s*\.\s*(create|upsert|createMany)\s*\(/.test(code(rel))).sort();
    expect(creators).toEqual([SHARE]);
  });
});
