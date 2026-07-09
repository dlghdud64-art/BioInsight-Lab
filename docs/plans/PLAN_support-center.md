# Implementation Plan: 운영 지원 센터(Support Center) 고도화

- **Status:** ⏳ Pending
- **Started:** 2026-07-05
- **Last Updated:** 2026-07-05
- **Estimated Completion:** (phase 진행에 따라)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시: ① 체크박스 체크 ② quality gate 검증 ③ Last Updated 갱신 ④ Notes 기록 ⑤ 통과 후에만 다음 phase.
⛔ quality gate 실패/미해결 truth 충돌 상태로 진행 금지. ⛔ dead button / no-op / placeholder success 금지.

> 대상: `apps/web/src/app/dashboard/support-center/page.tsx` (현재 1413줄, client component, 정적 데이터 배열).
> 시안: `운영 지원 센터 고도화.html` · 핸드오프: `운영 지원 센터 고도화 핸드오프.md`.
> 실행: sandbox 워킹트리 구현 → operator(클로드코드)가 build/commit/push. push는 sandbox 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 호영님 핸드오프(운영 지원 센터 고도화 핸드오프.md) + 시안 HTML + 현재 page.tsx.

**Secondary References:** 스크린샷 3장(개선 뷰: 매뉴얼/문제해결/티켓), CLAUDE.md 제품 원칙.

**Conflicts Found:**
- §5 AI 도우미 chatbot ↔ CLAUDE.md "AI/chatbot UI 신규 금지 · ontology를 assistant로 재해석 금지".
- §1 ⌘K 커맨드 팔레트 ↔ "ontology를 command palette로 재해석 금지".

**Chosen Source of Truth (호영님 결정 2026-07-05):**
- §5 **승인** — AI 도우미 포함(요금·도입 영역에도 존재). 단 no-fake/할루시네이션 방지 원칙상 **근거 기반 검색형**으로 구현: 매뉴얼·시나리오 인덱스 실매칭 → 답변 카드 + 출처 칩·딥링크. 근거 없으면 "문제 해결/새 문의로 안내". 자연어 LLM 생성/가짜 답변 없음.
- §1 **승인** — 통합 검색 + ⌘K 오버레이(검색 전용 탐색 유틸, 도메인 조작 아님).

**Environment Reality Check:**
- [x] repo/branch: main, sandbox 워킹트리 (settings 트랙 §1~§4 이미 push됨)
- [x] runnable: operator가 `npm run build --workspace=web` (필터 파이프 없이) + sentinel(vitest)
- [x] blockers: sandbox git index/마운트 손상 이력 → 검증은 Read 툴 우선, build는 operator

## 1. Priority Fit
- [x] Post-release(설정 트랙 종료 직후 호영님 지정 현행 트랙). 추정 — 독립 P1 리스트 재확인은 안 함.
- 정적 데이터 UI/인터랙션 리팩토링 → canonical-truth·billing·auth 무관, 저위험.

## 2. Work Type
- [x] Feature / Design Consistency (same-canvas UI·인터랙션). 서버/API/스키마 변경 없음.

## 3. Overview
**설명:** 3탭 지원 센터를 통합 검색·⌘K·매뉴얼 리더·문제해결 프리필·티켓 파이프라인으로 고도화. 데이터는 파일 내 정적 배열 유지.

**Success Criteria:**
- [ ] §0 통합 검색 바 + §1 ⌘K 오버레이(3그룹 실시간 필터·딥링크)
- [ ] §2 매뉴얼: 카테고리 실전환 + 인기 가이드 3카드 + 슬라이드 리더 패널
- [ ] §3 문제해결: 칩 9→6 통합 + 안전 전면 + 티켓 프리필(증상·카테고리·시도조치)
- [ ] §4 티켓: 파이프라인 + SLA 배지 + 답변 본문 + 직접 문의 배너/작성폼
- [ ] §5 AI 도우미: 근거 기반 검색형(출처 칩·딥링크·근거없음 안내)

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] 자연어 LLM 생성/가짜 AI 답변(할루시네이션) — §5는 매뉴얼 인덱스 실매칭만
- [ ] 서버 RAG 엔드포인트/스키마 변경(별도 트랙 `#support-ai-rag`)
- [ ] page-per-feature 분절, support center를 퍼블릭 hero hub로 회귀

