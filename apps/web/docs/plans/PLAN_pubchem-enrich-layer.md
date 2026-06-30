# Implementation Plan: PubChem 보강 레이어 (Tier 2 역매칭)

- **Status:** ✅ Complete (Phase 0–4, 라이브 smoke GREEN)
- **Started:** 2026-06-30
- **Last Updated:** 2026-06-30
- **Estimated Completion:** 2026-06-30 (완료)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 ① 체크박스 체크 ② quality gate 실행 ③ 전 항목 통과 확인
④ Last Updated 갱신 ⑤ Notes 기록 ⑥ 그 다음에만 다음 phase.
⛔ quality gate 실패·source-of-truth 충돌·dead button/no-op/fake success 상태로 진행 금지.

---

## 0. Truth Reconciliation
- **Latest Truth Source:** `docs/plans/SCOPING_manufacturer-catalog-free-source.md`(2026-06-30) — 제조사 Cat# free 소스 0,
  무료는 substance-level(PubChem 무키·무료). 호영님 "권장 갈게" = Tier 2 PubChem.
- **Secondary References:** RUNBOOK_catalog-ingest-activation.md(조달청, 별 트랙), §scan-manual-path(미매칭 calm).
- **Conflicts Found:** 없음. 조달청 `ProcurementCatalogRef`·삭제된 casNumber DB매칭과 무관한 신규 경로.
- **Chosen Source of Truth:** db.product = canonical. PubChem 보강 = 외부 suggestion/projection(적용 전 truth 미접촉).
- **Environment Reality Check:**
  - [ ] repo/branch 확인
  - [ ] vitest/tsc/build 실행 = operator-shell (sandbox는 static-verify)
  - [ ] PubChem 외부 fetch는 prod 서버(Vercel)에서 server-to-server (키 불필요)

## 1. Priority Fit
- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release (호영님 지시 보강 기능)
- [ ] P2 / Deferred

**이유:** 스캔 파이프라인은 §scan-casnumber-500-fix로 이미 정상(200). 이건 미매칭/부분인식 케이스의
**보강**(없어도 동작). 따라서 release blocker 아님, 호영님 directed post-release feature.

## 2. Work Type
- [x] Feature
- (서버 PubChem proxy lib + GET 라우트 + 승인형 UI 보강 행)

## 3. Overview
**Feature Description:** scan 후 OCR이 CAS(또는 제품명)를 읽었으나 db.product 미매칭일 때, **PubChem PUG REST**
(무키·무료)로 **정규화 제품명·동의어·분자식**을 조회해 **승인형 보강 제안**으로 노출. 적용 시 폼 채움.
db.product = canonical 무접촉. Cat#는 못 채움(free 소스 없음 — 수동 유지).

**Success Criteria:**
- [x] CAS 있는 라벨 스캔 → 보강 행에 PubChem 정규화명/동의어 노출 + [적용]으로 제품명 채움. (라이브: CAS 67-56-1 → Methanol·CH4O·동의어 5, [제품명에 적용] → 제품명=Methanol)
- [x] PubChem 실패/무결과/브랜드키트 → 보강 없음, 스캔·§scan-manual-path 그대로(에러 0). (신규 품목 calm 배너 보존 확인)
- [x] scan-label 응답 속도 무영향(별도 비동기 엔드포인트). (scan-label 200 후 enrich GET 200 별도)
- [x] canonical(db.product) 무접촉 — 적용은 폼에만, 입고 완료 시 정상 inventory create. (적용=폼 필드만, DB write 0)

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] 벤더 Cat# 자동확정(free 소스 없음 — 수동 유지)
- [ ] db.product 자동 생성/덮어쓰기(승격 = 별 트랙)
- [ ] 조달청 ingest(별 트랙, env 선행)
- [ ] AI/chatbot UI 신규

**User-Facing Outcome:** CAS 읽힌 순수 시약은 제품명이 표준명으로 깔끔히 정규화 제안됨(적용형). 못 읽거나
브랜드 키트는 지금처럼 calm 수동.

