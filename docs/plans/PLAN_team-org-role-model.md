# §team-org-role-model — 팀/조직 권한 모델 이원화 (등재만, 동결)

작성: 2026-08-12
상태: **등재 + 동결** (호영님 2026-08-12) — 실사용자 트래픽 이후 재개. 설계·실측 모두 미착수.
발원: §enum-input-validation role 교정 중 `TeamRole`/`OrganizationRole` 혼동 발견

---

## 0. 관측된 사실 (교정 완료분)

`team/[id]/members` PATCH 와 `team/invite` POST 가 같은 형태로 잘못돼 있었다:

```ts
if (role !== TeamRole.ADMIN && role !== TeamRole.ADMIN)   // 같은 값 두 번
    → "Forbidden: Only ADMIN or OWNER can change roles"    // OWNER 는 TeamRole 에 없다
```

`TeamRole = ADMIN | MEMBER | VIEWER` (OWNER 없음), `OrganizationRole` 에는 OWNER 있음.
원래 `!== OWNER` 였을 자리가 enum 에 값이 없어 ADMIN 으로 치환되고 문구만 남은 흔적.
중복 조건·거짓 문구는 정리했고 **동작(ADMIN 보호)은 유지**했다.

## 1. ⚠️ 열린 질문 — ADMIN 강등 데드락 가능성 (미실측)

정리된 동작을 합치면: 역할 변경 권한 = 팀 ADMIN 만, ADMIN 은 변경 불가.
→ **ADMIN 을 강등할 수 있는 사람이 아무도 없을 수 있다.** 잘못 부여된 ADMIN 회수 경로 0,
퇴사자가 팀 ADMIN 이면 그대로 남는다.

재개 시 실측 3건 (호영님 지시분, 동결로 미수행):
1. 조직 OWNER 가 팀 멤버 역할을 바꾸는 별도 경로가 있는가 — 있으면 데드락 아님
2. 없다면 현재 ADMIN 강등 수단이 실제로 0 인지
3. 팀 생성자가 자동 ADMIN 이 되는가 — 최초 ADMIN 은 어떻게 정해지는가

0 으로 확인되면 결함 존치이며, 조직 OWNER 에게 팀 역할 변경 권한을 주는 최소 교정을 상신.

## 2. 재개 시 실측 항목 (설계 전 — 설계는 그 다음)

- 두 enum 이 각각 어느 판정 지점에서 쓰이는가
- 같은 표면에서 둘 다 보는 곳이 있는가 (있으면 우선순위가 정의됐는가)
- 한쪽 enum 으로 다른 쪽을 판정하는 곳이 있는가

이는 §audit-foundation 과 같은 층위의 설계 작업이다 — 순서는 재개 시 호영님이 정한다.
