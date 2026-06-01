/**
 * §11.300 #audit-page-cleanup — audit page 개발 지표 제거 + 사이드바 영문
 *   병기 제거 회귀 차단.
 *
 * 호영님 P1 (2026-05-24): /dashboard/audit 화면이 일반 사용자에게 개발
 *   디버깅 화면처럼 보이던 회귀 (운영 브리핑 캐시 통계 / Injection 패턴
 *   Top / "$11,142 ecosystem" 등 영문 raw 텍스트) 차단.
 *
 * Phase 1a 결정 (호영님 Q1=OK, Q2=C 보류, Q3=C 보류):
 *   - 캐시 통계 block 제거만 진행
 *   - 활동 로그 데이터 source 연결은 별도 batch (§11.300b 보류)
 *   - 캐시 통계 admin route 이전은 별도 batch (§11.300c 보류)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const AUDIT_SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/audit/page.tsx"),
  "utf8",
);
const SIDEBAR_SRC = readFileSync(
  resolve(__dirname, "../../app/_components/dashboard-sidebar.tsx"),
  "utf8",
);

describe("§11.300 — audit page cleanup + 사이드바 영문 병기 제거", () => {
  it("§11.300 trace marker", () => {
    expect(AUDIT_SRC).toMatch(/§11\.300/);
  });

  describe("audit page — 개발 지표 4 block 제거", () => {
    it("운영 브리핑 캐시 통계 block 제거 (h2 라벨 부재)", () => {
      // comment trace 는 허용 — h2 JSX render 부재만 검증
      expect(AUDIT_SRC).not.toMatch(/<h2[\s\S]{0,80}>운영 브리핑 캐시 통계/);
      expect(AUDIT_SRC).not.toMatch(/h2.*운영 브리핑 캐시 통계/);
    });

    it("StatCell helper component 제거 (정의 + 사용 모두 부재)", () => {
      expect(AUDIT_SRC).not.toMatch(/function StatCell\(/);
      expect(AUDIT_SRC).not.toMatch(/<StatCell/);
    });

    it("briefCacheStats useQuery 제거 (state + fetcher 부재)", () => {
      expect(AUDIT_SRC).not.toMatch(/briefCacheStats/);
      expect(AUDIT_SRC).not.toMatch(/queryKey:\s*\["operational-brief-cache-stats"\]/);
    });

    it("개발 raw 텍스트 제거 (KV 통합 / LLM hallucination / prompt drift / fitness drift)", () => {
      expect(AUDIT_SRC).not.toMatch(/KV 통합/);
      expect(AUDIT_SRC).not.toMatch(/LLM hallucination/);
      expect(AUDIT_SRC).not.toMatch(/prompt drift/);
      expect(AUDIT_SRC).not.toMatch(/fitness drift indicator/);
    });

    it("Injection 시도 quick filter chip 제거 (라벨 + magic string 부재)", () => {
      expect(AUDIT_SRC).not.toMatch(/Injection 시도/);
      expect(AUDIT_SRC).not.toMatch(/Injection 패턴 Top/);
      expect(AUDIT_SRC).not.toMatch(/prompt_injection_detected/);
      expect(AUDIT_SRC).not.toMatch(/topInjectionPatterns/);
    });

    it("fitness drift 지표 제거 (fitness_pass / fitness_fail / fitnessPassRate)", () => {
      // 변수 사용 0 — 주석 안에도 식별자 형태로 남아있지 않음
      expect(AUDIT_SRC).not.toMatch(/fitness_pass:\s*number/);
      expect(AUDIT_SRC).not.toMatch(/fitness_fail:\s*number/);
      expect(AUDIT_SRC).not.toMatch(/fitnessPassRate/);
    });
  });

  describe("audit page — 기본 감사 로그 표시 보존 (회귀 0)", () => {
    it("기본 테이블 헤더 보존 (일시/ID, 작업자/IP, 액션/대상, 변경 내역, 사유/인증)", () => {
      expect(AUDIT_SRC).toMatch(/>일시 \/ ID</);
      expect(AUDIT_SRC).toMatch(/>작업자 \/ IP</);
      expect(AUDIT_SRC).toMatch(/>액션 및 대상</);
      expect(AUDIT_SRC).toMatch(/>변경 내역</);
      expect(AUDIT_SRC).toMatch(/>사유 \/ 인증</);
    });

    it("필터 보존 (기간 + 액션 + 검색 input)", () => {
      expect(AUDIT_SRC).toMatch(/PERIOD_OPTIONS/);
      expect(AUDIT_SRC).toMatch(/EVENT_TYPE_OPTIONS/);
      expect(AUDIT_SRC).toMatch(/setSearch/);
    });

    it("내보내기 버튼 3종 보존 (간단 인쇄 / 정형 PDF / CSV)", () => {
      expect(AUDIT_SRC).toMatch(/handlePdfDownload/);
      expect(AUDIT_SRC).toMatch(/handleCompliancePdf/);
      expect(AUDIT_SRC).toMatch(/handleCsvExport/);
    });

    it("main /api/audit-logs fetcher useQuery 보존", () => {
      expect(AUDIT_SRC).toMatch(/queryKey:\s*\["audit-logs"/);
      expect(AUDIT_SRC).toMatch(/\/api\/audit-logs\?/);
    });

    it("권한 카드 (ShieldAlert + 관리자 가시성) 보존", () => {
      expect(AUDIT_SRC).toMatch(/<ShieldAlert/);
      expect(AUDIT_SRC).toMatch(/canAccessAudit/);
    });
  });

  describe("dashboard sidebar — 감사 추적 라벨 (§11.345 용어 정정)", () => {
    it('"감사 증적" → "감사 추적", 영문 병기 없음', () => {
      expect(SIDEBAR_SRC).not.toMatch(/감사 증적/);
      expect(SIDEBAR_SRC).not.toMatch(/감사 추적 \(Audit Trail\)/);
      expect(SIDEBAR_SRC).toMatch(/title:\s*"감사 추적",\s*href:\s*"\/dashboard\/audit"/);
    });
  });
});