## 4. Product Constraints
**Must Preserve:**
- [ ] same-canvas(스캔 리뷰 카드 내, 신규 페이지 0)
- [ ] canonical truth(db.product) 무접촉
- [ ] §scan-manual-path calm 경로

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] chatbot/assistant 재해석
- [ ] dead button / no-op / placeholder success (보강 있을 때만 [적용] 노출)
- [ ] preview가 truth 덮기 (적용 = 폼 입력일 뿐, 사용자 확인 후 commit)

**Canonical Truth Boundary:**
- Source of Truth: `db.product` (무변경)
- Derived Projection: PubChem 보강 응답(외부, 비영속, 제안)
- Snapshot/Preview: 보강 행 표시 + [적용] 미리보기
- Persistence Path: [적용] → formData → 사용자 입고 완료 → 기존 inventory create

**UI Surface Plan:**
- [x] Existing route section (LabelScannerModal 리뷰 카드, 신규 품목 안내 행 근처 calm 보강 행)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 별도 GET `/api/catalog/enrich?cas=` (scan-label 인라인 X) | Gemini OCR로 느린 scan-label에 PubChem latency·rate-limit 부담 미전가; progressive | 호출 1회 추가(클라 비동기) |
| 서버 PubChem proxy + TTL 캐시 | rate-limit(5/s) 대응·CORS 회피·키 0 | 캐시 구현 |
| 승인형 [적용] (자동 덮어쓰기 X) | canonical·honesty 보호 | 1탭 추가 |

**Dependencies:**
- Required Before Starting: 없음(키·env 불필요)
- External Packages: 없음(native fetch)
- Existing Touched: LabelScannerModal.tsx(리뷰 카드), 신규 `lib/catalog/pubchem-enrich.ts`, 신규 `app/api/catalog/enrich/route.ts`

**Integration Points:**
- GET `/api/catalog/enrich?cas=&name=` (auth 가드) → pubchemEnrich() → {canonicalName, synonyms[], molecularFormula} | null
- LabelScannerModal: scanResult 세팅 후 CAS 있으면 비동기 fetch → 보강 행 + [적용](updateField)

## 6. Global Test Strategy
- lib(pubchem-enrich): 유닛(mock fetch — CAS→CID→property 경로, 무결과 null, 타임아웃 graceful).
- route(/api/catalog/enrich): sentinel(readFileSync regex) — auth 가드·캐시·pubchemEnrich 호출·shape.
- UI(LabelScannerModal): sentinel — 보강 행(승인형 [적용], 보강 있을 때만), 로딩/빈/실패 상태, canonical 무접촉.
- 실행 권위: operator-shell(vitest/tsc/build). sandbox는 static-verify.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete
**🔴 RED:** PubChem PUG REST 계약 확정 — CAS→CID(`/rest/pug/compound/name/{cas}/cids/JSON` 또는 xref),
  CID→property(`/property/IUPACName,MolecularFormula,Title/JSON`) + synonyms(`/synonyms/JSON`). rate-limit(5/s,400/min).
**🟢 GREEN:** 통합점(LabelScannerModal scanResult 훅) + canonical 무접촉 확인.
**🔵 REFACTOR:** 스코프 최소화(CAS 우선, name fallback).
**✋ Gate:** 충돌 0, 계약 확정. **Rollback:** planning-only.

### Phase 1: Contract & Failing Tests
- Status: [x] Complete
**🔴 RED:** sentinel/유닛 RED — pubchem-enrich shape, /api/catalog/enrich 라우트, UI 보강 행.
**🟢 GREEN:** 최소 스캐폴딩(타입·빈 함수).
**✋ Gate:** RED 실재, 기존 GREEN 유지. **Rollback:** scaffolding revert.

### Phase 2: Core Logic (lib/catalog/pubchem-enrich.ts)
- Status: [x] Complete
**🔴 RED:** 유닛(mock fetch) — CAS→정규화명/동의어/분자식, 무결과 null, 타임아웃/에러 null.
**🟢 GREEN:** 서버 fetch + in-memory TTL 캐시(CAS 키) + AbortController 타임아웃 + graceful null.
**🔵 REFACTOR:** DRY, 캐시 단순화.
**✋ Gate:** 유닛 GREEN, overfetch/N+1 0, canonical 미접촉. **Rollback:** lib 제거.

