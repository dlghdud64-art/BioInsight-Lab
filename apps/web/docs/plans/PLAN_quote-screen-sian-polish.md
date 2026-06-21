# Implementation Plan: 견적 관리 화면 시안 정합 보완 (P6)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-21
- **Last Updated:** 2026-06-21

**CRITICAL**: phase 완료마다 ① 체크 ② operator delta-gate(vitest+build) ③ 무회귀 ④ Notes ⑤ 다음 phase.
⛔ 전면 재작성 금지 · 최소 diff · honesty 제약(fake handoff·dead button·빈 트레이 금지) 유지 · 기존 색 토큰(blue-600 등) 상속, 새 색 금지 · 우선순위·마감·회신 수 저장 금지(읽을 때 파생) · page.tsx 대량 편집 Edit 도구만.

## 0. Truth Reconciliation
- **Latest Truth**: CEO 지시문(견적 관리 리디자인, 2026-06-21) + 지시문 §06~§12 + 라이브 Chrome 대조(2026-06-21) 미정합 4영역 + 새 시안 HTML(5b0862ca).
- **Conflict**: P2/P3(테이블 셀만 시안 land) ↔ 화면 전반(단계색·필터·AI카드·발송모달) 미정합. → **Chosen = 시안 전체 정합(지시문 정답지)**.
- **수정 대상(이 범위만)**: app/dashboard/quotes/page.tsx(목록·툴바·단계칩·필터·AI카드) + 발송 검토 모달 컴포넌트(vendor-dispatch-workbench / vendor-request-modal — P6.4 착수 시 확정) + 비교 모달(§10은 별도 백엔드 트랙으로 이미 분리).

## 1. Priority Fit
- [x] Post-release / Design Consistency (CEO P4 라이브 지시).

## 2. Phases

### P6.1: 단계 칩 §12 stage 색 — [ ]
- stageDot + 칩 bg/text 를 railState→stage(s1~s5) §12 색 매핑: request_not_sent=발송(파랑) · awaiting/delayed=회신(노랑) · compare*=비교(보라) · external_approval=승인(초록) · ready_for_po=발주(회색). (내 P3 결함 hotfix — 현재 request_not_sent가 else=emerald 초록 오류.)
- Gate: §11.302 신호색, due-date/p4-core-b/sian dot 단언 무회귀, build.

### P6.2: 빠른 필터 §08 — [ ]
- MODE_CHIPS 재정의(시안 3항목 교체, CEO 결정): 마감 임박(dDay≤2, 빨강) · 높음 우선(priority high, 빨강) · 회신 정체(s2 stall, 앰버). 기존(차단 있음·전환 가능·우선 처리) 제거. 칩에 건수 배지 + 색(위험=빨강, 주의=앰버), 0건 비활성.
- Gate: 필터 로직 무회귀(AND 결합·정렬 보존), honesty(0건 비활성), build.

### P6.3: AI 추천 카드 §07 — [ ]
- "나중에" 보류 버튼(추천 일시 보류 state) + 액션 버튼 라벨 next.label("견적 요청 발송"). PriorityRecommendationCard. dead button 0(나중에=실제 보류 동작).
- Gate: computePriority 1위 추천 보존, 실행 버튼 다음 액션 연결, build.

### P6.4: 발송 검토 모달 §09 — [ ]
- 라이브 중복 상태 블록 4개 → 단일 스텝퍼(공급사 선택✓→연락처 확인✓→메시지 검토✓→전송) 통합. cuid 노출(quote ID) 봉합(quoteDisplayRef). 2상태 분기(공급사 유=전송 준비 완료 / 무=공급사 추가 — honesty 발송 0곳 비활성 유지). 받는 공급사 카드·메시지 초안·응답 기한 보존.
- Gate: 발송 wiring(공급사 선별·전송·honesty 0곳 비활성) 무회귀, fake handoff 0, build.

### P6.5: 카드형 레이아웃·운영 브리핑 (지시문 3) — [ ] (라이브 대조 후 실 미정합만)
- 카드 리스트(상태칩·RFQ·담당자·미니 진행스텝·공급사 응답·마감) + 우측 운영 브리핑 패널. ≥1100px 고정 / <1100px 슬라이드 드로어(딤·X). accent 세로 띠 금지(선택=전체 테두리+링). 대부분 §11.248 land — 라이브 대조로 gap만.

### P6.6: 필터 팝오버·정렬 (지시문 4·5) — [ ] (라이브 대조 후 실 미정합만)
- 검색(견적명·품목·RFQ·공급사 실시간) + 필터 팝오버(우선순위·회신상태·금액 다중 AND·적용개수 배지·초기화) + 정렬 5종(우선순위/마감/금액/회신율/이름) + 오름·내림 토글. 대부분 land — gap만.

### P6.7: sentinel sweep + delta-gate + Chrome 재대조 — [ ]
- 전 디렉토리 sweep(단계칩 색·필터·AI카드·발송모달 핀 sentinel 진화). 신규 sentinel. operator delta-gate. Chrome 라이브 재대조(시안 1:1).

## 9. Risk
- 단계 칩 색: railState→stage 매핑 8→5 정확성(condition_check 등 누락 주의).
- 필터 재정의: 기존 MODE_CHIPS 제거가 statusFilter·정렬·배치 wiring 회귀 유발 가능.
- AI 카드 "나중에": 신규 보류 state(영속성 범위 — session vs localStorage 결정).
- 발송 모달 §09: 대규모 리팩터 — wiring(전송·honesty) 보존 최우선, 최소 diff.

## 10. Rollback
- phase별 className/구조 revert. 발송모달은 git show HEAD 소스 기준 복구.

## 11. Progress
- Current phase: P6.1
- Checklist: [ ] P6.1 [ ] P6.2 [ ] P6.3 [ ] P6.4 [ ] P6.5

## 12. Notes
- [2026-06-21] CEO P4 라이브 대조 → 미정합 4영역(단계색·필터·AI카드·발송모달) 지시문으로 범위 확정. §10 비교는 백엔드 트랙 분리(별개).
