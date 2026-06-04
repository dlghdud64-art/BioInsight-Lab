# Implementation Plan: §11.368 §0 AI 정책 톤다운 (런칭 게이트)

- **Status:** ⏳ Pending
- **Started:** 2026-06-04
- **호영님 P1 (§0 런칭 게이트). 외부 공개 전 클리어 3종(§0·G-2·G-3) 중 G-3 완료 → §0.**

**CRITICAL**: phase 완료마다 체크박스·Last Updated / quality gate(Claude Code tsc·lint·test) / dead button·no-op 금지 / **AI 기능 자체는 유지(숨김 아님), "AI 판단/추천" 마케팅 톤·판단 주체 표기만 절제** / 미해소 충돌로 진행 금지.

---

## 0. Truth Reconciliation

**§0 정책 (D-9 전제 인용):** "결정형·투명, 'AI 판단' 금지." = 운영 OS는 **규칙 기반 결정형** 표기. AI가 판단/추천한다는 마케팅 표기 금지. 출처·감사로그 없는 생성형 NL 미노출(B분류).

**기존 정책 자산 (Phase 0 확인):**
- `lib/ai/public-ai-messaging-freeze.ts`, `lib/ai/ai-implementation-freeze.ts`, `lib/public-ai-sentence-bank.ts`, `lib/public-ai-messaging-freeze.ts` = **공개 AI 메시징 freeze 정책 이미 존재**. §0은 이 freeze를 UI에 강제 적용 + 미적용 잔존 정리.

