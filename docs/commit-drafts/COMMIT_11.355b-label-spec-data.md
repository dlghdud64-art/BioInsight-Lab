# COMMIT — §11.355-B(규격 데이터화) 폼텍/DYMO 실측 정정 + 커스텀 입력 + 하드코딩 제거

```
fix(inventory) §11.355-B #label-spec-data — 라벨 규격 하드코딩 제거(widthMm/heightMm canonical) + 폼텍 실측 정정 + 커스텀 규격 입력 (호영님: 규격 실물 불일치)
```

## 호영님 보고 통증
- "규격이 실물/실사용과 안 맞는다" (실사용 = 폼텍 3104).

## 진단 (실규격 대조, 2026-06 formtec/retailer)
- 코드 프리셋 치수 중 **3개가 실물과 불일치**: 3101(63.5×38.1/21칸→실제 38.1×19.2/60칸), 3102(99.1×38.1/14칸→실제 47×26.9/40칸), 3104(99.1×67.7/8칸→**실제 62.7×30.1/27칸**, CEO 실사용). 3100(38.1×21.2/65칸)·DYMO 11354(57×32)만 정확.
- 인쇄 width 가 데이터가 아니라 `activeSpec?.id.includes("3104") ? "90mm" : ...` **문자열 매칭 하드코딩** → 규격 추가/수정 시 깨짐.

## Fix (file 별, 스키마/DB 0)
- `components/inventory/LabelPrintModal.tsx`:
  - `LabelSpec` 에 **`widthMm`/`heightMm`(canonical 치수)** 추가, `size` 표시문자열 제거 → `specSizeLabel()` 로 dims에서 파생(단일 출처).
  - 폼텍 실측 정정: 3101 38.1×19.2/60칸, 3102 47×26.9/40칸, 3104 62.7×30.1/27칸.
  - **커스텀 규격(직접 입력)** 프리셋 추가 — `custom: true`, 선택 시 가로×세로 mm 입력(`customW`/`customH`). 프리셋이 실물과 달라도 사용자가 실측 지정.
  - 인쇄 `.label` width/min-height + 미리보기 minHeight 를 `labelWidthMm`/`labelHeightMm`(커스텀이면 입력값, 아니면 프리셋) 파생으로 교체 — **`.includes()` 하드코딩 제거.**
  - `Input` import 추가.
- 신규 `__tests__/regression/label-spec-data-355b2.test.ts`: sentinel(6).

## 검증 (vitest)
- label-spec-data-355b2 (6) + label-print-real-qr-355b (7, 회귀 0) + scan-page-deduct-cta-355d (6) = **19 passed**. esbuild transform OK.

## ⚠️ 작업 중 (truncation 버그 반복)
- 멀티편집 중 파일 끝이 멀티바이트 경계에서 3회 truncate(미리보기 span / export 래퍼). bash로 head + HEAD/정본 꼬리 복원, JSX 봉합(`{includeBarcode && (` 여는 줄) 수리 후 transform+vitest 재검증. **푸시 전 호영님 환경에서 파일 끝(LabelPrintContent export) + 미리보기 블록 정상 확인 권장.**

## 데이터 출처 (실측 대조)
- 폼텍 LS-3100 65칸 38.1×21.2 / LS-3101 60칸 38.1×19.2 / LS-3102 40칸 47×26.9 / LS-3104 27칸 62.7×30.1 — 공식/유통 리스팅 교차 확인. DYMO 11354 57×32(다목적, 기존 유지). 불확실 시 커스텀 입력이 안전망.

## Canonical truth 보존
- DB/상태 0. 규격은 데이터(프리셋+커스텀). 실 QR(§11.355-B 1차)·토글·인쇄 트리거 보존.

## Out of Scope (후속)
- **연구소별 기본 규격 영속**(서버 settings/org) — 현재는 `recommended`(3100) + 커스텀. 영속은 별 슬라이스.
- (별 트랙) §11.353 발주 관리 de-mock / §11.354 구매 리포트.

## Rollback path
- LabelSpec 인터페이스/배열 + 치수 파생 + 커스텀 UI + Input import revert. 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
