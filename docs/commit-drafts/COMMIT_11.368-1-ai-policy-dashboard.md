# COMMIT — §11.368 §0 Phase 1: 대시보드 운영 위젯 AI 톤다운

```
refactor(dashboard) §11.368 §0 #ai-tone-down-dashboard — 대시보드 위젯 AI 마케팅 톤(✨ Sparkles·"AI 판단/추천")을 결정형·기능 라벨로 (operator review 정합, AI 기능 보존)
```

## 무엇 (§11.368 §0 Phase 1 — 호영님 런칭 게이트)
- 기존 `public-ai-messaging-freeze`(Step 6 완료)가 퍼블릭/세일즈엔 적용됐으나 **운영 화면 위젯에 미적용** — ✨ + "AI 판단/추천/인사이트" 마케팅 톤 잔존.
- 정책: freeze 기준(capability ladder = …→operator review, forbidden claim, 결정형). **AI 기능 자체 보존(숨김 아님), 판단 주체 마케팅 톤만 절제.**

## Fix (5 위젯)
- **ai-insight-dialog**: ✨→FileText, gradient(indigo-purple)→bg-blue-600, "AI 리포트 생성"·"AI 운영 인사이트"→**운영 리포트**, "조치 권고"(AI 결정)→**조치 후보**(operator review), "Claude가 검토"→"분석", "AI 분석 실패"→"리포트 생성 실패". **분석 API 호출 보존.**
- **smart-pick-widget**: ✨→ShoppingCart, gradient→bg-white, "AI 추천: 슬슬 필요하지 않으세요?"→**재주문 검토 권장**, 의인화("챙겨봤어요"/"찾고 있어요")→결정형(소진 임박 규칙 근거). userName/userDisplayName 미사용 제거.
- **analytics-dashboard**: ✨→TrendingUp, gradient→bg-white, "스마트 인사이트"→**데이터 분석 요약**, "조언"→"요약".
- **command-palette**: ✨ 2곳→Search, "AI 자연어 분석"→**자연어 검색**(기능명; NL 검색 기능 유지).
- **BudgetPredictionWidget**: "AI 인사이트" 주석→"예산 경고 영역"(실 UI는 기능 경고, 라벨만).

## canonical truth / 정책
- AI 기능(분석·NL 검색) 보존, 출처 투명 유지. 마케팅 톤·✨ 데코·판단 주체 표기만 절제. freeze 정책 운영 화면 확장.

## 검증
- sentinel `ai-policy-tone-down-368-dashboard`: 4위젯 <Sparkles JSX·lucide import 0 + 라벨 결정형(운영 리포트/재주문 검토 권장/데이터 분석 요약/자연어 검색) + 회귀(분석 API 보존·gradient 데코 제거). ⚠️ vitest = Claude Code.
- 실코드 Sparkles/AI 마케팅 라벨 0 확인(주석은 §11.368 §0 작업 설명).

## Out of Scope (후속 phase)
- Phase 2 분석 deep / Phase 3 견적·비교(ai-quote-parse·compare-analysis·suggestion-panel) / Phase 4 제품·랜딩(ai-section). lib/ai 백엔드 엔진 보존.

## Rollback
- 위젯별 5파일 + sentinel revert. 독립.
```
footer 없음
```
