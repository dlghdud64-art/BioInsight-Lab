import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments, violations } from "@/__tests__/_helpers/em-dash-scan";

/**
 * §receiving-list-redesign P2·P3 sentinel (핸드오프 2026-08-30 · 시각 truth 1a)
 *
 * 잠그는 계약:
 *   1) 데스크탑 리스트 = canonical ReceivingDraft (데모 이슈 행 소스 0)
 *   2) 우측 슬라이드 패널(quickview-drawer)·데모 반영 모달 폐기 — 부활 차단
 *   3) CTA = caseCtaLabel 단일 계약 + 일괄 처리 모달 직행 (front-only 반영 0)
 *   4) COA 인라인 드롭존 = 문서 API 실배선 · 재클릭 접힘
 *   5) §11.302 — amber/orange 금지(yellow 신호등) · em dash 구분자 0 (파일 단위)
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PAGE = "src/app/dashboard/receiving/page.tsx";
const LIST = "src/components/receiving/receiving-case-list.tsx";
const VM = "src/lib/ops-console/receiving-desktop-view-model.ts";

describe("§receiving-list-redesign — canonical 전환 (P4 truth)", () => {
  it("데스크탑 리스트가 receiving-drafts 3-status 를 canonical 로 읽는다", () => {
    const src = read(PAGE);
    expect(src).toMatch(
      /\/api\/receiving-drafts\?status=AWAITING_REPLY,PENDING_REVIEW,APPROVED/,
    );
    expect(src).toMatch(/buildReceivingCaseList/);
  });

  it("데모 이슈 행 소스(buildModuleLandingItems) 사용 0", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/buildModuleLandingItems/);
  });

  it("데스크탑 반영은 일괄 처리 모달(/approve 경로) 직행 — 데모 postToInventory 를 쓰지 않는다", () => {
    const src = read(PAGE);
    // 모바일(무접촉) 경로만 잔존 — card 단위 시그니처.
    expect(src).toMatch(/postToInventory\(card\.id\)/);
    // 구 데스크탑 데모 경로(ModuleLandingItem 단위) 부활 차단.
    expect(src).not.toMatch(/postToInventory\(item\./);
    // 일괄 처리 모달 배선 + 커밋 후 refetch.
    expect(src).toMatch(/<ReceivingBatchModal[\s\S]{0,400}?onCommitted=\{\(\) => void load\(\)\}/);
  });
});

describe("§receiving-list-redesign — 우측 패널 폐기 (P3)", () => {
  it("quickview-drawer · 구 데스크탑 리스트 · 데모 반영 모달 import 0", () => {
    // 주석 제외(폐기 사유 서술은 허용) — 코드 축만 검사.
    const src = stripComments(read(PAGE));
    expect(src).not.toMatch(/receiving-quickview-drawer/);
    expect(src).not.toMatch(/ReceivingQuickviewDrawer/);
    expect(src).not.toMatch(/ReceivingDesktopList/);
    expect(src).not.toMatch(/receiving-post-modal/);
    expect(src).not.toMatch(/ReceivingPostModal/);
  });

  it("행 클릭 = 인라인 펼침 (aria-expanded 접근성 계약)", () => {
    const src = read(LIST);
    expect(src).toMatch(/<div[\s\S]{0,200}?role="button"[\s\S]{0,200}?aria-expanded=\{expanded\}/);
  });
});

describe("§receiving-list-redesign — CTA 단일 계약 (P2)", () => {
  it("리스트 컴포넌트는 caseCtaLabel 만 쓰고 CTA 문구를 하드코딩하지 않는다", () => {
    const src = read(LIST);
    expect(src).toMatch(/caseCtaLabel/);
    expect(src).not.toMatch(/하고 반영/); // 문구는 뷰모델 단일 소스
    expect(src).not.toMatch(/"재고 반영"/);
    // JSX 텍스트 하드코딩도 차단(④ 프로브 실측: 따옴표 없는 리터럴이 빠져나감) +
    // CTA 렌더 2표면(접힌 행·펼침 푸터)이 전부 {cta} 를 쓴다.
    expect(src).not.toMatch(/^\s*재고 반영\s*$/m);
    expect((src.match(/\{cta\}/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("CTA 문구 파생은 뷰모델 caseCtaLabel 에만 존재 (필수 조치 기준)", () => {
    const src = read(VM);
    expect(src).toMatch(/export function caseCtaLabel/);
    expect(src).toMatch(/\$\{shorts\[0\]\}하고 반영/);
    expect(src).toMatch(/남은 \$\{row\.actions\.length\}건 처리하고 반영/);
  });
});

describe("§receiving-list-redesign — COA 인라인 드롭존 (P3)", () => {
  it("드롭존 = 문서 API 실배선 (csrfFetch FormData, front-only 0)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/csrfFetch\(`\/api\/receiving\/documents\/\$\{row\.orderId\}`/);
    expect(src).toMatch(/new FormData\(\)/);
    // 실패 경로 존재 — placeholder success 금지.
    expect(src).toMatch(/if \(!res\.ok\)[\s\S]{0,200}?labToast\.error/);
    // 성공 토스트는 ok 가드 뒤 — 창은 handleAttachDocument 부터 연다(② 창 시작점:
    // load() 의 !res.ok 가 먼저 매칭되는 접두 창 결함 방지, 프로브 실측 2026-08-30).
    const fnIdx = src.indexOf("handleAttachDocument = async");
    expect(fnIdx).toBeGreaterThan(-1);
    const okIdx = src.indexOf("if (!res.ok)", fnIdx);
    const successIdx = src.indexOf('labToast.success("COA 첨부 완료"');
    expect(okIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeGreaterThan(okIdx);
  });

  it("드롭존 드래그앤드롭 + 파일 입력 + 재클릭 접힘 wiring", () => {
    const src = read(LIST);
    expect(src).toMatch(/onDrop=\{\(e\) => \{ e\.preventDefault\(\); void handleFile/);
    expect(src).toMatch(/<input ref=\{fileRef\} type="file" hidden/);
    expect(src).toMatch(/setDropOpen\(\(v\) => !v\)/);
    // §scan-recognition-upgrade P1 승계: 업로드 후 인식 시도 → 결과 없으면 즉시 접힘(기존 흐름).
    expect(src).toMatch(
      /await onAttachDocument\(row, "coa", file\);[\s\S]{0,300}?await onRecognizeCoa\(row, file\)/,
    );
    expect(src).toMatch(/setDropOpen\(false\)/);
  });
});

describe("§receiving-list-redesign — §11.302 색·타이포 (전 표면)", () => {
  it("amber/orange Tailwind 금지 — 주의 = yellow 신호등", () => {
    for (const rel of [PAGE, LIST]) {
      const src = read(rel);
      expect(src, rel).not.toMatch(/amber-\d/);
      expect(src, rel).not.toMatch(/orange-\d/);
    }
    expect(read(LIST)).toMatch(/bg-yellow-50 text-yellow-700 border border-yellow-200/);
  });

  it("보류 칩 = red 톤 (§11.302 위험·보류)", () => {
    const src = read(LIST);
    expect(src).toMatch(/row\.holdChips\.map[\s\S]{0,300}?bg-red-50 text-red-700 border border-red-200/);
  });

  it("em dash 구분자 0 — 판별기 파일 단위 (placeholder·주석 제외)", () => {
    for (const rel of [PAGE, LIST, VM]) {
      const hits = violations(read(rel));
      expect(hits, `${rel}: ${JSON.stringify(hits)}`).toHaveLength(0);
    }
  });
});