### Phase 3: Route + UI Wiring
- Status: [x] Complete
**🔴 RED:** 통합 sentinel — 라우트(auth·enrich 호출), UI(보강 행·[적용]·상태).
**🟢 GREEN:** GET `/api/catalog/enrich`(auth 401 가드 + 캐시 + pubchemEnrich) + LabelScannerModal 비동기 호출 +
  승인형 보강 행([적용]=updateField("productName"/synonyms), 보강 있을 때만, 로딩/빈/실패 calm).
**🔵 REFACTOR:** same-canvas 유지, 중복 제거.
**✋ Gate:** dead button 0(보강 없으면 행 0), front-only success 0, 로딩/빈/실패 상태. **Rollback:** wiring revert.

### Phase 4: Rollout / Smoke / Rollback
- Status: [x] Complete (라이브 smoke GREEN, dpl_AuBjyK6 READY)
**🔴 RED:** rollout 실패모드(PubChem 다운·rate-limit·느림) + smoke path 정의.
**🟢 GREEN:** 라이브 — CAS 67-56-1 라벨 → PubChem methanol 보강 행 → [적용] → 제품명 정규화. 캐시·타임아웃 확인.
**🔵 REFACTOR:** 임시 계측 제거, notes.
**✋ Gate:** rollout 안전(PubChem 실패해도 스캔 정상), rollback 문서화. **Rollback:** enrich 호출 제거(2~3파일 revert), env-free.

## 8. Optional Addenda
- **C. API**: 신규 라우트는 경량 GET(캐시) — overfetch 0, 외부 1콜/캐시. scan-label 인라인 회피로 N+1·latency 0.

## 9. Risk Assessment
| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| PubChem rate-limit(5/s) | Med | Low | CAS 키 서버 캐시 + best-effort + 타임아웃 |
| PubChem latency | Med | Low | 별도 비동기 엔드포인트(scan-label 무영향) |
| 브랜드키트/무CAS → 무결과 | High | None | null → 보강 없음(정상, §scan-manual-path) |
| canonical 오염 | Low | High | 적용 전 truth 미접촉(suggestion only), 자동 덮어쓰기 0 |
| 외부 의존 다운 | Low | Low | graceful null, 스캔 200 유지 |

## 10. Rollback Strategy
- Phase 1 실패: scaffolding/test revert.
- Phase 2 실패: lib 제거.
- Phase 3 실패: 라우트+UI wiring revert.
- Phase 4 실패: enrich 클라 호출 제거(보강 비활성), 나머지 무해 잔존. env/flag 불필요.

## 11. Progress Tracking
- Overall: 100%
- Current phase: 완료 (Phase 4 라이브 smoke GREEN)
- Current blocker: 없음
- Next: 없음 (Cat# 역매칭은 별 트랙 — 조달청 Tier 1.5 / promotion-on-use)

**Phase Checklist:**
- [x] Phase 0
- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Phase 4

## 12. Notes & Learnings
- [2026-06-30] 전제: 제조사 Cat# free 소스 0(SCOPING). 본 레이어는 substance-level 보강이지 Cat# 자동완성 아님.
- 조달청(Tier 1.5)·승격(promotion-on-use)은 별 트랙.
- [2026-06-30] 커밋 `6f27a3b2`(4파일, +265) push·배포(dpl_AuBjyK6 READY). vitest 72/72 GREEN, pre-push build EXIT 0.
- [2026-06-30] 라이브 smoke(www.labaxis.co.kr, CAS 67-56-1 라벨): `GET /api/catalog/enrich?cas=67-56-1` → 200,
  파랑 "PubChem 표준 정보 — Methanol · CH4O" 행 + 동의어(methanol, methyl alcohol, wood alcohol, Methylol, Wood naphtha),
  [제품명에 적용] → 제품명=Methanol(폼만, DB write 0). 신규 품목 calm 배너·scan-label 200 별도 흐름 보존.
- [2026-06-30] 배포 타이밍 학습: 빌드 중(state≠READY) 페이지는 구 번들 서빙 → enrich useEffect 미존재(호출 0).
  Vercel `list_deployments` 로 dpl READY 확인 후 페이지 새로고침해야 새 번들 로드. (재스캔만으론 구 번들 유지)
