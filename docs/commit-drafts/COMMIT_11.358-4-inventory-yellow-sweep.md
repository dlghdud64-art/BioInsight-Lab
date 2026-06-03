# COMMIT — §11.358-4: 모바일 재고 amber/orange → yellow sweep (§11.302)

```
fix(mobile) §11.358-4 #inventory-yellow-sweep — 재고 화면 amber/orange 토큰을 §11.302 yellow 로 정합 (주의/저재고 신호 일관성)
```

## 무엇 (§11.358 Phase 0 #4 — 무해 색상 sweep)
- CLAUDE.md §11.302 신호등: amber/orange 금지 → yellow. 모바일 재고 화면의 amber/orange 잔재 8곳 정합.

## Fix (file별, className 토큰만)
- `app/inventory/[id].tsx` (4): lot 임박 `border-amber-300 bg-amber-50` → yellow-300/yellow-50, `text-amber-600`→`text-yellow-700`(대비), CAUTION `bg-amber-50`→yellow-50.
- `app/inventory/inspection.tsx` (2): `bg-amber-50`/`border-amber-300` → yellow.
- `app/inventory/lot-dispatch.tsx` (1): `text-amber-600`→`text-yellow-700`(전량 출고 경고).
- `app/(tabs)/inventory.tsx` (1): LOW_STOCK `border-orange-300`→`border-yellow-300`.

## 매핑 (§11.302 정합)
- amber-50→yellow-50, amber-300→yellow-300, amber-600→yellow-700(텍스트 대비), orange-300→yellow-300.
- 의미 보존: 주의/저재고=yellow, **결품/만료=red 유지**(미변경). iconColor.warning 테마 토큰은 별개(미변경).

## 검증
- 모바일 test 스크립트 없음 → **grep**: 재고 파일 amber/orange 잔재 **0** 확인. 런타임 RN 렌더는 Expo.

## migration
- **없음.**

## Out of Scope
- 비-재고 화면 amber/orange(있다면 별도 §11.302 sweep). §11.358-1(견적 fetch, env/ops).

## Rollback
- 토큰 8곳 yellow→amber/orange revert. className-only, 독립.
```
footer 없음
```
