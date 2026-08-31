# Implementation Plan: 입고 관리 리스트 리디자인 + 재고 반영 실배선 (§receiving-list-redesign)

- **Status:** 🔄 In Progress (P1~P4 구현 완료 · P5 호영님 환경 검증 대기)
- **Started:** 2026-08-30
- **Last Updated:** 2026-08-31
- **핸드오프:** 입고 관리 리스트 핸드오프.md · 시각 truth: 입고 관리 리스트 리디자인 (단독).html (1a)

**CRITICAL:** phase 완료마다 체크박스 갱신 → quality gate 전부 통과 → Last Updated 갱신 → 다음 phase.
⛔ gate 실패 상태 진행 금지 · dead button/no-op/placeholder success 금지 · truth 충돌 미해결 진행 금지.

## 0. Truth Reconciliation

**Latest Truth Source:** 핸드오프 md(2026-08-30) + 레포 실측. 시각 계약은 1a HTML.
**실측 (2026-08-30):**
- 구 데스크탑 행 = `buildModuleLandingItems`(unifiedInboxItems 이슈 단위) → 케이스 분열 실재 (§0.2)
- 우측 패널 = `receiving-quickview-drawer.tsx` (§11.334 P3) · 헤더 md+ 카드 박스 실재 (§0.3)
- 구 `postToInventory` = 데모 그래프 status 플립만 — Lot·수량·이력 0 (§0.1 blocker 확인)
- **상세 페이지는 이미 canonical**: §receiving-detail-redesign P1 이 데모 시드 폐기 →
  `GET /api/receiving-drafts/[id]` + 판정 `/inspect` + 반영 `/approve`
  (`/approve` = ProductInventory 증분 + InventoryRestock(Lot·expiry) 생성 + 라인 restockedAt
  이중 반영 가드 + order DELIVERED + audit — §4 요구 파이프라인이 이미 존재)
- 리스트만 데모 그래프 → 표면 모순 + 데모 행 클릭 시 상세 로드 실패(대응 draft 없음)

**Conflicts:** 핸드오프 표기 레포 `BioInsight-Lab` ↔ 실제 `ai-biocompare/apps/web` → 실제 레포 채택.
**호영님 결정 1 (2026-08-30 초기):** 데모 그래프 유지 + DB 별도 반영 — **정찰 보강으로 폐기.**
**호영님 결정 2 (2026-08-30 재승인, 채택):** **리스트도 ReceivingDraft canonical 전환.**
  반영 = 기존 `/approve` 재사용(신규 API 0) · 데모 이슈 행 폐기 → 모순 원천 제거.
