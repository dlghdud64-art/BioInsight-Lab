# COMMIT — §11.360: 권장 액션 카드 severity-색상 매핑

```
fix(inventory) §11.360 #priority-card-severity-bg — 우선 처리 큐 카드 배경을 severity 기반(배지와 동일 팔레트)으로 분기 (긴급도 시각 위계 정합)
```

## 무엇 (§11.360 — P-정합, UI state 외부영향 0)
- Phase 0 확정: `priority-action-queue.tsx` 의 `RISK_CONFIG.bg`(severity 팔레트)는 **배지에만** 적용. **카드 행 배경은 중립 단일 하드코딩**(`hover:bg-slate-50/80`) → severity 미분기 → 긴급 카드가 배지(red)와 위계 충돌, 긴급도 과소평가.

## Fix
- `RISK_CONFIG` 에 `cardBg` 추가(severity→카드 배경 매핑, 하드코딩 단일색 제거):
  - critical `border-l-2 border-l-red-400 bg-red-50/40`
  - high `border-l-2 border-l-yellow-400 bg-yellow-50/40` (**§11.302 amber 금지 → yellow**)
  - medium `border-l-2 border-l-blue-300 bg-blue-50/30`
  - low `border-l-2 border-l-slate-200`(중립)
- 카드 행 className 을 `riskCfg.cardBg` 로 교체.
- 설계: 배경은 약채도(50/40) + **좌측 보더 + 텍스트/아이콘**으로 강조(카드 전체 강채도는 과함). 배지(강)와 카드(약)가 **동일 severity 팔레트 공유** → 색 언어 일원화.

## 검증 (vitest)
- `priority-queue-severity-card-360.test.ts` → **3/3** (cardBg 4 severity 분기 / §11.302 amber 미사용 / 카드 적용·단일 하드코딩 제거).

## migration
- **없음.** UI className만, 외부영향 0.

## Out of Scope
- 모바일 동등 큐(있으면 동형 적용 후속). severity enum 의 데이터 소스(item.risk)는 기존대로 — 매핑만 정합.

## Rollback
- RISK_CONFIG.cardBg 제거 + 카드 className 원복. 독립.
```
footer 없음
```
