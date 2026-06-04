# COMMIT — §11.368 §0 Phase 2/3: 견적·비교 + AI 데코 위젯 톤다운

```
refactor(quotes,compare,ai) §11.368 §0 #ai-tone-down-quote-compare — 견적/비교 AI 판단 라벨 → 결정형, ✨ Sparkles 데코 8파일 제거 (AI 기능 보존, operator review 정합)
```

## 무엇 (§11.368 §0 Phase 2/3 — 호영님 런칭 게이트)
- 견적/비교/AI 위젯의 "AI 판단/제안/초안" 라벨 + ✨ Sparkles 데코가 freeze 정책(operator review·결정형) 미적용.

## Fix
- **compare-analysis-drawer**: "AI 판단 요약"→**비교 분석 요약**, "권장 판단"→**권장 조치**(operator review), "AI 분석 실행"→**비교 분석 실행**, toast "AI 분석 완료/실패"→비교 분석, "추천 액션"→**조치 후보**. Sparkles 4 + import 제거. **L1168 "AI 분석은…참고 자료…담당자 확인"=§0 모범(출처 투명+operator review) 보존.** 분석 API 기능 유지.
- **suggestion-panel**: VARIANT label "AI 제안/판단/초안"→**소싱 제안/비교 분석/요청 초안**, Sparkles 제거.
- **ai-quote-parse-modal**: "AI 견적서 파싱"→**견적서 자동 인식**, Sparkles→Loader2(loading)·제거, import 중복 정리.
- **데코 3파일**: activity-timeline(✨→FileText), ai-insight-card(✨→Info ×2), personalized-recommendations(✨→Zap ×2). import 미사용 0.

## canonical truth / 정책
- AI 기능(비교 분석·견적 파싱·추천) 보존, 출처 투명 유지. "AI 판단" 주체 표기·✨ 데코만 절제.

## 검증
- sentinel `ai-policy-tone-down-368-quote-compare`: 8파일 <Sparkles·import 0 + 라벨 결정형(비교 분석 요약·권장 조치·소싱 제안·견적서 자동 인식) + 회귀(참고 자료 문구 보존·Loader2 중복 0). ⚠️ vitest = Claude Code.
- 8파일 실코드 Sparkles 0, 대체 아이콘 import 단일 확인.

## 수정 이력 (내 누락)
- ai-quote-parse: Loader2 import 추가 시 기존(L17) 중복 → 즉시 정정(L18 제거). import 추가 전 기존 확인 강화.

## Out of Scope
- Phase 4 제품/랜딩(ai-section freeze 정렬 확인). lib/ai 백엔드 보존.

## Rollback
- 8파일 + sentinel revert. 독립.
```
footer 없음
```
