# PLAN §scan-org-identity B — OcrJob 조직 정합 + 격리 계약 복구

작성 2026-09-04 · 승계: (C′) `90abdb5c` (smart-receiving 방어) · (D) `19ff468b` (분류 출처)
지시: 호영님 2026-09-04 — "(B)는 기한 없는 나중이 아니라 스모크 직후 다음 배치"

---

## 0. 왜 (C′) 로 끝나지 않는가

(C′) 는 **smart-receiving 한 곳만** 방어했다. 오염 생산자는 그대로다.

```
생산: OCR 라우트가 OcrJob.organizationId 에 session.user.id 를 쓴다
     └ OcrJob 쪽에 FK 가 없어 DB 가 안 막는다
소비: smart-receiving 은 이제 안 읽는다 (C′)
     ocr/correct · ocr/retry 는 **여전히 그 값으로 조회한다**
```

즉 지금은 오염이 계속 쌓이고, 소비처 2곳이 오염값에 의존해 "동작"한다.

---

## 1. 실측 (2026-09-04, prod `xhidynwpkqeaojuudhsw`, read-only)

```
OcrJob 총 행                1
  organizationId            "cmqdc1t6j0000hajdvy91zb0e"  ← User.id
  그 id 의 Organization      실재하지 않음 (org_exists=false)
  실제 소속 조직             cmqp6tp920001p58egl43nd8j (T1)

참조 (삭제 시 끊기는 것)
  InventoryRestock.ocrJobId  3   ← 2026-09-04 스모크로 실증한 lineage
  OcrResult.jobId            1
  OcrCacheHit.cachedJobId    3

Organization                2  (T1 · org-bioinsight-lab[members 0·owners 0, 시드 잔재])
```

---

## 2. 5곳은 **두 종류**다 — 이게 순서를 결정한다

정정: 이전 보고에서 "5곳"을 한 덩어리로 셌다. 실제로는 성격이 다르다.

| # | 위치 | 성격 | 지금 동작 | 쓰기만 고치면 |
|---|---|---|---|---|
| 1 | `quotes/parse-image:74` | **생성** | 오염 생산 | 정상화 |
| 2 | `quotes/parse-pdf:76` | **생성** | 오염 생산 | 정상화 |
| 3 | `inventory/scan-label:127` | **생성** | 오염 생산 | 정상화 |
| 4 | `ocr/correct/[jobId]:93` | **조회 필터** | 오염값과 우연히 일치해 찾아짐 | 🛑 **못 찾음 → 404** |
| 5 | `ocr/retry/[jobId]:78` | **조회 필터** | 위와 같음 | 🛑 **못 찾음 → 404** |

**생성 3곳만 고치면 조회 2곳이 깨진다.** `where: { id, organizationId: session.user.id }` 로
찾는데 job 의 org 가 T1 로 바뀌면 매칭이 사라진다. 반드시 같은 배치에서 함께 간다.

완화 요인(무시하지 말 것): 4·5 는 둘 다 **503 placeholder** 다
(`correct:109` "Phase 5 실제 wiring placeholder — 현재는 lookup + body 검증만 + 503",
`retry:96` "현재는 lookup 만 + 503 안내"). 실제 재처리·보정은 일어나지 않는다.
그래도 404 로 바뀌면 화면 문구가 "대상 없음" 으로 뒤집히므로 사용자에게는 회귀다.

---

## 3. 🛑 요청 범위 밖에서 발견한 것 — 캐시에 조직 격리가 없다

`lib/ocr/image-storage.ts:206 findCachedOcrJob`

```ts
where: { imageHash, type, status: {...}, createdAt: { gte: cutoff } }
```

**organizationId 조건이 없다.** 48시간 안에 같은 이미지를 스캔하면 **조직과 무관하게**
남의 OcrJob 을 캐시로 받는다. 그 job 의 `imageUrl`(Blob 원본)과 `finalResult`
(파싱된 명세서 전문 — 거래처·품목·단가)까지 그대로 넘어온다.

- 지금 무해한 이유: 조직 1개 · OcrJob 1행. **격리가 성립해서가 아니다.**
- `ocrOrgMatches` 와 같은 계열이지만 **더 무겁다** — 그쪽은 등록 게이트였고
  이쪽은 **문서 내용 자체가 넘어간다.**
- 생성 3곳을 고쳐 org 가 채워져도 이 함수가 안 보면 유출 경로는 남는다.

→ B 배치의 필수 항목으로 넣는다. 뺄 거면 그 판단을 명시로 받아야 한다.

---

## 4. 착수 순서 (FK 는 마지막)

```
B-1  생성 3곳 교정        resolveActiveOrganizationId 로 실제 org 주입
     조회 2곳 동시 교정    같은 resolver 로 필터 → 404 회귀 0
     findCachedOcrJob     organizationId 조건 추가 (§3)
     ─ 게이트: unit + sentinel + 도메인 축 + build → land → 배포

B-2  기존 1행 보정        UPDATE "OcrJob" SET "organizationId"='cmqp6tp920001p58egl43nd8j'
     (DML · 승인 등급 2)   WHERE id='cmtlpm7jm0000vag0oplkd89k'
     ─ 삭제 아님. lineage 3행이 이 job 을 참조한다(§1). id 불변이므로 계보 무손상.
     ─ 근거: job.userId = cmqdc1t6j0000hajdvy91zb0e, 그 사용자의 유일 멤버십이 T1(OWNER).
       추정이 아니라 OrganizationMember 실측값이다.
     ─ dry-run → 보고 → 승인 → 적용 → 독립 조회로 재확인 → 역방향 1문장 기록

B-3  FK 추가 (DDL · 승인 별도)
     ALTER TABLE "OcrJob"
       ADD CONSTRAINT "OcrJob_organizationId_fkey"
       FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
     🛑 B-2 가 **반드시 선행**한다. 지금 걸면 실재하지 않는 org 를 가리키는 1행 때문에
        제약 생성 자체가 실패한다.
     ⚠️ ON DELETE 정책 상신 필요 — 아래 §6.
```

