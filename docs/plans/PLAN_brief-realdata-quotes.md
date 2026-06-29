# Implementation Plan: 운영 브리핑 실데이터 연동 — quotes-first

- **Status:** 🔄 In Progress
- **Started:** 2026-06-29

**CRITICAL**: phase별 gate→Notes→다음. ⛔ 가짜로 카드 채우기 금지. ⛔ speculative build(예측/자동승인/신뢰도%) 금지. ⛔ 코드 구조 변경 시 그 구조 정확매칭 sentinel 동반 진화.

---

## 0. Truth Reconciliation & 결정

**핵심:** 운영 브리핑은 현재 시드(데모) 데이터. quotes-only 실데이터로 연동(나머지 모듈 0). `buildInboxFromQuotes`(순수·서버 안전) 재사용 — due/priority/triage canonical, drift 0.

**호영님 directive(2026-06-29):**
- LIVE 브리핑 = **quote_response_pending 1종**으로 한정. 가짜 4칸 채우기 금지.
- 견적 통보(완료/취소 이메일) = 실 quote ID end-to-end. 유일한 실 mutation. 미리보기→확인 구조 유지.
- 데모 배지는 quotes 실데이터 붙은 뒤 제거. PO/입고/재고 0건 = "연동 예정" 아니라 그냥 표시 안 함.
- §7 stub(예측 "내일 예상"·자동승인·신뢰도%) = 백엔드 없음. 손대지 말 것(정적 또는 LIVE 숨김).

### P0 — 죽은 카드 명시 (핸드오프 §2 carve-out)
핸드오프 §2 카드 4종 중 LIVE 실데이터로 못 채우는 것 = **죽은 카드, LIVE 미렌더**:
- **2-1 FEATURE "발주 생성"** → 발주 기능 전 표면 제거됨(ENABLE_PURCHASING=false). 죽음.
- **2-3 발주 리마인더 이메일** → 발주 제거. 죽음.
- **2-2 3사 비교표** → `QuoteComparison` **Prisma 모델 없음**. 비교 계산 레이어 부재 → 못 채움. 죽음.
- ⟹ LIVE 실제 노출 = **2-4 부분의 정신을 잇는 "공급사 응답 대기"(quote_response_pending) 1종**.
- 코드상 자연 강제: LIVE inbox endpoint가 quote_response_pending만 emit(comparisons=[] → 비교 검토 아이템 자연 미생성, PO/receiving/stock_risk 미조회). 가짜 0.

### honest 상태 매핑 (DB QuoteStatus → contract)
- DB **SENT** → contract `'sent'` → quote_response_pending(공급사 응답 대기). ✓ 유일 노출.
- DB RESPONDED = "응답 완료" → "응답 대기"로 표기하면 거짓 → **제외**(비교/완료 아이템은 comparison 모델 후속).
- DB PENDING/PARSED(draft)·COMPLETED/PURCHASED/CANCELLED(terminal) → 제외.

## 1. Priority Fit
- [x] Post-release foundational — 브리핑 honesty 근본 해결(데모→실). 호영님 directed.

## 2. Work Type
- [x] Feature · [x] Workflow wiring · honesty-critical · 신규 1 라우트

## 3. Overview

**Success Criteria:**
- [ ] `GET /api/operational-brief/inbox` — auth + userId 스코프, SENT 견적만, `buildInboxFromQuotes(reqs, resps, [])` → UnifiedInboxItem[]
- [ ] popup: LIVE 시 endpoint fetch → items 사용, `BRIEF_DATA_IS_LIVE=true`, 데모 배지 제거, 견적 통보 활성화
- [ ] LIVE 노출 = quote_response_pending만(PO/receiving/stock_risk 0, 비교/발주 카드 0)
- [ ] 견적 통보 = 실 quote ID로 detail/PATCH end-to-end
- [ ] 로딩/에러/empty 상태 정직

**Out of Scope (⚠️):**
- [ ] PO/receiving/stock_risk 실데이터 · 비교 검토 아이템(comparison 모델) · 예측/자동승인/신뢰도%
- [ ] org-wide 스코프(현 pilot=userId 본인 견적) · 발주 카드 부활

## 4. Product Constraints
- Must Preserve: `buildInboxFromQuotes` canonical 로직 재사용(due/priority/triage drift 0) · 기존 popup 기능 · honesty
- Must Not Introduce: 가짜 카드 · speculative build · 신규 DB migration(읽기 전용 쿼리만)
- Canonical Truth: inbox = 실 Quote 파생(읽기). 통보 = 기존 PATCH(SoT). 어댑터는 표시용 contract shape(truth 변형 0).

## 5. Architecture
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| buildInboxFromQuotes 재사용 + 계약 어댑터 | 단일 inbox 로직·drift 0 | 계약 full shape 구성(읽히는 필드+안전 기본값) |
| SENT만 매핑 | "응답 대기" 정직 | RESPONDED 미노출(완료 아이템 후속) |
| userId 스코프 | 최소·detail/PATCH owner 체크와 정합 | org-wide 후속 |
| LIVE fetch in popup | 시드 store 불침범(8 surface) | popup 데이터 소스 분기 1개 |

## 6. Test Strategy
- 어댑터 단위(SENT→sent·terminal 제외·comparisons=[]) · route(auth/스코프/shape) · popup(LIVE fetch·플래그·배지 제거). sentinel + operator vitest.

## 7. Phases
- **P0** [in-progress] 죽은 카드 결정 기록(본 문서) + LIVE = response_pending 한정 강제.
- **P1** 어댑터 `lib/operational-brief/real-quote-inbox.ts`: 실 Quote(SENT) → QuoteRequestContract('sent')+QuoteResponseContract → buildInboxFromQuotes(…, []) → UnifiedInboxItem[].
- **P2** route `GET /api/operational-brief/inbox`: auth + userId + 어댑터 호출 → { items }.
- **P3** popup LIVE wiring: BRIEF_DATA_IS_LIVE=true, LIVE 시 endpoint fetch→items, 배지 제거, 통보 활성화, 로딩/에러.
- **P4** sentinel + operator gate + 배포 + 라이브(실 견적 inbox·통보 end-to-end).

## 9. Risks
| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 계약 full shape tsc 불일치 | Med | Med | 정확 필수 필드 확인 완료, operator tsc |
| LIVE empty(SENT 견적 0) → 빈 브리핑 | Med | Low | idle 정직 카피(기존) |
| 데모 store 다른 surface 영향 | Low | Med | popup만 LIVE fetch, store 불변 |
| popup 대형 파일 truncation | Med | Med | python + tail/컴포넌트수/3곳-wiring grep |

## 10. Rollback
- P1/P2: 신규 파일 삭제 / P3: popup revert(플래그 false 복귀) / P4: 커밋 revert

## 11. Progress
- Overall: 10% · Current: P0/P1

## 12. Notes
- [2026-06-29] LIVE = quote_response_pending 1종. 발주/비교/리마인더 카드 = 죽음(LIVE 미렌더). buildInboxFromQuotes 재사용, comparisons=[].
