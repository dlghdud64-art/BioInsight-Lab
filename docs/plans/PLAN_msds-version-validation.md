# Implementation Plan: MSDS 버전 검증 레이어 + ③ 점검 준비 마법사

- **Status:** 🔄 In Progress (P0)
- **Started:** 2026-06-27
- **Last Updated:** 2026-06-27
- **Work Type:** Feature + Migration(prod) + Workflow wiring

**CRITICAL:** phase 완료마다 체크박스·quality gate·Last Updated·Notes 갱신. ⛔ no-op/fake success/dead button 금지. ⛔ migration은 §9.9 dry-run→한국어 보고→"진행"→deploy 게이트. ⛔ 휴리스틱을 "KOSHA 라이브 검증"으로 과대표기 금지(메타 기반 추정 라벨).

---

## 0. Truth Reconciliation
- **Latest truth:** `SDSDocument`(productId·docType·source·extractionStatus/Result). 버전·만료 컬럼 0. MSDS 업로드(`POST /api/products/[id]/sds`)는 파일+docType만 저장(상단정합 때 "버전·만료 메타 미저장" 정직 표기 잔존). 안전 페이지 `hasMsds` 불리언만.
- **핸드오프(MSDS 버전검증) §5 자인:** 9/19/72 = 목업 상수. 실연동 = OCR 파서 + KOSHA 공공 DB 대조 + 주기 재검증.
- **Chosen SoT:** SDSDocument(+신규 버전 컬럼) = canonical. 버전상태 분해 = 저장 메타 기반 **휴리스틱 파생**(라이브 KOSHA 대조 아님).
- **Conflict:** 핸드오프=라이브 KOSHA 전제 / repo엔 OCR·KOSHA 인프라 0 → 그 부분 OOS.

## 1. Priority Fit
**Post-release(파일럿).** P1 아님. 단 상단정합 때 남긴 "버전·만료 메타 미저장" honesty 갭을 실제로 닫음.

## 2. Work Type
[x] Feature · [x] Migration/Rollout(prod, additive) · [x] Workflow wiring(③ 마법사)

## 3. Overview
**기능:** MSDS 문서에 버전 메타(버전/개정일/만료일) 저장 + 버전상태(최신본/구버전 의심/출처 없음) canonical 휴리스틱 분류 + 버전 히스토리(supersede, soft-delete 금지) + ③ 3단계 점검 준비 마법사(종착=체크리스트/양식 export). 단일 카운트 소스(KPI·요약·마법사·패키지).

**Success Criteria:**
- [ ] SDSDocument 버전 메타 컬럼(docVersion·issuedAt·expiresAt·supersededAt) + prod migration(additive).
- [ ] MSDS 업로드 다이얼로그가 버전/개정일/만료일 저장(“미저장” 표기 해소).
- [ ] `classifyMsdsVersion(meta)` → current/stale/unknown. 단일 카운트 helper(KPI·요약·마법사 동일 소스).
- [ ] ③ 3단계 마법사(범위·담당/일정·패키지) same-canvas 모달, 종착=체크리스트/양식 export(실 산출물).
- [ ] 모든 CTA wired-or-disabled. 휴리스틱 "메타 기반 추정" 정직 라벨.

**Out of Scope (⚠️):**
- [ ] OCR 자동 추출(extractionStatus 그라운드워크만 존재) · KOSHA 라이브 DB 대조 · 주기적 재검증 알림.
- [ ] 점검 batch 생성(inventory-scoped, ① 제약과 동일) — 마법사 종착은 export로 한정.

**User-Facing:** MSDS 등록 시 버전/만료 입력→저장. 안전 화면이 "구버전 의심 N" 실 휴리스틱 표시(단일 소스). ③ 마법사로 점검 준비 체크리스트/양식 다운로드.

## 4. Product Constraints
**Must Preserve:** same-canvas(마법사=모달) · canonical(SDSDocument) · §11.348-B-1 실데이터 · workbench 구조.
**Must Not Introduce:** page-per-feature · no-op/fake success · 휴리스틱 과대표기 · CHECK constraint(`SDSDocument_coa_lot_check`) 파손.
**Canonical Truth Boundary:** SoT=SDSDocument(+버전 컬럼). Derived=versionStatus(쿼리 시 분류, 미저장). Persistence=POST /sds 확장. 단일 카운트=서버 집계 helper.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| versionStatus = 파생(컬럼 아님) | 단일 소스·stale 방지 | 인덱스 필터 불가(파일럿 규모 OK) |
| 버전 메타 = nullable 컬럼 4개 | additive·CHECK 무영향·data loss 0 | 기존 행 메타 null(출처 없음 분류) |
| supersededAt(self soft-state) | GMP 추적성(삭제 금지) | 교체 UI는 후속 |
| 마법사 종착=export | 실 산출물(generate-pdf 패턴 재사용) | batch 생성은 OOS |

**Touched:** `prisma/schema.prisma`(SDSDocument) · migration · `app/api/products/[id]/sds/route.ts`(POST 메타) · `lib/safety/*`(classifyMsdsVersion + 집계) · `app/dashboard/safety/page.tsx`(MSDS 다이얼로그 메타·요약/KPI 단일소스·③ 마법사) · export route(체크리스트).

## 6. Test Strategy
- 휴리스틱 분류 = unit(경계: issued>3년·expired·meta없음). 단일 카운트 = sentinel. POST /sds 메타 저장 = 정적 replay(sandbox)→operator vitest. migration = §9.9 dry-run+verify. 마법사 export = 산출물 생성 smoke.

