# §write-atomicity-missing — 업무 쓰기 다단계인데 트랜잭션이 없다

- **Status:** 🟡 도출 완료 (2026-08-15). 구현 0
- **분리 근거 (호영님):** 감사 트랙에서 고치지 않는다. **감사 이전에 업무 원자성 부재**다.
- **파생:** §audit-integrity-fix 1c 분류에서 갈라져 나왔다

---

## 0. 왜 감사 트랙 밖인가

> 업무 원자성이 없는 경로에 fail-closed 를 얹으면
> **업무 쓰기 일부만 커밋된 상태에서 5xx 가 나간다. 지금보다 나쁘다.**

따라서 **커밋 2(정의부 rethrow) 범위 = 1c-A 편입 완료분만**이다.
1c-B 경로의 감사 rethrow 는 이 카드가 닫힐 때까지 **보류**한다.

## 1. 규모 (분모 병기)

```
트랜잭션 밖 감사 호출   83건
  dead (activity-log-stubs.ts, importer 0)      6
  ─────────────────────────────────────────────
  활성                                          77
    1c-A  업무 쓰기 단일 → 감사 트랙 안         36 / 27파일
    1c-B  이 카드                               41 / 27파일
```

### 1c-B 내역 — **확정과 보수를 가른다**

| 사유 | 건수 |
|---|---|
| 업무 쓰기 N종 **다단계 · 트랜잭션 없음** (확정) | **27** |
| 업무 쓰기 0 — 스코프 해석 실패 (보수) | 6 |
| 해석 불가 심볼 — 경유 쓰기 배제 못 함 (보수) | 8 |

🛑 **41 은 "확정 다단계 41" 이 아니다.** 확정 27 + 보수 14 다.
보수 14 는 도출기 한계로 1c-B 에 넣은 것이고(애매하면 보수 방향),
**이 카드의 실제 작업량이 아니라 미해석분**이다.

## 2. 확정 다단계 27건 — 파일별

| 건수 | 경로 |
|---|---|
| 8 | `ai-actions/[id]/approve` |
| 3 | `orders` |
| 2 | `quotes/[id]` |
| 1 | `admin/orders/[id]/status` · `admin/quotes/[id]/items` · `ai-actions/generate/reorder-suggestions` · `inventory/smart-receiving` · `orders/[id]` · `products/[id]/sds` · `quotes/[id]/vendor-replies` · `quotes/[id]/vendor-requests` · `receiving-drafts/[id]/approve` · `safety/sds/bulk/commit` · `vendor/quotes/[quoteId]/response` · `work-queue/purchase-conversion/[quoteId]/request-approval` · `lib/operations/automation` · `lib/orders/convert-pocandidate-to-orders` |

⚠️ `ai-actions/[id]/approve` 8건이 최대 밀집이다. 이 파일은 **부분 커밋 위험이 가장 크다** —
승인 한 번에 여러 업무 테이블을 순차로 쓰고 트랜잭션이 없다.

## 3. 도출 방식과 한계

- 감사 호출 지점의 **가장 안쪽 함수 스코프**에서 업무 쓰기(감사 테이블 제외)를 센다
- 헬퍼 호출은 **전이 해석**한다(깊이 5) — 1차 실행은 "헬퍼 있으면 보수적으로 1c-B" 였고
  그 결과 45건이 한 바구니에 몰려 **변별력이 0** 이었다
- 저장소 밖 심볼은 해석 불가로 표시하고 보수 처리한다

> 🛑 **판정이 아니라 도출이다.** 애매하면 1c-B — 이쪽은 보수가 안전 방향이다.
> 확정 27건도 **트랜잭션 신설 전 개별 확인**이 필요하다(같은 스코프의 두 쓰기가
> 실제로 원자적이어야 하는지는 도메인 판단이다).

## 4. 이 카드가 닫지 않는 것

- 수정 0. 도출만
- 보수 14건의 재해석
- 각 경로에서 "무엇과 무엇이 원자적이어야 하는가" 의 도메인 판단
- dead 6건(`activity-log-stubs.ts`) 존폐

## 5. 관계

- §audit-integrity-fix — 1c 분류에서 갈라졌다. 커밋 2 범위를 이 카드가 제한한다
- §unvalidated-create — `deleteMany` 선행 손실과 같은 축(부분 실행)
- §placeholder-success-audit — `$transaction` 안 전역 `db` 는 별개 형태
