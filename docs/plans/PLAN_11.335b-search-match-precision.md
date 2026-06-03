# Implementation Plan: §11.335b — 소싱 검색 매칭 정밀화

- **Status:** 🔄 In Progress
- **Started:** 2026-06-02
- **Last Updated:** 2026-06-02
- **Priority:** P2 (release-prep / Phase B 뒤, §11.336 앞)
- **유형:** Bugfix / 검색 relevance (§11.335·§11.337-v3 보강)
- **Scope:** Small (3 phase)

> Quality Gate: 각 phase build/compile + 관련 test 통과(또는 "실행 불가" 명시) + no-op/dead state 없음 + canonical truth 경계 보존.

## Decision (승인됨)
- **2번 조이기** + **1글자 = min 2 빈 상태**("2글자 이상 입력하세요"). prefix/단어경계 우선 + 배지 강도 정정.

## Surface & Truth
- Source of Truth: 제품 카탈로그(불변). Derived: 검색 결과 목록 + 매칭 배지. Persistence: 없음(읽기). Surface: `/app/search` same-canvas.

## Phase 0 — Truth Lock ✅
- 매칭 진입: `lib/search/ranking.ts` `buildSearchQuery`(WHERE) + `scoreProduct`/`sortByRelevance`(랭킹, 서버 Node 실행).
- 배지: `sourcing-result-row.tsx` `buildMatchReason`(현재 `name.includes` → mid-word 'p'도 "품명 일치" = 신호 손실).
- 점수: `RANKING_WEIGHTS`에 PREFIX/CONTAINS 있음, **word-boundary 티어 없음**.
- 현재 작업 파일 = §11.337-v3(미배포, 라이브=v2). §11.335b가 supersede.

## Phase 1 — Contract & Tests
- `<2자` → 결과 없음 + 빈 상태 "2글자 이상".
- 랭킹: 시작 일치 > 단어경계 > 포함.
- 배지: "품명 시작 일치" / "품명 포함" / "Cat.No 일치" / "제조사 일치" 강도 구분.
- REFRIG(품명 무 P, Cat.No `PR505750R`) → "Cat.No 일치" 회귀 방지.

## Phase 2 — Core Matching
- min length 2 guard(buildSearchQuery + API route).
- 2자: name startsWith / name 공백-경계 / catNo startsWith (mid-word 컷). ≥3자: contains+brand 보존(§11.335).
- scoreProduct: nameWordBoundary 티어(WORD_BOUNDARY=30, NAME_PREFIX 40 > 30 > NAME_CONTAINS 20).

## Phase 3 — UI Wiring
- 배지 강도(시작=blue, 포함/Cat.No/제조사=slate) buildMatchReason 재작성.
- 1글자 빈 상태 "2글자 이상 입력하세요".
- same-canvas 보존, dead/no-op 없음.

## Risks
- 과도 조임 → min2 보수적, 2자는 startsWith+공백경계로 정당 매칭 보존.
- 한글/대소문자 → normalize 단계 명시.
- §11.335 회귀 → REFRIG/Cat.No fallback 테스트.

## Rollback
- P1: test revert / P2: scorer+WHERE revert(§11.337-v3 복귀) / P3: 배지·빈상태 UI revert.

## 검증
- vitest·tsc 미설치 → 자동 **실행 불가**. 정적 + 라이브(Chrome) 검증. 배포 후 재확인.