**User-Facing Outcome:** 한 화면에서 매뉴얼·증상·티켓을 검색(⌘K)하고, 매뉴얼을 리더로 읽고, 증상에서 티켓을 프리필 생성하고, 티켓 진행을 파이프라인으로 확인.

## 4. Product Constraints
**Must Preserve:** same-canvas(탭 내 오버레이/슬라이드), 정적 데이터 truth, 사이드바 진입.
**Must Not Introduce:** page-per-feature, fake AI 답변, dead button/no-op, 퍼블릭 hero hub 회귀.
**Canonical Truth Boundary:** Source=파일 내 정적 배열(CAT/시나리오/티켓). Projection=검색 인덱스(파생). Persistence=없음(정적). 티켓 "새 문의/프리필"은 클라이언트 상태(서버 저장은 별도 트랙).
**UI Surface Plan:** [x] Inline expand(아코디언) · [x] Right dock(매뉴얼 리더 슬라이드) · [x] Split panel(티켓) · [x] Existing route section. New page 없음.

## 5. Architecture
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| 정적 데이터 유지 | 서버/스키마 변경 없이 UI 고도화 | 실 지속성 없음(별도 트랙) |
| §5 근거 검색형 | no-fake·anti-hallucination + 호영님 승인 정합 | 자연어 생성 없음(딥링크 반환) |
| ⌘K 검색 전용 | 탐색 유틸, ontology 재해석 아님 | command 실행 없음(의도된 제한) |

**Touched:** `support-center/page.tsx` 단일 파일. 사이드바/헤더 미니검색은 강조만 낮춤(선택).

## 6. Test Strategy
- Sentinel(readFileSync+regex, CLAUDE.md 패턴): 각 phase 신규 패턴 존재 + 금지 패턴 부재 + 회귀 보존.
- User-visible: operator 런타임 육안(탭별 렌더·⌘K·리더·프리필·파이프라인).
- build: operator `npm run build`(EXIT 0). sandbox는 Read-tool ground truth.

## 7. Phases

### Phase 0 — Context & Truth Lock
- Status: [ ] Pending
- 🔴 현재 page.tsx 전체 정독, 기존 기능↔시안 5항목 매핑, 데이터 구조(CAT/시나리오/티켓) 확인.
- 🟢 각 phase 편집 앵커 확정. ⌘K 인덱스 소스 확인.
- ✋ Gate: 기존 구조 오해 0, 편집 앵커 확정. Rollback: planning-only.

### Phase 1 — §0 통합 검색 + §1 ⌘K 오버레이
- Status: [x] Complete (sandbox 구현 · operator build 대기)
- 🔴 sentinel: ⌘K 오픈(클릭/Ctrl+K)·Esc·배경닫힘, 3그룹 결과, 딥링크 존재.
- 🟢 통합 검색 바 + ⌘K overlay(기존 globalSearch 인덱스 재사용) + prefers-reduced-motion.
- ✋ Gate: dead button 0, Esc/배경 닫힘, 결과 클릭→탭 이동. Rollback: overlay 제거.

### Phase 2 — §2 매뉴얼(카테고리 전환 + 인기 3카드 + 리더) + §5 AI 도우미
- Status: [x] Complete (sandbox 구현 · operator build 대기)
- 🔴 sentinel: 카테고리 클릭 실전환, 인기 가이드 3카드, 리더 슬라이드 패널, AI 도우미 근거매칭+출처칩+근거없음 안내.
- 🟢 category→guides→steps 리더(right dock, transform .28s). AI 도우미=인덱스 실매칭 카드.
- ✋ Gate: fake AI 답변 0, 리더 페이지이동 0(same-canvas), 빈결과 안내. Rollback: 리더/도우미 제거.

### Phase 3 — §3 문제해결(칩 6통합 + 안전 전면 + 프리필)
- Status: [x] Complete (sandbox 구현 · operator build 대기)
- 🔴 sentinel: 칩 6개(계정·로그인/검색·견적·구매/안전·규제/알림·결제/오류·기타/전체), MSDS 전면, 프리필(증상·카테고리·시도조치).
- 🟢 칩 매핑 통합, 안전 시나리오 우선 정렬, "이 이슈로 티켓 생성"→티켓 탭 프리필.
- ✋ Gate: 프리필 실배선(no-op 아님), 아코디언 max-height 전환. Rollback: 칩/프리필 원복.