## 7. Phases
### P0 — Truth/스키마 lock — [x] (2026-06-27)
신규 컬럼 확정: `docVersion String?`·`issuedAt DateTime?`·`expiresAt DateTime?`·`supersededAt DateTime?` (additive nullable, CHECK 무영향). versionStatus=파생. ③ 종착=export 확정(호영님). OCR/KOSHA=OOS 확정.

### P1 — 계약/sentinel(RED) — [ ]
classifyMsdsVersion 휴리스틱 계약 + 메타 persistence 계약 + 단일 카운트 소스 sentinel.
**✋ Gate:** 실패테스트 real · 기존 GREEN.

### P2 — Migration(prod §9.9 게이트) — [ ]
prisma 4컬럼 + migration.sql(ADD COLUMN ×4 nullable). dry-run(`migrate diff --from-url` read-only)→한국어 보고+project-ref echo→호영님 "진행"→`migrate deploy`(session URL)→verify diff empty.
**✋ Gate:** dry-run 보고 승인 · 파괴적 명령 0 · verify empty.

### P3 — Core 휴리스틱 — [ ]
`classifyMsdsVersion({issuedAt,expiresAt,docVersion,supersededAt})` → current/stale/unknown. 집계 helper(단일 소스).
**✋ Gate:** unit GREEN · 경계 검증.

### P4 — API/UI 배선 — [ ]
POST /sds 버전 메타 저장. MSDS 다이얼로그 메타 실 저장(“미저장” 표기 해소). 요약/KPI/③ step1 패널 = 실 휴리스틱 단일 소스. ③ 3단계 마법사(모달) + 종착 export(체크리스트/양식). wired-or-disabled.
**✋ Gate:** no-op 0 · 단일 카운트 · 휴리스틱 정직 라벨.

### P5 — Smoke/rollback — [ ]
업로드→메타 저장→분류 표시→마법사 export smoke. baseline·tsc·build.
**✋ Gate:** 회귀 0 · rollback 문서화.

## 8. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| prod migration | Low | High | additive nullable·§9.9 dry-run 게이트·verify |
| 휴리스틱 과대표기 | Med | Med | "메타 기반 추정" 라벨·KOSHA 미주장 |
| 단일 카운트 분산 | Med | Med | 집계 helper 단일 소스·sentinel |
| ③ export 산출물 미정형 | Low | Med | generate-pdf 패턴 재사용 |

## 9. Rollback
- P2 실패: migration 미deploy(드라이런 단계 중단) / 배포 후 문제 시 컬럼 nullable이라 코드 revert로 무영향.
- P4 실패: UI/route 배선 revert(컬럼 유지, 데이터 무손실).

## 10. Progress
- Overall: ~98% (구현 완료, operator 게이트 대기) · Current: ③ 마법사 코드완료 · Next: operator 게이트 → P5 smoke
- [x] P0 [x] P2(migration d4ebdcdb) [x] P3 [x] P1 [x] P4-core(메타 persistence) [x] P4-surface(단일 소스 노출) [x] ③ 3단계 마법사+export [ ] P5(operator smoke)
- **③ 마법사 배치(2026-06-27, migration 0):** AI 준비 패널 → 3단계 마법사 reorg(① 범위: MSDS/점검 토글 + 버전검증 패널 단일 소스 / ② 담당·일정: 담당자·마감 / ③ 패키지: 체크리스트 목록 + 예상). 종착 = **체크리스트 CSV export(실 Blob 다운로드, no-op 0)** — prepScope 범위 필터 canonical items, 대상 0이면 disabled. 가짜 "분석 실행(준비 중)"·"준비 중" notice 제거. 헤더/요약 CTA = openPrepWizard(step 리셋). sentinel `msds-prep-wizard.test.ts`. ⏳ operator: vitest·tsc·build.
- **P4-surface 배치(2026-06-27, migration 0):** /api/safety/products sdsDocuments 에 버전 메타 include → adapter classifyMsdsVersion 으로 `msdsVersionSummary`(current/stale/unknown, 단일 소스) 집계 → 안전 페이지가 캡처 → MSDS 점검 준비 패널에 "MSDS 버전 검증"(최신본/구버전 의심/출처 없음) 표기. "메타 기반 추정 · 라이브 대조 아님" 정직 라벨 + GMP 이력 보관 노트. sentinel `msds-version-surface.test.ts`. ⏳ operator: vitest·tsc·build.
- **잔여(선택):** ③ 패널을 범위/담당·일정/패키지 3단계 모달로 reorg + 체크리스트 CSV export. 현 패널은 이미 honest(대상목록+버전검증+disabled 사유)라 substantive 가치는 land됨.
- **P3+P4-core 배치(2026-06-27, migration 0):**
  - P3: `lib/safety/msds-version.ts` — classifyMsdsVersion(current/stale/unknown, 3년·만료·superseded 휴리스틱) + summarizeMsdsVersions(단일 카운트). 단위테스트 `msds-version-classify.test.ts`.
  - P4-core: `POST /sds` docVersion/issuedAt/expiresAt 파싱·SDSDocument 저장. MSDS 다이얼로그 메타 전송 + "미저장" 표기 해소 + 라벨 "개정·발행일" 정합. sentinel `msds-version-persistence.test.ts`.
  - 다음 배치(P4-wizard): /api/safety/products 메타 include + adapter 버전상태 surfacing + 요약/KPI/③ step1 단일 소스 + ③ 3단계 마법사 + 체크리스트 export.
  - ⏳ operator: vitest(신규 2 GREEN·baseline)·tsc·build.

## 11. Notes
- 2026-06-27: 생성. 호영님 승인(feasible 코어, ③ 종착=export). OCR/KOSHA/주기재검증=OOS. 9/19/72 = 휴리스틱 파생(목업 상수 아님). cowork 구현 → operator-shell 게이트(migration §9.9 포함).
