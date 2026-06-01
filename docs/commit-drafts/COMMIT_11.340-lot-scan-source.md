feat(inventory): §11.340 #lot-scan-source — Lot/유효기한 라벨 스캔 출처 배지 (호영님 P1, 2026-06-01)

호영님 P1 §11.340 (GREEN) — Lot.No GMP 추적성. 진단 결과 라벨 스캔 Lot 파싱은
이미 구현 → 유일 gap "출처 표시"(스캔 확인 vs 수기) 보강. 웹+모바일.

배경 / GMP:
- Lot.No = QC 일탈·리콜·CoA·유효기한 추적 키. 거래명세서엔 Lot 없어 수기 의존이 약한 고리.
- 실물 라벨 = Lot 1차 원천. §11.326 라벨 스캔 활용.

Truth Reconciliation (진단) — 핵심 기능 이미 구현:
- label-parser.ts:12-13 LabelParseResult.lotNo/expirationDate + LOT_PATTERNS/EXPIRY 패턴 존재.
- 웹 LabelScannerModal:286-287 mapScanToForm 이 lotNo/expirationDate 폼 자동채움.
- 모바일 scan.tsx:93-94 동일 매핑.
- review step 폼 편집 가능 = OCR 자동확정 아님(확인 후 저장) + 수기 fallback(input 수정).
- → 5-1(파싱)/5-3(fallback)/6(확인저장) 이미 충족. 유일 gap = 5-2 출처 표시.
  호영님 "수기 의존" 체감 = 거래명세서(Smart) 경로 또는 출처 미표시 때문.

Fix (file 별):

- src/components/inventory/LabelScannerModal.tsx (웹):
  · lotScanFilled/expiryScanFilled/lotDirty/expiryDirty state.
  · mapScanToForm 호출 2곳에서 setLotScanFilled(Boolean(parsed.lotNo)) 등 출처 기록 + dirty 초기화.
  · updateField: lotNumber/expirationDate 수정 시 dirty=true(수기 출처 전환).
  · fieldSourceBadge 헬퍼: 스캔 채움 & 미수정 → "라벨 스캔 확인"(emerald), 그 외 값 있으면 "수기 입력"(slate).
  · Lot 번호/유효기간 Label 옆 배지(data-testid lot/expiry-source-badge). reset 시 출처 state 초기화.

- apps/mobile/app/scan.tsx (모바일):
  · 동일 state + mapLabelToForm 직후 출처 기록 + updateLabelField dirty + fieldSource 헬퍼.
  · Lot/유효기간 라벨 옆 배지(NativeWind Text).

canonical truth / 제약 (§11.335):
- Lot = 실물 라벨(스캔) 또는 수기만. 시스템 생성/추측 0(환각 방지).
- 출처 구분(검증값 vs 수기) = §11.335 데이터 출처 정책 Lot 버전.
- OCR 자동확정 금지(review 확인 후 저장) 보존. 폼 자동채움/저장 회귀 0.

production effect:
- 라벨 스캔 입고 시 Lot/유효기한이 스캔값이면 "라벨 스캔 확인" 배지(검증 출처 명시).
- 사용자가 수정하거나 수기 입력하면 "수기 입력" 배지로 전환 → 추적성에서 출처 구분.

검증 (sandbox):
- sentinel lot-scan-source-badge-340.test.ts 14/14 PASS(파서 보존 + 웹/모바일 state·기록·dirty·배지 + 폼채움 회귀).
- 2파일 brace/paren 무결. truncation 0(웹 +48 / 모바일 +34 = 추가분 일치).
- 빌드 = 호영님 env.

Out of Scope:
- 거래명세서(Smart 모달) 경로 Lot 입력(라벨 스캔 경로는 충족, Smart 는 §11.326 별도).
- Lot 추적 대시보드(제품→Lot→입고 이력은 기존 LOT 정보 위젯).
- 유효기한 형식 강검증(현행 date input).

Rollback path: git revert <SHA>
- 출처 state/배지/헬퍼 제거(폼 자동채움 등 핵심 기능은 기존 — 영향 0).

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/components/inventory/LabelScannerModal.tsx `
  apps/mobile/app/scan.tsx `
  apps/web/src/__tests__/regression/lot-scan-source-badge-340.test.ts `
  docs/commit-drafts/COMMIT_11.340-lot-scan-source.md
git commit -F docs/commit-drafts/COMMIT_11.340-lot-scan-source.md
git push origin main
```

## Production smoke (호영님 env)
1. 실물 라벨 스캔 → Lot/유효기한 자동 채움 + "라벨 스캔 확인" 배지.
2. Lot 수정 → 배지 "수기 입력"으로 전환.
3. 라벨에 Lot 없는 경우 → 수기 입력 → "수기 입력" 배지.
4. 입고 저장 → Lot 추적 정상.
5. 모바일 동일 동작.

## Next
- 거래명세서 경로 Lot 보강(필요 시 §11.326 Smart 모달 별도).