**색 결정:** 시안 amber hex(#b45309 계열)는 CLAUDE.md §11.302 amber 금지에 따라
  yellow 신호등 토큰으로 치환(구조·의미 무변경). 재론 시 호영님 재승인 절차.
**Out (별도 배치):** 스캔 인식 고도화 §3(앵커 OCR·근사 매칭·신뢰도 화면·템플릿 학습) ·
  모바일 canonical 전환 · 입고 상세 리디자인 · dead file 정리(아래 분류표).

## 1. Priority Fit
- [x] Release blocker — §0.1 재고 미반영 (front-only)

## 2. Work Type
- [x] Feature + [x] Bugfix + [x] Web + [x] Design Consistency

## 3. Success Criteria (핸드오프 QA 승계)
- [x] 케이스 1건 = 1행, 이슈 분열·"반영 차단" 행 0 (뷰모델 unit + sentinel)
- [x] 플레인 헤더(AppPageHeader) + 타이포 통일
- [x] 파이프라인 4카드 + 필터 칩 + 검색 (0 단계 회색 정직 표기)
- [x] 행 클릭 = 인라인 펼침 · quickview-drawer page 마운트 0 (sentinel 역계약)
- [x] CTA 문구 = `caseCtaLabel()` 단일 계약 (접힌 행·펼침 — 하드코딩 sentinel 차단)
- [x] 보류 = "보류 보관 중" 칩만 · 필수 조치 아님 · 보류 제외 반영 가능 (unit + approve 서버 가드)
- [x] COA 인라인 드롭존 → `/api/receiving/documents/[orderId]` 실배선 (실패 경로 존재)
- [x] 반영 = 일괄 처리 모달 → `/approve` (Lot·수량·이력 실반영 + 이중 가드) · front-only 경로 0
- [ ] 호영님 환경 수동 smoke (아래 §7 P5)

**Out of Scope (구현 안 함):** 앵커 OCR·템플릿 학습 · ReceivingBatch 모델 신설 · 모바일 변경 · 상세 리디자인.

## 4. Canonical Truth Boundary
- Source of Truth: DB `ReceivingDraft`(+items·ReceivingDocument·InventoryRestock)
- Derived: `receiving-desktop-view-model.ts` 순수함수 → rows·pipeline·filterCounts·CTA (단일 소스)
- 모바일(md 미만)만 데모 그래프 잔존 — §mobile-receiving-rcv-card 무접촉(별도 배치)
- UI Surface: Inline expand · 기존 라우트 · 새 페이지 0 · 일괄 처리 모달 재사용(same-canvas)

## 5. 변경 파일
| 파일 | 변경 |
| :--- | :--- |
| `src/app/api/receiving-drafts/route.ts` | 확장(additive): 콤마 다중 status · documents(orderId in 1쿼리, N+1 0) · restockSyncedAt |
| `src/lib/ops-console/receiving-desktop-view-model.ts` | 신규 — draft → 케이스 행·조치·CTA·파이프라인 파생 |
| `src/lib/ops-console/__tests__/receiving-desktop-view-model.test.ts` | 신규 unit 11 (프로브 3종 검출 확인) |
| `src/components/receiving/receiving-case-list.tsx` | 신규 — 1a 리스트(4카드·칩·행·펼침·COA 드롭존) |
| `src/app/dashboard/receiving/page.tsx` | 재작성 — canonical fetch · AppPageHeader · 일괄 처리 모달 직행 · 드로어/데모 모달 제거 |
| `src/app/dashboard/receiving/__tests__/receiving-list-redesign.test.ts` | 신규 sentinel 12 (프로브 6종, ②·④ 보강 실측 포함) |
| `src/app/dashboard/receiving/__tests__/post-inventory-toast-wiring.test.ts` | supersede — 모바일 잔존 경로 재앵커 |
| `src/components/receiving/__tests__/receiving-quickview-drawer.test.ts` | supersede — page 배선 → 역계약(재마운트 금지) |
| `src/components/receiving/__tests__/receiving-post-modal.test.ts` | supersede — page 배선 → 역계약(데모 반영 재배선 금지) |
| `docs/plans/PLAN_receiving-list-redesign.md` | 본 문서 |

## 6. 검증 기록 (러너 기준 명시 — 축 없는 수치 금지)
- **격리 러너**(클라우드 vitest 3.1.1 · node env · 프로젝트 vitest.config 미적용):
  receiving 관련 22 스위트 151 tests → **150 GREEN + 1 환경 제약**
  (`receiving-doc-attach-canonical` migration 디렉터리 부재 — 스키마 무접촉이므로 프로젝트 러너에서 GREEN 예상).
- 주입 프로브: 뷰모델 3/3 · sentinel 6/6 검출 (미검출 2건은 단언 보강 후 재검출 — ② 창 시작점
  `!res.ok` 접두 매칭 · ④ JSX 텍스트 하드코딩 우회, 본문 주석에 실측 기록).
- 스코프 typecheck(대상 5파일): 에러 0 (기존 `src/auth.ts` 1건은 별건·무접촉).
- **게이트 정본 = 프로젝트 러너** — sandbox node_modules 가 Windows 설치본(rollup native 불일치)이라
  실행 불가. 호영님 환경 `npx vitest run` 필수(아래 P5).

## 7. Phases
- [x] **P0 Truth Lock** — 본 문서 §0
- [x] **P1 뷰모델** — RED→GREEN→프로브, 픽스처 보강(보류+문서 중첩 케이스)
- [x] **P2 리스트 리디자인** — 4카드·칩·행 + sentinel
- [x] **P3 인라인 펼침·드로어 폐기·COA 드롭존** — 역계약 승계 포함
- [x] **P4 재고 반영 실배선** — canonical 전환 + `/approve` 재사용 (신규 mutation API 0)
- [ ] **P5 Smoke (호영님 환경)** —
  1) `apps/web` 에서 `npx vitest run` 전체 GREEN 확인
  2) `npm run build` 통과 확인
  3) 수동: /dashboard/receiving → 4카드·행 1건=1케이스 → 행 펼침 → COA 첨부 → CTA →
     일괄 처리 모달 → 반영 → 재고관리 수량·Lot 증가 + 케이스 완료 전환 확인
  4) GREEN 확인 후 클로드코드 환경에서 push (sandbox push 금지)

