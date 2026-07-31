/**
 * §rfq-doc-redesign #quote-request-pdf — 견적 요청서 다운로드 문서 리디자인 sentinel.
 *
 * Truth: `견적 요청서 리디자인 (단독).html` (A4) + 핸드오프 지시문.
 *   현행 pdfkit generator(무양식 텍스트 나열) → 공식 문서(레터헤드·테이블·다크헤더) 전환.
 *
 * 결정(PLAN_rfq-document-redesign.md §0):
 *   - RFQ 표시번호(문서번호) = Quote.quoteNumber 결정적 변환 `RFQ-{YYMM}-{XXXX}` (사람용 표기).
 *   - 회신 주소 = canonical 인바운드 인프라 재사용(ensureRfqToken+buildRfqReplyAddress: rfq+<token>@inbound.<domain>),
 *     INBOUND_RFQ_ENABLED off/opt-out 시 요청자 이메일 직접수신 폴백. generator 는 주소 합성 안 함(UNMATCHED 방지).
 *   - 회신 기한 = 발송 모달 응답 요청 기한 N일(기본 14) → 발행일+N. `YYYY. MM. DD. (N일)`.
 *   - 담당 실명=User.name, 기관명=Organization.name, 전화=User.phone. 실명 미입력 시 다운로드 차단.
 *   - 인바운드 매칭·금액 자동기입 = OUT OF SCOPE(§2/2단계).
 *
 * Phase GREEN 전환: P1=입력 타입, P2=generator body, P3=route/모달 wiring.
 *
 * canonical truth lock (회귀 0):
 *   - Quote(DB)=SoT, PDF=derived snapshot. Quote data 변경 0.
 *   - Pretendard 폰트 resolve 3-후보 + throw(§11.326) 보존.
 *   - ownership 3-source(owner/org member/guestKey) 보존.
 *   - status PENDING/PARSED→SENT 전환(POST only, §11.314-c) 보존.
 *   - audit DATA_EXPORTED(§11.345-B) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const GEN = "src/lib/quotes/quote-request-pdf-generator.ts";
const ROUTE = "src/app/api/quotes/[id]/generate-pdf/route.ts";
const MODAL = "src/components/quotes/dispatch/vendor-dispatch-workbench.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}
function exists(rel: string): boolean {
  return existsSync(join(REPO_ROOT_WEB, rel));
}

// ── P1: 입력 계약 (타입 확장) ──
describe("§rfq-doc-redesign P1 — generator 입력 계약", () => {
  it("generator·route·modal 파일 존재", () => {
    expect(exists(GEN)).toBe(true);
    expect(exists(ROUTE)).toBe(true);
    expect(exists(MODAL)).toBe(true);
  });
  it("입력 인터페이스에 발신/기한/RFQ 필드 확장", () => {
    const src = read(GEN);
    expect(src).toMatch(/institutionName\??\s*:/); // 발신 기관명 (Organization.name)
    expect(src).toMatch(/contactName\??\s*:/);     // 담당 실명 (User.name)
    expect(src).toMatch(/contactPhone\??\s*:/);    // 전화 (User.phone)
    expect(src).toMatch(/replyDeadline(Days|Date)\??\s*:/); // 회신 기한 N일/date
    expect(src).toMatch(/rfqDisplayRef\??\s*:/);   // RFQ-{YYMM}-{XXXX} 표기
    expect(src).toMatch(/replyAddress\??\s*:/);    // {rfq}@reply.labaxis.co.kr
  });
});

// ── P2: 문서 본문 구조 (generator body) ──
describe("§rfq-doc-redesign P2 — 문서 구조", () => {
  it("금지어 0건: (공급사 미지정)·견적가 가격열·(인)·예상 금액 ₩0", () => {
    const src = read(GEN);
    expect(src).not.toMatch(/\(공급사 미지정\)/);
    expect(src).not.toMatch(/견적가/);
    expect(src).not.toMatch(/\(인\)/);
    expect(src).not.toMatch(/예상 금액|₩0/);
    expect(src).not.toMatch(/\(품목 미상\)/);
  });
  it("레터헤드: LabAxis 워드마크 + 견 적 요 청 서 대제 + 다크 룰", () => {
    const src = read(GEN);
    expect(src).toMatch(/LabAxis/);
    expect(src).toMatch(/견 적 요 청 서/); // 자간 대제(spaced)
    expect(src).toMatch(/#0f172a/);        // 다크 룰/헤더 컬러
  });
  it("문서정보: 문서번호(RFQ 표기)·발행일·회신 기한(레드)", () => {
    const src = read(GEN);
    expect(src).toMatch(/문서번호/);
    expect(src).toMatch(/발행일/);
    expect(src).toMatch(/회신 기한/);
    expect(src).toMatch(/#b91c1c|#b45309|#dc2626/); // 회신기한 레드 강조
  });
  it("수신/발신 2단 + 미지정 시 (수신처 기재)", () => {
    const src = read(GEN);
    expect(src).toMatch(/수신/);
    expect(src).toMatch(/발신/);
    expect(src).toMatch(/\(수신처 기재\)/); // 미지정 fallback (시스템 문구 아님)
  });
  it("인사 문단: 단가·납기·최소 주문 수량·견적 유효기간", () => {
    const src = read(GEN);
    expect(src).toMatch(/단가·납기·최소 주문 수량/);
    expect(src).toMatch(/견적 유효기간/);
  });
  it("품목표 다크헤더 + 요청 사항 열 (가격열 삭제)", () => {
    const src = read(GEN);
    expect(src).toMatch(/요청 사항/);
    expect(src).toMatch(/품목명|카탈로그/);
  });
  it("부가세 각주 + 조건 3행(회신 방법·요청 조건·비고)", () => {
    const src = read(GEN);
    expect(src).toMatch(/부가세 포함 여부/);
    expect(src).toMatch(/회신 방법/);
    expect(src).toMatch(/요청 조건/);
    expect(src).toMatch(/비고/);
  });
  it("회신 주소 미합성(param 주입) + 결문(인 없음) + 푸터", () => {
    const src = read(GEN);
    // generator 는 회신 주소를 만들지 않는다 — 잘못된 도메인 하드코딩 금지(UNMATCHED 방지).
    expect(src).not.toMatch(/@reply\.labaxis\.co\.kr/);
    expect(src).toMatch(/const replyTo = replyAddress/);
    expect(src).toMatch(/위와 같이 견적을 요청합니다/);
    expect(src).toMatch(/labaxis\.co\.kr/); // 푸터
  });
  it("데이터 규칙: 규격 없으면 — (em dash)", () => {
    const src = read(GEN);
    expect(src).toMatch(/["'`]—["'`]|\?\?\s*["'`]—/); // spec 없을 때 em dash fallback
  });
});

// ── P3: route/모달 wiring ──
describe("§rfq-doc-redesign P3 — wiring", () => {
  it("route: Organization·User.phone·User.name 발신 데이터 조회·전달", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/organization[?.]/i);
    expect(src).toMatch(/phone/);
    expect(src).toMatch(/institutionName|contactName|contactPhone/);
  });
  it("route: 회신 기한 N일 수신(query param) + RFQ 표기 변환", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/replyDeadline|deadlineDays|기한/);
    expect(src).toMatch(/rfqDisplayRef|RFQ-/);
  });
  it("route: 회신 주소 = canonical 인프라(ensureRfqToken·buildRfqReplyAddress·gate·직접수신 폴백)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/ensureRfqToken/);
    expect(src).toMatch(/buildRfqReplyAddress/);
    expect(src).toMatch(/INBOUND_RFQ_ENABLED/);
    expect(src).toMatch(/session\?\.user\?\.email/); // 직접수신 폴백
    expect(src).not.toMatch(/@reply\.labaxis\.co\.kr/); // 임의 주소 합성 금지
  });
  it("route: 실명 미입력 시 다운로드 차단(no dead button/front-only success)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/contactName|실명|name/);
    // 미입력 차단 = 400/422 또는 명시 에러
    expect(src).toMatch(/400|422|실명|프로필/);
  });
  it("modal: 응답 요청 기한 값을 다운로드 요청에 전달", () => {
    const src = read(MODAL);
    expect(src).toMatch(/generate-pdf/);
    expect(src).toMatch(/응답 요청 기한|deadline|기한/);
  });
});

// ── 회귀 0: canonical truth 보존 ──
describe("§rfq-doc-redesign — 회귀 0 (보존 항목)", () => {
  it("generator: Pretendard 3-후보 resolve + throw(§11.326)", () => {
    const src = read(GEN);
    expect(src).toMatch(/resolvePretendardPath/);
    expect(src).toMatch(/PretendardVariable\.ttf/);
    expect(src).toMatch(/throw new Error/);
  });
  it("generator: pdfkit A4 + 폰트 constructor 등록(§11.326 B-1)", () => {
    const src = read(GEN);
    expect(src).toMatch(/from "pdfkit"|require\("pdfkit"\)/);
    expect(src).toMatch(/size:\s*["']A4["']/);
    expect(src).toMatch(/font:\s*fontBuffer/);
  });
  it("route: auth + ownership 3-source + status 전환 + audit 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/guestKey/);
    expect(src).toMatch(/organizationMember/);
    expect(src).toMatch(/SENT/);
    expect(src).toMatch(/DATA_EXPORTED/);
  });
});
