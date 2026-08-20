# §orphan-caller-404 — 프론트가 없는 엔드포인트를 부르고 있다 (실 결함 4건)

**등재 2026-08-19** · ripgrep 설치 후 `check-api-orphan-caller.sh` 가 처음으로 실제 스캔한 결과

🛑 **성격 측정만 했다. 처분 안 함.**

## 배경 — 이 가드가 존재하는 이유가 이것이다

`§11.103` 목적: *"frontend caller fetch URL 이 backend route.ts 와 매치 안 되는 **silent 404 회귀** 자동 catch"*.
그 가드가 rg 부재로 눈이 멀어 있었고(§gate-script-silent-fail), 켜자마자 4건이 나왔다.

## 5건 분류 — 실 결함 4 · 오탐 1

| # | caller URL | 호출부 | 판정 |
|---|---|---|---|
| ① | `/api/notifications?actionType=IN_APP&limit=20` | `components/dashboard/Header.tsx:78` | 🔴 **결함** — `app/api/notifications/` 디렉터리가 **아예 없다** |
| ② | `/api/notifications/${id}/read` | `Header.tsx:94` | 🔴 **결함** — 동일 |
| ③ | `/api/notifications/${n.id}/read` | `Header.tsx:223` (모두 읽음) | 🔴 **결함** — 동일 |
| ④ | `/api/support/...) 는 금지(앞에 csrf 접두 없는 경우).` | `__tests__/regression/support-csrf-fix.test.ts:31` | ⚪ **오탐** — 테스트 파일의 **주석**에서 URL 을 추출했다 |
| ⑤ | `/api/workspaces` | `dashboard/pricing/page.tsx:85` · `dashboard/settings/page.tsx:347` | 🔴 **결함** — `workspaces/` 는 있으나 **루트 `route.ts` 가 없다**(`[id]/…` 만 존재) |

## 🔑 이력 측정 — 인과가 뒤집힌다

```
2026-04-29  f87aa9a2  §11.90 dead-capability-cleanup Tier 2 sweep
            삭제  notifications/route.ts · notifications/[id]/read/route.ts
                  notifications/drafts/[id]/approve · workspaces/route.ts (외 30건)
            근거  body: "각 cluster spot-check + GET caller 검증 → **0 callers 확인**"
            검증  삭제 시점 Header.tsx 에 api/notifications 호출 **0건** — 삭제는 옳았다

2026-04-30  fe828ba5  settings/page.tsx    → /api/workspaces  호출 추가   (+1일)
2026-05-03  583dd8be  pricing/page.tsx     → /api/workspaces  호출 추가   (+4일)
2026-05-05  bb2e2e45  §11.209d 알림 벨 UI  → Header.tsx 가 /api/notifications 호출 추가 (+6일)
```

🛑 **"게이트가 기능을 죽였다" 가 아니다.** 삭제는 정당했고, 그 뒤 1~6일 안에
   **없는 엔드포인트를 부르는 호출부가 세 곳 새로 들어왔다.**

→ 알림 벨과 워크스페이스 조회는 **처음부터 404** 다. 한 번도 작동한 적이 없다.

→ §11.103 orphan-caller 가드가 정확히 이걸 잡으라고 2026-04-29 에 block 으로 전환됐는데
  (`§11.112 #ci-guards-advisory-to-block-mode`), rg 부재로 **약 4개월** 눈이 멀었다.
  가드가 켜진 날과 기능이 깨진 날이 **거의 같다.**

### 처분 갈래가 이걸로 좁아진다

```
"원래 있었는데 지워졌다"    ✗ — 지워질 땐 caller 0 이었다
"애초에 없었다"             ✓ — UI 가 엔드포인트 없이 land 했다
→ 처분은 "복구" 가 아니라 **"신설 or 호출부 제거"** 다. 제품 결정.
   §11.209d 계열(알림 인프라)이 어디까지 구현됐는지가 선행 판정 재료.
```

## 사용자에게 보이는 영향 — ✅ 프로덕션 실측 완료 (2026-08-20)
```
실측  대시보드 로드 시 GET /api/notifications 404 × 2회 (Network 캡처)
      벨 클릭 → 드롭다운 "새 알림이 없습니다 · 모든 알림을 확인했습니다"
🛑    404 가 빈 상태로 위장된다 — 에러를 "정상 · 알림 없음" 으로 렌더.
      silent-fail 과 같은 형태: 실패가 통과처럼 보인다.
      "모두 읽음" · "전체 알림 보기" 는 클릭 안 함 (mutation / 추가 경로 — 읽기 전용 스모크)
```


```
헤더 알림 벨    목록 조회 404 · 읽음 처리 404 · 모두 읽음 404
설정 / 가격     워크스페이스 목록 조회 404
```

~~정적 판독~~ → 위 실측으로 확정. 설정/가격의 workspaces 404 는 화면 확인 아직 (열지 않음).

## 오탐 ④ 는 native-select 와 같은 형태다

```
native-select   sentinel 의 not.toMatch(/<select/) 를 '사용' 으로 셌다
orphan-caller   테스트 주석의 URL 을 '호출' 로 셌다
→ 둘 다 **게이트가 자기 감시자·문서를 위반으로 신고**한다
```

같은 처방이 적용된다: `--glob '!**/__tests__/**'` + 주석 라인 제외.
🛑 다만 이 스크립트는 형태 C(mktemp 다단계)라 native-select 의 형태 A 를 그대로 복사할 수 없다.

## 착수 시 선행 판정

```
1  ①②③ notifications  엔드포인트를 만들 것인가, 호출부를 지울 것인가
                       (알림 기능이 미완인지 이전됐는지 — §11.209d 계열 확인)
2  ⑤ workspaces        루트 GET route 신설 vs 호출부를 [id] 경유로 변경
3  ④ 오탐              필터 정제 — native-select 와 같은 축, 형태는 다름
🛑 1·2 는 제품 결함이라 게이트 트랙과 분리한다. 이 카드는 목록 확정까지다.
```

## 관련

- `CARD_gate-script-silent-fail.md` — 이 가드가 왜 눈이 멀어 있었나
- `baselines/gate-scripts-2026-08-19.md` — orphan-caller 는 CI 조건(BLOCK=1)에서 exit 1
- `baselines/native-select-filter-refinement.md` — 같은 오탐 형태의 선행 처리
