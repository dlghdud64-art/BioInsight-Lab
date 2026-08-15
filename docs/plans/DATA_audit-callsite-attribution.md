# DATA — 감사 헬퍼 호출부 귀속 (§audit-integrity-fix)

- **작성:** 2026-08-15 · 커밋 1a 동반
- **성격:** 🟡 **도출이지 판정이 아니다.** 경로 패턴 + 경계 수동 적용의 결과다.
- **목적:** 기본값 fail-closed 로의 흡수가 **의도인지 사고인지 구분되게** 남긴다.

---

## 0. 전체 분포

```
감사 헬퍼 호출부 총계   102건 / 59파일   (분모 = src 전체, 정의부 4파일 제외)
  (가) 경로 패턴 확정      69
  미분류 → 경계 수동 적용  33  →  (가) 31 · (나) 2
  ─────────────────────────────────
  (가) 합계               100
  (나) 합계                 2
```

> **범위 선택이 실질적으로 없다** — (가) 한정안(100)과 전면안(102)의 차이는 2건이다.
> 그래서 범위 논쟁을 접고 전면으로 가되 **커밋 1 을 쪼갠다**.

## 1. 미분류 33건 → 귀속

| 경로 | 호출 | 귀속 | 사유 |
|---|---|---|---|
| `api/admin/users/[id]/approval-policy` | createAuditLog ×1 | **(가)** | 권한 변경 — 승인·정책은 되돌리기 어렵고 재구성 필요 |
| `api/admin/users/[id]/approval` | createAuditLog ×1 | **(가)** | 권한 변경 |
| `api/admin/users/[id]/restore` | createAuditLog ×1 | **(가)** | 권한 변경 — 복구 |
| `api/admin/users/[id]` | createAuditLog ×1 | **(가)** | 권한 변경 |
| `api/cron/user-soft-delete-purge` | createAuditLog ×2 | **(가)** | **되돌릴 수 없음** — 퍼지 |
| `api/organization-vendor-products/[id]` | createActivityLog ×1 | **(가)** | 제품 정보 등록·변경 |
| `api/organization-vendor-products` | createActivityLog ×2 | **(가)** | 제품 정보 등록·변경 |
| `api/organization-vendors/[id]` | createActivityLog ×2 | **(가)** | 공급사 등록·변경 |
| `api/organization-vendors` | createActivityLog ×2 | **(가)** | 공급사 등록·변경 |
| `api/safety/spend/map` | createAuditLog ×1 | **(가)** | 제품 매핑 변경 — **지출 귀속을 바꾼다** |
| `api/workspaces/[id]` | createAuditLog ×1 | **(가)** | 권한 변경 — 조직 축 |
| `lib/activity-log-stubs.ts` | createActivityLog ×6 | **(가)** | 스텁 — 기본값 흡수. 존폐는 별건 |
| `lib/ai/operational-brief-injection-audit.ts` | createAuditLog ×2 | **(가)** | 감사 기록 자체 |
| `lib/ai/order-followup-detector.ts` | createActivityLog ×1 | **(가)** | 상태 전이 파생 |
| `lib/audit.ts` | createAuditLog ×3 | **(가)** | 래퍼 — 정의부 계열 |
| `lib/operations/automation.ts` | logStateTransition ×4 | **(가)** | 상태 전이 자동화 |
| `api/safety-spend` | createAuditLog ×1 | **(나)** | 조회 — 리포트 열람 |
| `api/safety/spend/summary` | createAuditLog ×1 | **(나)** | 조회 — 리포트 열람 |

### 판정 아닌 것으로 남기는 표시

- **규칙 미적중으로 기본값 흡수된 건: 0.** 33건 전부 위 사유 중 하나에 명시적으로 걸렸다
- 애매한 건은 **(가) 로 보냈다** — 기본값이 fail-closed 이므로 이 방향이 안전한 쪽
- `lib/activity-log-stubs.ts`(6건) 는 **스텁**이다. 실동작 여부 자체가 미확인 —
  존폐 판단은 별건. 지금은 기본값으로 흡수만 해둔다

## 2. (나) 2건 — 커밋 3 으로 이관, 지금은 (가)

`api/safety-spend` · `api/safety/spend/summary` 는 **(다) raw SQL 10쌍으로 현재 500** 이다.

> 🛑 **죽은 경로에 opt-out 판단을 내릴 수 없다.**
> 커밋 3 = D3(raw SQL 축) 완료 후로 이관. **그때까지 (나) = 0, 전건 fail-closed.**

이번 트랙은 **커밋 2까지만** 낸다.

## 3. 트랜잭션 편입 현황 (커밋 1b·1c 대상)

```
편입 5/102 (4.9%)
$transaction 콜백 안(어휘적) 15 — 그중 tx 전달 5, 팬텀 10
감사 호출부 파일 59 중 $transaction 사용 18 · 미사용 41
```

| 헬퍼 | 호출 | 주입 지점 | 상태 |
|---|---|---|---|
| `createActivityLog` | 40 | `txClient` | ✅ 기존 |
| `createActivityLogServer` | 10 | `db` 파라미터 | ✅ 기존 |
| `logStateTransition` | 6 | `txClient` | ✅ 기존 (**정정** — 앞서 "없음" 으로 적은 것은 오독) |
| `createAuditLog` | 46 | — | 🆕 **커밋 1a 에서 신설** |

## 4. 관계

- §audit-integrity-fix — 설계안
- §audit-integrity-200-mask — 확진판
- §placeholder-success-audit — 팬텀 10건(트랜잭션 안에서 전역 `db`)
