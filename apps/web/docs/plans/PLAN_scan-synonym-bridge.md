# Implementation Plan: 스캔 synonym 다리 (Tier 3 — PubChem 동의어로 약어↔풀네임 역매칭)

- **Status:** ⏳ Pending
- **Started:** 2026-06-30
- **Last Updated:** 2026-06-30

**CRITICAL INSTRUCTIONS**: phase 완료 후 ① 체크박스 ② quality gate ③ 전 항목 통과 ④ Last Updated ⑤ Notes ⑥ 다음 phase.
⛔ gate 실패·source 충돌·dead button/no-op/fake success 진행 금지.

---

## 0. Truth Reconciliation
- **Latest Truth:** §scan-reverse-match-v2(9331c0e6, 배포 READY)는 양방향·토큰 역매칭. 잔여 한계 명시 — **약어↔풀네임 비-부분문자열**("BCP"↔"Bromocresol Purple": 부분문자열·공유토큰 0)은 미매칭.
- **기존 인프라:** §pubchem-enrich(`/api/catalog/enrich`)가 스캔 시 **PubChem 동의어 세트**를 이미 server-side 조회(`pubchemEnrich().synonyms`). 모달이 이미 비동기 호출 중.
- **Chosen Source of Truth:** `db.product`=canonical. synonym 후보 = suggestion(승인형, 자동확정 X).
- **Priority Fit:** Post-release(호영님 directed — v2 한계 보정 Tier 3). P1 blocker 아님.
- **Env Reality:** PubChem 무키·무료(키 0). enrich route는 server-to-server.

## 1. Work Type
- [x] Feature(역매칭 Tier 3) + 기존 enrich 인프라 재사용

## 2. Overview
**Description:** reverse-match(name/token)가 0건일 때, **스캔 substance의 PubChem 동의어 세트로 기존 품목을 한 번 더 매칭**(약어↔풀네임 다리). enrich route가 이미 synonyms를 가지므로 거기서 product 매칭까지 수행 → `synonymCandidates` 반환. 모달은 reverse-match 0 + synonymCandidates 있을 때만 "표준명 기준 후보" 노출. scan-label **무변경**(속도 보존).

**Success Criteria:**
- [ ] reverse-match 0 + PubChem 동의어에 기존 품목명(또는 약어)이 포함되면 → "표준명 기준 후보" 노출.
- [ ] 승인형 [이 품목 선택] → 폼 채움(기존과 동일) → find-or-create 연결.
- [ ] 동의어에 매칭 없음/PubChem 무결과 → 후보 0(calm, 과대주장 X).
- [ ] scan-label 응답 속도 무영향(enrich 비동기 유지). canonical 무접촉, 자동확정 0.
- [ ] reverse-match 후보가 있으면 synonym 후보 **미노출**(중복 방지, reverse-match 우선).

**Out of Scope (⚠️ 금지):**
- [ ] scan-label 인라인 PubChem(속도 회귀 금지 — enrich 비동기 유지)
- [ ] synonym 자동확정 / matchedProduct 세팅
- [ ] 2자 이하 alias 매칭(FP — 최소 3자)
- [ ] PubChem에 약어 synonym이 없는 경우까지 해결(⚠️ 여전히 미매칭 — 정직 명시, 본 다리도 PubChem 동의어 커버리지에 의존)

**User-Facing Outcome:** "Bromocresol Purple"로 읽힌 라벨도, PubChem 동의어에 기존 등록 약어("BCP")가 있으면 표준명 기준 후보로 연결 가능.

## 3. Product Constraints
**Must Preserve:** same-canvas, canonical truth, §scan-manual-path calm, scan-label 속도, 승인형.
**Must Not Introduce:** scan-label 인라인 PubChem, 자동확정, dead button, FP(짧은 alias).
**Canonical Boundary:** SoT=db.product(무변경) / Projection=synonymCandidates(비영속) / Preview=후보행+[선택]=폼채움 / Persist=입고완료 find-or-create.

## 4. Architecture
| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| enrich route에서 synonym→product 매칭(scan-label 아님) | scan-label 속도 보존, synonyms 이미 거기 있음 | enrich route에 db 1쿼리 추가 |
| reverse-match 0일 때만 모달 노출 | 중복 방지, reverse-match 우선 | 모달 분기 1 |
| 신규 `rankSynonymCandidates`(reverse-match.ts) | norm/score 재사용, basis="synonym" | lib 함수 1 |
| 보수적 점수(상한 0.8) + alias≥3자 | synonym=간접 → FP 억제 | 일부 약어 누락 |

**Scoring(정규화 후, alias = canonicalName + synonyms, ≥3자):**
- eName === alias: 0.75 / eName ⊇ alias 또는 alias ⊇ eName: 0.55 + 0.1·길이비
- product id 별 best score, 상한 0.8(synonym=간접, high 거의 없음), 정렬·cap 3, basis="synonym".

