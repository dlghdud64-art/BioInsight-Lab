# COMMIT — §11.364 Phase 3 (D-6): 랜딩 reveal 트리거 보장 (FAB 무작업)

```
fix(landing) §11.364 D-6c #reveal-trigger — 랜딩 2번째 섹션 reveal 가 margin:"-60px" 트리거 지연으로 흐릿 멈추던 것을 amount 기반(15% 진입)으로 보장
```

## 무엇 (§11.364 D-6 — 호영님 P1, 2026-06-04, 재진단 우선)
- **D-6b FAB**: 재진단 결과 **무작업 종결**. floating-entry 가 이미 `bottom-[72px]`(BottomNav 56px+16px 마진, §11.252c) + `bodyScrollLocked` 시 hidden(§11.272d) → 탭바 코너 충돌 이미 해결. 실측 겹침 재현 근거 없음 → gold-plating 회피.
  - (Sparkles 아이콘 AI 톤은 §0 AI 정책 batch 소관 — D-6b "겹침/가림" 범위 아님.)
- **D-6c 랜딩 리빌**: 실재 결함. 랜딩 = Hero → **FinalCTASection(2번째, 재고 운영 목업)** → Footer. Reveal wrapper가 `initial opacity:0` + `viewport margin:"-60px"`(트리거 60px 지연) → 페이지 하단 섹션에서 요소가 화면에 보여도 트리거 라인에 안 닿아 **opacity:0 영구 잔존 = 흐릿 멈춤**(호영님 관찰).

## Fix (`final-cta-section.tsx` Reveal wrapper)
- `viewport={{ once: true, margin: "-60px" }}` → `viewport={{ once: true, amount: 0.15 }}`.
- amount 0.15 = 요소 15% 진입 시 발화 → margin 지연 제거, 트리거 보장. `once: true`(재발화 0)·`whileInView`·initial 보존.

## canonical truth
- 랜딩 표시 로직만. 데이터/제품 surface 무관.

## 검증
- sentinel `landing-reveal-trigger-364`: amount 0.15 + margin -60px 부재 + whileInView/once 보존 + 무효 prop 미혼입. ⚠️ vitest = Claude Code.
- 기존 sentinel 충돌 0(final-cta margin 강제 sentinel 없음).
- 배포 후 라이브: 랜딩 스크롤 시 2번째 섹션 흐릿 멈춤 0, 정상 페이드인.

## Out of Scope
- D-6b FAB(무작업). Sparkles 아이콘 = §0 AI 정책 batch. D-7(지출 IA)·D-8(품목 상세) = 별도 batch.

## Rollback
- viewport amount→margin 원복. 1줄, 독립.
```
footer 없음
```