## 8. Risks & 잔여
| 항목 | 상태 |
| :--- | :--- |
| §11.230c (a)-5 receiving hydration sentinel | **선재 RED** — HEAD 페이지에 이미 앵커 부재(§11.334 때 stale). 별건 분류 필요 |
| dead file 후보 (importer 0): receiving-quickview-drawer.tsx · receiving-post-modal.tsx · receiving-desktop-list.tsx · lib/receiving/receiving-list-view-model.ts (+ 그 sentinel) | 부활 차단 sentinel 존재. 삭제는 §inventory-dead-file-cleanup 선례대로 분류표 승인 후 별도 배치 |
| ReceivingReviewPanel 와 신규 리스트의 PENDING_REVIEW 중복 노출 | 이번 배치 무접촉(§11.348-A-4b sentinel 잠금). 패널 은퇴 여부 호영님 판단 대기 |
| CTA 문구: 상세 페이지·일괄 처리 모달 내부 문구는 자체 파생 잔존 | 리스트는 caseCtaLabel 단일. 3표면 공유 fn 통일은 상세 리디자인 배치에서 |
| `_to_delete/stage_tmp_receiving_*` | 스테이징 임시 사본 — 삭제 대상 |

## 9. Rollback
- 전체: `git checkout -- apps/web/src/app/dashboard/receiving apps/web/src/app/api/receiving-drafts/route.ts apps/web/src/components/receiving apps/web/src/lib/ops-console` + 신규 파일 삭제
- API 만: route.ts revert (additive 라 구 호출부 무영향)
- push 없음: 전 변경 호영님 검토 전 (sandbox/cowork commit 금지)

## 10. Notes
- 2026-08-30: 초기 승인(데모+별도 DB 반영) → 정찰 보강(상세 페이지 이미 canonical)으로 재승인 받아 P4 재정의.
- COA 드롭존 캡션은 "첨부 즉시 문서로 저장"만 약속 — OCR 자동 인식은 스캔 배치 전까지 지어내지 않음(배치 모달 §6 원칙).
- 승인(/approve)은 서버가 미판정 시 422 거부 — CTA 게이트와 이중 방어.
- 2026-08-31 (사후 검증): d8156765 land 본 대조 — ① page.tsx 로그 복원본에 className 개행 삽입 1건
  (`text-\nslate-600`, 빌드는 통과하나 클래스 손상) → sandbox 보관 원본(sha256 3485afa9…)으로 교체.
  ② sentinel ②·④ 프로브 보강(handleAttachDocument 창 시작점 · JSX CTA 리터럴 차단 · {cta} 2표면 카운트)이
  sandbox→디바이스 동기 누락으로 land 본에 빠져 있었음 → 보강본으로 교체. 두 건 모두 후속 커밋 필요.