DDL 을 마지막에 두는 이유: FK 는 **되돌리기 가장 비싼 것**이고, 앞 두 단계가 끝나야
걸 수 있다. 코드가 먼저 정합돼야 새 오염이 안 생긴다.

---

## 5. `Phase 4a` 주석 8건 — 개별 처리 방침

| 위치 | 내용 | 처리 |
|---|---|---|
| `scan-label:20` | "parseWithGemini 직접 호출 → runOcrPipeline wrapper swap" | **유지** · org 와 무관한 이관 이력 |
| `scan-label:120` | 같은 이관 이력 | **유지** |
| `scan-label:127` | "Phase 5 에서 실제 organizationId 정합" | **삭제** · B-1 이 그 Phase 5 다 |
| `ocr/retry:76` | "Phase 4a 와 동일 placeholder — Phase 5 에서 …정합" | **삭제** · 동일 |
| `parse-image:1` | 파일 헤더 이관 이력 | **유지** |
| `parse-pdf:1` | 파일 헤더 이관 이력 | **유지** |
| `run-ocr-pipeline:2` | 모듈 식별자 `§11.290 Phase 4a #ocr-run-pipeline` | **유지** · sentinel 앵커 |
| `run-quote-ocr-pipeline:2` | 동일 | **유지** |

삭제는 2건뿐이다. 나머지 6건은 org 결함과 무관한 **파이프라인 이관 이력·모듈 식별자**라
지우면 오히려 추적이 끊긴다. "8건 전부 정리" 로 읽으면 과잉이다.

---

## 6. 상신 — DDL `ON DELETE` 정책 (승인 필요)

| 안 | 조직 삭제 시 | 평가 |
|---|---|---|
| `CASCADE` | OcrJob 삭제 → `OcrResult`·`OcrCacheHit` 연쇄 삭제, `InventoryRestock.ocrJobId` 는 SetNull | 다른 org 테이블과 일관. 다만 **재고 계보가 조용히 끊긴다** |
| `RESTRICT` | OcrJob 이 남아 있으면 조직 삭제 자체가 막힘 | 계보 보호. 조직 삭제 운영이 번거로워짐 |
| `SET NULL` | 불가 — 컬럼이 `String`(non-null) | ✗ |

**권고: `RESTRICT`.** 이번 배치의 전체 주제가 "계보를 끊지 않는다" 이고(B-2 에서 삭제 대신
보정을 택한 것과 같은 이유), 조직 삭제는 드문 운영이라 막히는 비용이 낮다.
`CASCADE` 를 택하면 조직 하나 지울 때 입고 이력의 스캔 출처가 말없이 사라진다.

---

## 7. sentinel (호영님 지시 5 — 폐기한 `ocrOrgMatches` 자리)

성립한 적 없는 계약이 GREEN 이었던 것이 이 결함의 수명을 늘렸다. 같은 형태를 만들지 않는다.

1. **생성 3곳** — `organizationId` 에 user 식별자가 들어가지 않는다.
   §scan-registration-category 의 schema 대조와 같은 방식으로, 소스 문자열이 아니라
   **`organizationId: session.user.id` 형태의 부재**를 `stripComments` 코드 축에서 단언.
   전역 스캐너(`org-id-misuse-scan`)를 테스트로 승격 — 5곳이 아니라 **0곳**이어야 한다.
2. **조회 2곳** — 필터가 resolver 결과를 쓴다(각각 단언 · OR 금지).
3. **캐시** — `findCachedOcrJob` where 절에 `organizationId` 가 실재한다.
   🔑 이번 유출 경로를 직접 잠근다.
4. **FK 실재** — `information_schema` / `pg_constraint` 가 아니라 `schema.prisma` +
   migration SQL 대조(런타임 DB 는 테스트에서 못 본다). 마이그레이션 additive 단언 포함.
5. **회귀 0** — (C′)·(D) 계약 보존: fallback 체인 부재 · 소유자 게이트 · `categoryTouched` 3상태.

각 단언은 주입 프로브로 RED 실증하고, 주입 범위 = 단언 창의 union 전량으로 한다.

---

## 8. 게이트

`unit` + `sentinel` + 도메인 축(inventory·receiving·scan·lib·org·ocr) 백로그 대조 +
`tsc` + `npm run build`. DDL 은 §9 절차(project-ref echo → dry-run → 승인 → 적용 →
`/api/health` 재확인 → 코드 push).

---

## 9. Out of Scope

- 조직 동료 스캔 대리 등록 복원 — (C′) 에서 소유자 단독으로 좁힌 것. org 정합 후 별건.
- `org-bioinsight-lab` ownerless 정리 — 시드 잔재, 이번 건과 무관(별건 유지).
- Lot·유효기간 축 검증 — 호영님이 명세서 준비 후 (B) 이후.
- 발주서 PDF 저장 스모크 — 미측정으로 남은 ⑤ 축.
