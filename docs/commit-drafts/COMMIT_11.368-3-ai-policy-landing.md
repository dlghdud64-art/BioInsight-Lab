# COMMIT — §11.368 §0 Phase 4: 제품/랜딩 AI 톤 (ai-section 보존 + beta-banner ✨ 제거)

```
refactor(landing) §11.368 §0 #ai-tone-down-landing — beta-banner ✨ Sparkles→Info, ai-section "비교 판단"→"비교 분석"(compare-analysis 일관). ai-section freeze 정렬(operator review)은 보존
```

## 무엇 (§11.368 §0 Phase 4 — 호영님 런칭 게이트)
- **ai-section = freeze 정렬 완료** → 보존: L14 "AI가 다음 단계를 준비하고, 사용자가 승인하면 시스템이 실행" = operator review 모범, forbidden claim 0, Sparkles 0. (과변경 회피 — §11.364 패턴)
- beta-banner = ✨ Sparkles 2곳(마케팅 데코) 잔존.

## Fix
- **beta-banner-section**: Sparkles 2곳 + import → **Info**(베타 안내 정보 아이콘).
- **ai-section**: "비교 판단 요약" → **비교 분석 요약**(compare-analysis §11.368-2와 일관). 나머지 freeze 정렬 보존.

## canonical truth / 정책
- ai-section의 operator review 문법(준비→승인→실행) 보존 = §0 모범. beta-banner ✨ 데코만 절제.

## 검증
- sentinel `ai-policy-tone-down-368-landing`: beta-banner Sparkles 0·Info / ai-section operator review 보존·forbidden 0·비교 분석 통일·Sparkles 0. ⚠️ vitest = Claude Code.

## Out of Scope
- ai-section 본문 freeze 정렬분 = 보존(변경 0). lib/ai 백엔드 보존.

## Rollback
- beta-banner/ai-section 2파일 + sentinel revert.
```
footer 없음
```
