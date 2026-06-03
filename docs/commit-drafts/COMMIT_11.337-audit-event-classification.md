# COMMIT — §11.337 감사 추적 이벤트 분류 + 표시 정정

```
fix(audit) §11.337 #audit-event-classification — 출력/조회 이벤트 분류 정정 + raw key 라벨 치환 + 브레드크럼 한글 (호영님 P2, Decision B)
```

## 호영님 spec (Decision B)
- `quote_pdf_generate`가 "설정 변경" 배지로 오표시 → 출력 이벤트. "변경 내역 없음"이 모순처럼 보임.
- raw internal key 노출(quote_pdf_generate, QUOTE(cuid), User Token), 브레드크럼 "Audit"만 영문.
- **데이터 무결성(Part 11): 저장 AuditLog raw record 불변. 분류·라벨은 표시 매핑 레이어에서만 파생. backfill 금지.**

## 진단 정합 (§11.345-B 와)
- §11.345-B 는 write단(새 레코드 eventType=DATA_EXPORTED)만 수정 → 옛 레코드(SETTINGS_CHANGED)는 불변.
- 본 작업은 **표시단 action 키 매핑**으로 옛/새 레코드 모두 "조회·출력"으로 정확 분류(backfill 없이 모순 해소).

## Fix (file 별)
- `lib/audit/event-labels.ts`: `output` 중립 톤(slate) 추가 + `AUDIT_ACTION_MAP`(action → {reason 라벨, categoryLabel "조회·출력", tone}). quote_pdf_generate / po_pdf_generate 매핑. DB write 0(표시 전용).
- `app/dashboard/audit/page.tsx` adaptLog:
  - 배지 라벨/톤: `actionMeta` 있으면 categoryLabel/tone override(eventType 기반 "설정 변경" 대체).
  - 사유: `actionMeta.reason`("견적서 PDF 생성") 우선, metadata.reason 최우선.
  - 대상: metadata.quoteNumber/poNumber 있으면 "견적/발주 {번호}"(cuid 노출 최소화).
  - 인증: "User Token" → "사용자 토큰".
- `components/dashboard/Header.tsx`: 브레드크럼 segment 라벨 `audit` → "감사 추적".
- `app/dashboard/audit/page.tsx` (Phase 3 잔여 완료):
  - **대상 cuid 치환**: `ENTITY_TYPE_LABELS`(QUOTE→견적 등) + metadata 번호 우선. compact 뷰에서 raw cuid 제거(전체 entityId 는 행 상세 expand 에 보존). 옛 레코드(번호 부재)는 "견적" 라벨만.
  - **export one-primary**: 4 button(새로고침/간단인쇄/정형PDF/CSV) → [새로 고침 아이콘 분리] + [내보내기 단일 primary → Sheet(인쇄/PDF/CSV)]. 모바일 kebab 제거(데스크탑·모바일 단일 패턴).
- `__tests__/regression/audit-event-classification-337.test.ts`: sentinel(분류·라벨·불변·브레드크럼·대상라벨·export).

## Canonical truth 보존
- AuditLog raw record 무수정·무backfill. 분류/라벨/대상은 전부 표시 파생. 스키마 무변경.

## Production effect
- quote PDF 이벤트가 "조회·출력"(중립) 배지 + 사유 "견적서 PDF 생성" + 대상 견적번호로 표시. "변경 내역 없음"이 출력 이벤트라 정상임이 자연스러워짐.
- raw key/cuid/영문 인증 노출 제거. 브레드크럼 한글 통일.

## ⚠️ 배포 주의 — page.tsx 중첩
- `audit/page.tsx`는 **아직 미푸시된 §11.345 Part A(용어 정정+읽기단 UX)** 변경도 함께 들고 있음. 라이브가 아직 "감사 증적"인 이유.
- 권장: §11.345-A + §11.337 을 **audit-page 통합 커밋**으로 함께 푸시(둘 다 감사 페이지 표시). 분리 원하면 `git add -p`.
- 4개 파일: event-labels / audit page / Header / 테스트 (+ §11.345-A 파일들). push 전 `git status` 확인 + Vercel green.

## Out of Scope (다음 배치)
- export 액션 4개 one-primary 묶기(인쇄/PDF/CSV 메뉴화) — 큰 JSX 리팩토링이라 별도 안전 배치.
- IP 미수집 라우트 보강(§11.345-B 후속).

## Rollback path
- P2 실패: AUDIT_ACTION_MAP/output 톤 revert → 기존 eventType 라벨 복귀(raw record 무영향).
- P3 실패: adaptLog/Header hunk revert, 매핑 레이어 유지.

## 검증
- vitest·tsc 미설치 → 자동 **실행 불가**. 정적 검증 완료. 배포 후 quote PDF 행이 "조회·출력 / 견적서 PDF 생성 / 견적번호 / 사용자 토큰" 으로 뜨는지 Chrome 확인 예정.
```
footer 없음 (Co-Authored-By 미사용)
```
