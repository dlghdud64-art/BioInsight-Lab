# CARD · §dashboard-padding-census — 셸 패딩 이관에서 누락된 페이지 전수

- 상태: 🔴 미판정 (실측 0)
- 발단: §org-management-web P6 (2026-08-25) · 호영님 "왼쪽이 여백이 없어"
- 선행 커밋: fb04150e (조직 두 페이지만 봉합 · sentinel 3건)

## 왜 카드인가

§dashboard-padding-unify(2026-07-04)가 셸 `<main>` 의 uniform 패딩을 걷어내며
**"각 페이지가 자기 패딩을 갖는다"** 로 계약을 바꿨다. 그런데 그 계약을 잠근
sentinel 이 검사한 페이지는 `dashboard/page.tsx` 와 `work-queue/page.tsx` 둘뿐이다.

🔑 계약을 바꾸면서 그 계약의 **적용 대상을 전수하지 않았다.**
조직 상세는 그 이관에서 패딩을 못 받았고, 7주간 아무 단언도 그것을 말하지 않았다.
같은 누락이 남아 있는지 아직 모른다.

## 미판정 목록 (census 2026-08-25 · dashboard 하위 page.tsx 패딩 토큰 grep = 0)

activity-logs · analytics/monthly · collaboration · grants · inventory/history ·
organizations/[id]* · purchase-orders/[poId] · quotes/[quoteId] ·
settings/enterprise · settings/plans · stock-risk · support ·
vendor/premium · vendor/quotes

*organizations/[id] 는 fb04150e 로 봉합됨 — 이 목록에서 제외.  → 남은 13개.

⚠️ **grep 0 은 결함의 증거가 아니다.** 위임 컴포넌트(PageShell 등)가 패딩을 들 수
있고, 실제로 `work-queue` 는 위임형인데 래퍼로 처리했다. 반대로 **grep ≥1 도
정상의 증거가 아니다** — 토큰이 루트가 아닌 내부 카드에 있을 수 있다.
소스 토큰은 존재만 말하고 도달을 말하지 않는다 (§reachability-needs-a-different-tool).

## 판정 방법 (이것이 이 카드의 본체다)

소스가 아니라 **렌더된 DOM 의 computed padding** 이 유일한 결정적 축이다.
이 결함도 소스가 아니라 화면에서 나왔다.

### 절차

1. 프로덕션에 로그인된 탭에서 각 라우트를 연다.
2. 다음을 실행한다 — `<main>` 부터 콘텐츠 첫 노드까지 내려가며
   **누적 좌측 여백**을 잰다. 어느 노드를 쟀는지가 측정의 일부다.
   (P6 에서 `<main>` 의 첫 자식만 보고 "리스트도 여백 0" 이라 오독한 전례가 있다.)

```js
const main = document.querySelector('main');
const mainLeft = main.getBoundingClientRect().left;   // 사이드바 우측 끝
// 콘텐츠 첫 실렌더 노드 = h1 이 있으면 h1, 없으면 main 의 최심 첫 자식
const node = document.querySelector('main h1, main h2') ?? (() => {
  let n = main; while (n.firstElementChild) n = n.firstElementChild; return n;
})();
const gap = Math.round(node.getBoundingClientRect().left - mainLeft);
```

3. **합격 기준**: 데스크탑(md 이상, viewport ≥ 768)에서 `gap ≥ 32`.
   저장소 관례가 `p-4 md:p-8` 이므로 md 이상에서 32px 다.
   `gap === 0` 이면 결함 확정. `0 < gap < 32` 는 별도 판정(관례 이탈).
4. **대조군**: 같은 절차를 `/dashboard/quotes` 에 실행한다. 정상 페이지의
   기준값이며, 여기서 `gap ≥ 32` 가 안 나오면 프로브가 틀린 것이지 페이지가
   틀린 것이 아니다.
5. 로딩 상태에서 재지 않는다. 데이터가 그려진 뒤에 잰다 — 조직 상세는
   `!organization` 일 때 중앙정렬 스피너를 반환해 루트 래퍼가 렌더되지 않는다.

### 결과 처리

- `gap === 0` 인 페이지만 봉합 대상이다. 리스트 전체를 결함으로 세지 않는다.
- 봉합 시 저장소 관례 래퍼를 쓰고, `dashboard-padding-unify.test.ts` 의
  §org-management-web P6 describe 블록에 그 페이지를 추가한다.
- 봉합 못 한 페이지는 이 카드에 **미판정으로 남긴다.** 정상으로 세면
  조직 상세와 같은 것이 또 7주를 산다.

## 배포 확인 축 (P6 에서 새로 세움 · 승계할 것)

§deploy-marker-is-not-build-time 의 대체 축이다.

**바뀐 문자열이 그 라우트의 page 청크에 들어왔는지 본다.**
`manifestGeneratedAt` 은 커밋된 상수라 빌드 시각이 아니고, SSR HTML 은
클라이언트 컴포넌트가 로딩 분기로 조기 반환하면 문자열을 안 싣는다.

```js
const grab = async (u, needle) => {
  const html = await fetch(u, {credentials:'include', cache:'no-store'}).then(r=>r.text());
  const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)].map(m=>m[0]))];
  const hits = [];
  for (const c of chunks) {
    const t = await fetch(c, {cache:'no-store'}).then(r=>r.text()).catch(()=>'');
    if (t.includes(needle)) hits.push(c.split('/').pop());
  }
  return {u, chunks: chunks.length, hits};
};
```

⚠️ **양성 대조군 없이 쓰지 말 것.** hits=[] 는 "미배포" 와 "프로브가 눈멀었다"
두 가지를 뜻한다. 이미 배포된 것이 확실한 같은 문자열을 다른 라우트에서
먼저 잡아 프로브의 시력을 증명한 뒤에 판정한다.

2026-08-25 실행 예 (fb04150e 직후):
```
/dashboard/organizations       chunks 41  hits [page-047be8feff947da8.js]  ← 대조군 GREEN
/dashboard/organizations/[id]  chunks 43  hits []                          ← 미배포 판정
```