**현 위반 (UI 노출 AI 마케팅 톤 — 전수):**
- 대시보드 운영: `ai-insight-dialog`("AI 리포트 생성"+Sparkles), `smart-pick-widget`("AI 추천: 슬슬 필요하지 않으세요?"), `BudgetPredictionWidget`("AI 인사이트"), `ai-insight-card`.
- 분석: `analytics-dashboard`(Sparkles), `command-palette`(Sparkles).
- 견적/비교: `ai-quote-parse-modal`, `compare-analysis-drawer`, `ai/suggestion-panel`, `ai/activity-timeline`.
- 제품/랜딩: `personalized-recommendations`, `_components/ai-section`, `beta-banner-section`.
- ⚠️ **lib/ai/* 엔진(GPT 파싱·governance) = 백엔드, 노출 0 → 보존**(기능 유지). §0 대상 = UI 라벨·✨ 데코만.

**Chosen Source of Truth:** 기존 freeze 정책(public-ai-messaging) + 결정형 라벨. lib/ai 기능은 보존.

**Conflicts (Phase 0 게이트):** AI 표기 **전면 제거** vs **기능 표기 일부 허용**(예 "AI 자동 인식"은 기능 설명이라 허용?). 호영님 정책 결정 필요.

**Environment:** 코드 편집·grep 가능 / tsc·test = Claude Code.

## 1. Priority Fit
- [x] P1 런칭 게이트(외부 공개 전 클리어). G-3 완료 → §0 → G-2.

## 2. Work Type
- [x] Design Consistency [x] 정책 적용(AI 메시징 freeze) [x] 다중 surface 횡단
- 신규 AI/chatbot UI 0(추가 금지), 생성형 NL 미노출.

## 3. Overview

**Feature:** 사용자 노출 AI 마케팅 톤(✨ 데코 + "AI 판단/추천/리포트/인사이트" 라벨)을 **결정형·기능 라벨**로 전환. AI 기능 자체는 유지(숨김 아님), 판단 주체를 AI로 표기하는 마케팅 톤만 절제. 출처·감사 없는 생성형 NL 미노출.

**Success Criteria:**
- [ ] UI에서 "AI 판단/추천" 류 판단 주체 표기 0 (기능 라벨로 전환).
- [ ] ✨ 데코 아이콘이 상태/기능 의미 없는 곳에서 0.
- [ ] "AI 리포트 생성"→"리포트 생성", "AI 추천"→"재주문 후보"(규칙 근거) 등 결정형.
- [ ] 신규 AI/chatbot surface 0. 생성형 NL(출처·감사로그 없는) 미노출.
- [ ] lib/ai 백엔드 기능 보존(회귀 0).

**Out of Scope (⚠️):**
- [ ] lib/ai 엔진 로직 변경(백엔드 기능 유지).
- [ ] G-2 영문 라벨(별도 batch).
- [ ] D-9 운영 브리핑 재설계(§11.367 별도, 단 생성형 금지 정합).

**User-Facing Outcome:** 운영 OS의 절제된 결정형 톤 — "AI가 판단"이 아니라 "규칙·데이터 기반 표시".

## 4. Product Constraints
- Must Preserve: [ ] lib/ai 기능 [ ] 기존 freeze 정책 [ ] 출처·감사 투명
- Must Not: [ ] 신규 AI/chatbot UI [ ] 생성형 NL(출처 없는) [ ] AI 판단 주체 표기 [ ] ✨ 무의미 데코
- **Canonical Truth Boundary:** AI 기능(lib/ai) 유지, UI 표기만 결정형. 데이터 출처 표기 투명.

## 5. Architecture
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| UI 라벨만 전환, lib/ai 보존 | 기능 숨김 아님, 마케팅 톤만 절제 | 라벨↔엔진 매핑 확인 필요 |
| 기존 freeze 정책 재사용 | 정책 일관성 | freeze 미적용 잔존 식별 |
| ✨ → 기능 아이콘 or 제거 | 데코 색면 0(§11.364 D-2 정합) | 위젯별 판단 |

**Touched (위젯군):** dashboard(ai-insight-dialog·smart-pick·BudgetPrediction·ai-insight-card·analytics·command-palette·work-queue), 견적/비교(ai-quote-parse·compare-analysis·suggestion-panel), 제품/랜딩(personalized-recommendations·ai-section·beta-banner).

## 6. Test Strategy
- sentinel: UI "AI 판단/추천" 라벨 0 + ✨ 무의미 데코 0 + 결정형 라벨 존재 + lib/ai import 보존(기능 회귀 0).
- ⚠️ 실행 = Claude Code.

## 7. Phases

### Phase 0: §0 정책 정의 + UI 위반 전수 (게이트)
- [ ] 기존 freeze 정책(public-ai-messaging-freeze·ai-implementation-freeze) 정독 → 적용 기준 확정.
- [ ] **정책 결정(호영님)**: AI 표기 전면 제거 vs 기능 설명("자동 인식" 등) 일부 허용.
- [ ] UI 노출 위반 전수(라벨·✨) vs 백엔드 lib/ai(보존) 분리 목록.
- ✋ Gate: 정책 확정, 보존/전환 경계 확정. **Rollback:** planning-only.

### Phase 1: 대시보드 운영 위젯 (최다 노출)
- [ ] ai-insight-dialog "AI 리포트 생성"→"리포트 생성"(Sparkles 제거/기능 아이콘), smart-pick "AI 추천"→재주문 후보(규칙 근거), BudgetPrediction "AI 인사이트"→예산 추이, ai-insight-card 결정형.
- [ ] sentinel: 대시보드 AI 마케팅 라벨 0.
- ✋ Gate: 기능 보존(dialog 동작), 결정형 라벨, ✨ 무의미 0. **Rollback:** 위젯별.

### Phase 2: 분석 + command-palette
- [ ] analytics-dashboard·command-palette Sparkles 데코 정리. AI 라벨 결정형.
- ✋ Gate: 데코 0, 기능 보존.

### Phase 3: 견적/비교 (AI 기능 표기)
- [ ] ai-quote-parse-modal·compare-analysis·suggestion-panel — AI 기능(GPT 파싱) 유지하되 라벨 결정형(예 "견적 자동 인식"·출처 표기). 생성형 결과 = 출처·감사 투명.
- ✋ Gate: 기능 보존, 판단 주체 표기 절제, 출처 투명.

### Phase 4: 제품/랜딩
- [ ] personalized-recommendations·ai-section·beta-banner — 마케팅 AI 톤 절제(랜딩은 제품 설명이라 정책 경계 Phase 0 확정값 적용).
- ✋ Gate: 정책 정합.

### Phase 5: Smoke / Rollback
- [ ] Claude Code tsc/lint/test/build → push → Chrome: AI 판단 라벨 0, ✨ 무의미 0, 기능 정상.

## 9. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| 라벨 전환이 AI 기능 끊음 | Med | High | lib/ai import 보존 sentinel, 기능 동작 검증 |
| 랜딩 AI 마케팅 vs 운영 OS 톤 경계 | Med | Med | Phase 0 정책 확정값 적용 |
| 102파일 과제거(백엔드 변경) | Med | High | UI만, lib/ai 보존 명시 |

## 10. Rollback
- 위젯군별(Phase 1~4) 독립 revert.

## 11. Progress
- Overall 35% · Current: Phase 1 완료 (대시보드 운영 위젯 5종) · Next: Phase 2 (분석 deep) → Phase 3 (견적/비교)
- Checklist: [x] P0 [x] P1 [ ] P2 [ ] P3 [ ] P4 [ ] P5

**Phase 0 결론:** §0 = 기존 `public-ai-messaging-freeze`(Step 6) 운영 화면 확장 적용. 기준=operator review ladder + forbidden claim + 결정형. AI 기능(lib/ai) 보존, UI 마케팅 톤만 절제. 랜딩/세일즈=freeze 완료(보존).

**Phase 1 완료 (대시보드 위젯 5종):**
- ai-insight-dialog(운영 리포트·조치 후보), smart-pick(재주문 검토 권장·의인화 제거), analytics(데이터 분석 요약), command-palette(자연어 검색), BudgetPrediction(주석). ✨ Sparkles 전부 기능 아이콘/제거, gradient 데코 절제.
- 분석 API·NL 검색 기능 보존. sentinel `ai-policy-tone-down-368-dashboard`(전 항목 grep 정합).

## 12. Notes
- [2026-06-04] §0 = UI 노출 AI 마케팅 톤(✨+"AI 판단/추천") 결정형 전환. lib/ai 백엔드 기능 보존(숨김 아님). 기존 freeze 정책 위 적용.
- §11.364 D-2(✨ 데코 제거)와 정합. D-9(§11.367) 생성형 금지와 연결.
- Phase 0 게이트 = AI 표기 전면 제거 vs 기능 설명 허용 = 호영님 정책 결정.
