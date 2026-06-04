# DRY-RUN 보고 — §11.366 G-3: pilot 내부키 일괄 정리

작성: Claude (Cowork) / 2026-06-04 / 환경: soft launch (외부 모집 전, 외부 사용자 0)
**상태: dry-run (DB 변경 0). 호영님 "진행" 후에만 apply.**

---

## 0. 요약 (평이한 한국어)
- "사람이 읽는 내부키"가 두 군데서 생성됩니다.
  - **(A) pilot.ts** = 실제 DB에 데모 데이터를 넣는 시드 **스크립트** → 재시드 대상, **DB 게이트 적용**.
  - **(B) seed-data.ts** = ops-console 화면용 **정적 데모 데이터(코드 상수, DB 아님)** → 재시드 무관, **코드 수정만**(게이트 불필요).
- soft launch라 외부 유입 0 → 지금 응급은 아니나, **외부 공개 전 반드시 클리어**(데모 데이터가 실데이터처럼 보이는 채 런칭 불가).

---

## 1. 내부키 전수 (현재값 → 변경 후) — 누락 없이

### (A) pilot.ts — DB 시드 (재시드 대상)

**사용자에게 보이는 내부키 (G-3 핵심):**
| 항목 | 현재값 | 변경 후(제안 — 호영님 확정 필요) | 노출 위치 |
| :-- | :-- | :-- | :-- |
| 조직명 (L41 PILOT_ORG_NAME) | `Pilot Internal Org (#P01 ADR-002)` | 데모 조직명 (예: `데모 연구실` 또는 실조직명) | 헤더·설정·조직 전환 |
| 워크스페이스명 (L58) | `Pilot Internal Workspace (#P01 ADR-002)` | 데모 워크스페이스명 | 워크스페이스 표시 |
| 재고 바코드/식별자 (L435/445/455) | `inv-pilot-dmem` · `inv-pilot-fbs` · `inv-pilot-trypsin` | cuid 자동생성(id 지정 제거) | export 바코드열 · D-8 상세 "고유 식별자" |
| 발주번호 (L490 orderNumber) | `ORD-PILOT-2026-0001` | `ORD-2026-0001` (PILOT 제거) | 발주 관리·발주 상세 |

**DB 내부 PK (UI 미노출이면 G-3 무관 — 노출 확인 필요):**
- Product id `product-pilot-*` ×16 (L112-197) — name은 정상값(Ethanol 등).
- Vendor id `vendor-pilot-*` ×5 (L245-292) — name 정상값(Thermo Fisher·바이오마트 등).
- ProductVendor id `pv-pilot-*` ×15 (L368-382).
- Quote id `quote-pilot-*` ×1 (L403) — title 정상값.
- Order id `order-pilot-*` ×1 (L488).
- → 이 PK들은 보통 내부(URL/표시 미노출). **노출 표면 확인 후 노출분만 cuid 전환**(과변경 회피).

### (B) seed-data.ts — ops-console UI 정적 데이터 (코드 수정, DB 아님)
- `user-proc-001`(ownerId/createdBy), `qr-001`/`qri-00*`, `qresp-thermo/sigma/corning-001`, `qc-001`, `po-001`/`po-002`, `pol-00*`, `ae-00*`, `v-thermo/sigma/corning` 등.
- 호영님 언급 "usori-proc-001" = `user-proc-001`로 추정(usori≈user-proc). "P02-...verify"는 pilot.ts 주석(L210 `#P02-followup`)일 뿐 실데이터 title 아님 — 추가 확인.
- ops-console preview 화면에 노출되면 정리 대상(코드 상수만, 재시드 무관).

---

## 2. 영향 레코드 수 + 테이블 (pilot.ts 시드 기준 — 실측은 호영님 환경 DB 조회 필요)
| 테이블 | 시드 생성 수 | 정리 항목 |
| :-- | :-- | :-- |
| Organization | 1 | 조직명 |
| Workspace | 1 | 워크스페이스명 |
| Product | 16 | id PK(노출 시) |
| Vendor | 5 | id PK(노출 시) |
| ProductVendor | 15 | id PK |
| Quote | 1 | id PK |
| ProductInventory | 3 | **id(바코드/식별자) — 노출 확정** |
| Order | 1 | id PK + **orderNumber(노출 확정)** |
- ⚠️ **sandbox는 production DB 접근 불가** → 위 수치는 시드 스크립트가 생성하는 수. 실제 DB에 떠 있는 정확한 수/잔존 여부는 **호영님 환경에서 `prisma` 조회 또는 Chrome 확인** 필요.

---

## 3. 다운스트림 영향
- **export 바코드열**: inv.id → cuid 자동. `inv-pilot-*` 소멸 → 엑셀 누출 0.
- **D-8 상세 "고유 식별자"**: inv.id → cuid 자동 정상(§11.366 Phase 1 보강분).
- **§11.355-B QR 라벨**: 기존 pilot 라벨 QR이 `inv-pilot-dmem` 인코딩 → 새 cuid와 **불일치(stale)**. 단 **pilot 데모 라벨이 실물 인쇄·현장 사용된 적 없으면 무영향**(soft launch라 실사용 0 추정 — 호영님 확인).
- **발주번호**: `ORD-PILOT-*` → `ORD-2026-*`. 발주 관리/상세 표시 정상화.
- **조직/워크스페이스명**: 헤더·설정 표시 정상화.

---

## 4. canonical truth — 시드 vs 실데이터 경계 (⚠️ 확인 필요)
- 이전 세션 Chrome에서 본 대시보드 "재고 부족 2건"이 **pilot 시드(inv-pilot-fbs/trypsin 등)인지 호영님 실데이터인지 = sandbox로 판정 불가**(DB 접근 0).
- **호영님 환경에서 확인 필요**: 현재 labaxis 계정의 재고/발주/견적이 (a) pilot 시드만인지, (b) 실데이터 혼재인지. 
  - pilot 시드만이면 → 재시드(cleanup→재생성) 안전.
  - 실데이터 혼재면 → pilot 레코드만 선별 정리(전체 재시드 금지, 실데이터 보존).
- **이 경계 확정이 apply 방식(전체 재시드 vs 선별 정리)을 가릅니다 → 진행 전 필수.**

---

## 5. Rollback path
- pilot.ts는 재실행 가능 시드 스크립트 + cleanup 스크립트 존재(파일 헤더). 
- apply = (1) pilot cleanup(기존 inv-pilot-* 등 삭제) → (2) 수정된 pilot.ts 재시드(cuid id).
- rollback = 수정 전 pilot.ts로 재시드(원복) 또는 cleanup 후 미시드. 외부 사용자 0이라 리스크 낮음.
- seed-data.ts(B)는 코드 상수 → git revert.

---

## 6. apply 전 호영님 확정 필요 (게이트)
1. **시드 vs 실데이터 경계**(§4) — 전체 재시드 가능 여부.
2. **변경 후 값**: 조직명·워크스페이스명을 무엇으로(데모명 vs 실조직명), 발주번호 포맷.
3. **내부 PK(product-pilot-* 등) 노출 표면** 확인 후 정리 범위(노출분만 vs 전부).
4. **pilot 라벨 실물 사용 여부**(QR stale 영향 판정).
5. **(B) seed-data.ts 노출 범위**(ops-console preview가 외부 공개 화면인지).

→ 위 확정 후 "진행" 주시면: pilot.ts 수정(cuid 전환 + 조직/워크스페이스/발주번호 정상값) + cleanup→재시드 절차 + sentinel(내부키 부재 가드) 작성. **그 전까지 DB 변경·코드 수정 0.**