**Integration:**
- `/api/catalog/enrich`: `pubchemEnrich` 후 `enrichment.synonyms` 있으면 `rankSynonymCandidates({synonyms,canonicalName},{db})` → 응답 `{ enrichment, synonymCandidates }`.
- 모달: enrich 상태에 `synonymCandidates` 추가. 렌더 — `!matchedProduct && reverse-match 0 && synonymCandidates>0` → "유사 품목 후보 (표준명 기준)" 행(기존 [이 품목 선택] 재사용). 신규 배너 게이트에 synonym 후보도 양보 추가(토큰 보존).

## 5. Test Strategy
- reverse-match: 유닛 — `rankSynonymCandidates`(동의어 exact/contains, alias≥3 가드, dedupe by id, 상한 0.8, 정렬·cap, basis synonym, 빈 synonyms→[]).
- enrich route: sentinel — db import·rankSynonymCandidates 호출·synonymCandidates 반환·enrichment 무결과 시 synonym 미산출.
- 모달: sentinel — synonym 후보 블록(reverse-match 0 한정), [이 품목 선택] 재사용, 배너 토큰 보존.
- 실행 권위: operator-shell.

## 6. Phases

### Phase 0: Truth & Contract Lock
- Status: [ ] Pending
**RED:** enrich synonyms 경로·모달 enrich 상태·db import 확정(완료분). synonym scoring 계약(alias≥3, 상한 0.8).
**GREEN:** 통합점(enrich route·모달 분기) + canonical 무접촉. **Gate:** 충돌 0. **Rollback:** planning-only.

### Phase 1: Failing Tests
- Status: [ ] Pending
**RED:** rankSynonymCandidates 유닛 + enrich/모달 sentinel RED. **GREEN:** 타입·스캐폴딩. **Gate:** RED 실재, 기존 GREEN. **Rollback:** test revert.

### Phase 2: Core lib (rankSynonymCandidates)
- Status: [ ] Pending
**RED:** 유닛(mock db). **GREEN:** alias 정규화·≥3자·exact/contains 점수·dedupe·상한 0.8·정렬·cap3·basis synonym.
**Gate:** 유닛 GREEN, FP 가드(짧은 alias), overfetch 0(take 50). **Rollback:** 함수 제거.

### Phase 3: Route + UI Wiring
- Status: [ ] Pending
**RED:** sentinel. **GREEN:** enrich route `{enrichment,synonymCandidates}` + 모달 synonym 후보 블록(reverse-match 0 한정, [이 품목 선택] 재사용, 신뢰도 배지) + 배너 게이트 양보.
**Gate:** dead button 0, 자동확정 0, scan-label 무변경. **Rollback:** route/UI wiring revert.

### Phase 4: Smoke / Rollback
- Status: [ ] Pending
**RED:** 실패모드(PubChem 동의어에 약어 없음·FP) + smoke. **GREEN:** 라이브 — ① "Bromocresol Purple" 라벨 → (PubChem 동의어에 등록 약어 있으면) 표준명 기준 후보 노출·선택, ② 동의어 무매칭 → calm(한계 명시), ③ reverse-match 후보 있을 땐 synonym 미노출.
**Gate:** scan-label 속도 무영향, calm 폴백, rollback 문서화. **Rollback:** enrich synonym 산출 + 모달 블록 제거.

## 7. Risk
| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| 짧은 alias FP | Med | Med | alias≥3자, 보수 점수(≤0.8), 승인형, reverse-match 0 한정 |
| PubChem 동의어 커버리지 한계 | High | Med | 정직 명시(약어 synonym 없으면 미매칭), calm 폴백 |
| enrich route 지연 | Low | Low | synonyms 이미 fetch됨, db 1쿼리(take 50) |
| 중복 후보(reverse-match+synonym) | Low | Low | reverse-match 0일 때만 synonym 노출 |

## 8. Rollback
- P1 test / P2 함수 제거 / P3 enrich·모달 wiring revert / P4 동일. env/flag 불필요.

## 9. Progress
- Overall: 0% / Phase 0 / blocker 없음 / Next: Phase 1.

**Checklist:** [ ] P0 [ ] P1 [ ] P2 [ ] P3 [ ] P4

## 10. Notes
- [2026-06-30] PubChem 동의어 인프라(§pubchem-enrich) 재사용 — 신규 외부 호출 0, enrich route에 product 매칭만 추가.
- 한계: 본 다리도 **PubChem 동의어가 기존 등록 표기를 포함할 때만** 작동. 그래도 약어↔풀네임의 상당수를 커버(PubChem 동의어가 보통 약어·CAS·이명 풍부).
