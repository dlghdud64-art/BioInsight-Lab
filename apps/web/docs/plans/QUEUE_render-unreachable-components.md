# QUEUE · 렌더 도달 0 컴포넌트 전수 · 삭제 후보

- 상태: **판정 대기 · 제품 큐** (호영님: 「지금 착수하지는 마십시오」 2026-09-24)
- 등록: 2026-09-24
- 판정할 것: 이 컴포넌트들을 **되살릴 것인가, 지울 것인가**

---

## 왜 큐에 올리는가

발주 UI 를 삭제하면서(§po-ui-removed) 링크를 전수 정리했는데, 목적지가 사라진 자리 중
**렌더에 도달하지 않는 컴포넌트**가 나왔다. 이쪽은 목적지를 새로 정하면 그것도 추측이 된다 —
그 화면이 되살아날지 자체가 미정이기 때문이다. 그래서 **링크만 끊고** 존폐를 여기로 넘겼다.

🛑 「도달 0 이니 그냥 지운다」 로 처리하지 않은 이유: 도달 0 은 **오늘의 사실**이지
   「필요 없다」 가 아니다. 반대로 놔두면 다음 사람이 그 안의 옛 배선을 참고해 되살린다
   (실측: `po-seed-cutoff` 2차에서 시드 군집이 정확히 그 경로로 살아 있었다).

---

## 목록 (렌더 도달 0 · `renderReachableSources` 실측 2026-09-24)

| 파일 | 원래 자리 | 지금 상태 |
|---|---|---|
| `components/dashboard/action-ledger.tsx` | 대시보드 액션 원장 | 발주 href 를 빈 문자열로 끊음 |
| `components/dashboard/ai-action-inbox.tsx` | AI 액션 인박스 | `approveHref` 2종을 끊음 (구조는 보존) |
| `components/dashboard/executive-summary-section.tsx` | 경영 요약 섹션 | 발주 href 끊음 |
| `components/dashboard/operator-quick-actions.tsx` | 운영자 퀵액션 4카드 | 「입고 처리 → 발주」 href 끊음 |
| `components/dashboard/overlay/workbench-full-overlay.tsx` | 발주 전용 전체 작업면 오버레이 | **importer 0** — `dashboard-shell` 마운트 제거로 도달 경로가 끊겼다 |

`workbench-full-overlay` 는 다른 넷과 성격이 조금 다르다 — 나머지는 **표면이 안 쓰이는** 것이고
이쪽은 **대상 라우트가 사라진** 것이다. `/dashboard/purchase-orders/[poId]/dispatch` 경로를
정규식으로 파싱하는 코드가 그대로 남아 있다.

---

## 판정 항목

1. 다섯 개를 **지운다** — 되살릴 때는 새로 만든다. 옛 배선 참고 가치는 git 이력으로 충분하다.
2. **남긴다** — 어느 것을, 어떤 화면으로 되살릴 계획인지 함께 정한다.
3. 섞는다 — 파일별로 판정.

## 착수 시 지킬 것

- 지우기로 정하면 **명제를 먼저 이력에 복원**한다(CLAUDE.md §sentinel 은 명제를 단언한다).
  이 파일들을 읽는 sentinel 이 있으면 그 명제도 같이 옮기거나 은퇴시킨다.
- 도달 0 판정은 `__tests__/_helpers/literal-data-scan` 의 `renderReachableSources` 로 **재실측**한다.
  오늘 도달 0 이어도 그 사이에 누가 import 를 붙였을 수 있다.

## 관련

- §po-ui-removed `33fc705f` — 이 목록이 드러난 커밋. 자기 한계 1 에 같은 내용이 적혀 있다.
- `__tests__/regression/po-ui-removed.test.ts` ② — 도달 **0** 인 자리는 축에서 빠진다. 이 큐가 그 사각지대다.