### Phase 4 — §4 티켓(파이프라인 + SLA + 답변본문 + 직접문의/작성폼)
- Status: [x] Complete (sandbox 구현 · operator build 대기)
- CSRF fix: handleSubmit raw fetch → csrfFetch(전역 CSRF 게이트 대응) 완료.
- 🔴 sentinel: 파이프라인 5단계, SLA 배지, 답변 본문 노출, 직접 문의 배너, 작성폼(프리필 안내 배너).
- 🟢 상태 파이프라인(계단식 fade-in) + SLA + 작성폼(클라이언트 상태). "담당자가 답변 등록" 요약 제거.
- ✋ Gate: 작성폼 fake 제출 성공 금지(정직 handoff/클라 상태), 프리필 안내. Rollback: 파이프라인/폼 원복.

### Phase 5 — Sentinel + Build + Rollback
- Status: [x] Complete
- 🟢 sentinel 16/16 green(operator, P1~P4 누적), 각 phase build EXIT 0, push 완료.
- 커밋: P1 `7f557c92` · P2 `1a2fb7b6` · P3 `58ae8d44` · P4 `c667556a`.
- ✋ Gate 통과. Rollback: 단일 파일 원복 or phase별 커밋 revert.

**배포 후 런타임 smoke 체크리스트 (호영님/operator, Chrome):**
- [ ] ⌘K/Ctrl+K 오버레이 오픈·Esc·배경 닫힘·3그룹 결과·티켓 딥링크
- [ ] 매뉴얼: 안전·규제 카테고리·인기 3카드·슬라이드 리더 오픈/닫힘
- [ ] AI 도우미: 예시칩→근거 매칭+출처칩, 무의미 질의→"근거 없음" 안내(생성 0)
- [ ] 문제해결: 칩 6개·MSDS 상단·아코디언 부드러운 펼침·"이 이슈로 티켓 생성"→프리필(카테고리 자동선택)
- [ ] 티켓: 파이프라인 5단계·SLA 배지·답변 본문·직접문의 배너
- [x] 🛑 CSRF: 새 문의 제출 → **200 실증 완료** (2026-07-09, Claude in Chrome 테스트 제출 → Vercel 런타임 로그 `POST /api/support/inquiry 200` edge-middleware 통과). csrfFetch 더블서브밋 토큰 정상.

## 8. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| §5가 fake AI로 오인 | Med | High | 근거 검색형·출처칩·근거없음 안내로 명시(자연어 생성 0) |
| ⌘K가 command-palette 재해석 인상 | Low | Med | 검색·이동 전용, 도메인 조작 없음 |
| 대형 단일파일 JSX 회귀 | Med | Med | phase별 sentinel + Read ground truth + operator build |
| 마운트/인덱스 손상 오검증 | Med | Low | grep 대신 Read 툴 우선, build는 operator |

## 9. Rollback
- 단일 파일(`page.tsx`) 트랙별 원복. plan 문서는 유지. 서버/스키마 변경 없어 migration rollback 불필요.

## 10. Progress
- Overall: 100% ✅ · Current phase: 완료 · Blocker: 없음 · Next: 배포 후 런타임 smoke(§7 P5 체크리스트).
- [x] P0 [x] P1 [x] P2 [x] P3 [x] P4 [x] P5

## 11. Notes & Learnings
- [2026-07-05] §5 AI 도우미 — 호영님 승인 + no-fake 정합 위해 근거 검색형으로 확정. 서버 RAG는 별도 트랙 `#support-ai-rag`.
- [2026-07-05] **트랙 완료** — P1~P5 전량 라이브. 커밋 `7f557c92`→`1a2fb7b6`→`58ae8d44`→`c667556a`. sentinel 16/16, 각 build EXIT 0.
- [2026-07-05] CSRF — handleSubmit raw fetch가 pre-existing 위험이었고 P4에서 csrfFetch로 해소(엣지 런타임이라 배포 후 문의 제출 200 실증 필요).
- [2026-07-05] 마운트 이슈 — sandbox bash 마운트가 세션 내내 stale/truncated. 검증은 Read 툴(ground truth) 우선, build/sentinel은 operator 클린 환경.
- 후속 별도 트랙: `#support-ai-rag`(실 RAG), 티켓 실 지속성(현재 MOCK_TICKETS 정적).
- 병렬 미결(타 트랙): DMSO H227 · SM-P4d · #settings-notification-persist · #settings-role-member-count · #billing-pg-billingkey.
