# §org-scope-ambiguity — 같은 제품 안에 소속 모델이 두 갈래다

- **Status:** 등재 (2026-08-12, 호영님 지시) · 교정 미착수
- **범위:** §team-org-role-model 보다 **넓다**. 조직 스코프를 읽는 모든 표면이 대상이다.

---

## 1. 문제

한 사용자가 여러 조직에 속할 수 있는데, **코드가 그 사실을 일관되게 다루지 않는다.**

| 방식 | 예 | 다중 소속 시 동작 |
|---|---|---|
| **복수 전제** | `dashboard/stats/route.ts:66` — `orgIds = memberships.map(...)` → `{ in: orgIds }` | 전 조직 합산 |
| **단일 가정** | `activity-logs` · `activity-logs/stats` · `ai-actions/generate/order-followup` · `ai-actions/[id]/approve` 등 다수 — `organizationMember.findFirst` | **임의의 조직 하나** |

`findFirst` 는 정렬 없이 첫 행을 집는다. **어느 조직이 선택되는지 정의돼 있지 않다.**

### 왜 별건이 아니라 결함인가

유출은 아니다 — 사용자가 속한 조직의 데이터만 본다. 그러나 **오표시**다:

> 다중 소속 사용자는 **자기가 어느 조직을 보고 있는지 알 수 없고,
> 틀린 조직을 보고 있다는 것도 알 방법이 없다.**

화면에 조직 표시가 없고, 선택 근거도 없다. 조용한 실패의 전형이다.

---

## 2. 실측 — 이것은 **이미 발생 중인 결함**이다 (2026-08-12)

호영님 판정 기준: *"UI 에 조직 전환기가 있는가. 없다 → 미구현이므로 잠재 결함.
있다 → 이미 발생 중인 결함."*

### 전환기 — **있다**

`components/workspace/workspace-switcher.tsx` (조직 전환:
`currentOrganizationId` / `onOrganizationChange` / `OrganizationRole`).

**도달성 확인 — 6개 라이브 페이지에 렌더:**
`admin/safety` · `dashboard/safety-spend` · `settings/audit` · `settings/billing` ·
`settings/security` · `settings/workspace`

`selectedOrgId` 상태를 보유한 화면은 **8개**.

→ 다중 소속은 **제품이 지원하는 기능**이다. *"스키마가 허용한다 ≠ 제품이 지원한다"*
를 물었고, 답은 **지원한다** 였다.

### 데이터 — 아직 안 터졌을 뿐

운영 DB `OrganizationMember` **1행 / 1 사용자 / 다중 소속 0**.
표본이 1행이라 **판별 근거가 아니다.** 실사용자를 받는 순간 발생한다.

---

## 3. 아직 재지 않은 것

- `findFirst` 로 조직을 고르는 지점의 **전수**(위 목록은 상한이 아니라 표본)
- 전환기가 고른 조직이 **API 로 전달되는가** — 전달되지 않으면 전환기 자체가
  표시만 바꾸고 데이터는 `findFirst` 가 정하는 상태일 수 있다 ⚠️ **가장 먼저 잴 것**
- 전환기가 **없는** 화면(대시보드·소싱·견적 등)은 어느 조직을 보여 주는가

---

## 4. 관계

- §team-org-role-model — 팀 생성 시 조직 선택 UI 가 필요한 근거가 이 문서의 실측이다
- §fabricated-data-surface — 조직 생성 직후 화면이 `OWNER` 로 표시하나 DB 는 `ADMIN`
  (§team-org-role-model 1-H ③-A). 소속·역할 표시가 실제와 어긋나는 같은 계열
