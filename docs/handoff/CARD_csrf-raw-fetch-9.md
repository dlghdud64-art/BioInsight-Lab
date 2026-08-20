# §csrf-raw-fetch — raw fetch 뮤테이션 9건 (기준선 · 처분 안 함)

**등재 2026-08-19** · `check-csrf-fetch-regression.sh` 를 고치자 처음으로 나온 결과

🛑 **기준선만 기록한다. 고치지 않았다.** 알림 404 와 같은 절차다.

## 🔑 이 스크립트는 **한 번도 스캔한 적이 없다**

두 결함이 겹쳐 있었고, 둘 다 `2>/dev/null` + `|| true` 가 삼켰다:

```
(1) Pass 1  --type tsx     → rg: unrecognized file type: tsx · exit 2
                             (-t ts 가 이미 .ts·.tsx 를 포함한다. 같은 레포의
                              check-no-inline-hex-bg.sh 주석이 이미 그렇게 적어뒀다)
(2) Pass 2  (?<!csrf)      → rg 기본 엔진(Rust regex) lookbehind 미지원 · exit 2
                             -P(PCRE2) 필요
```

Pass 1 이 먼저 죽어 `RAW_FETCH_FILES` 가 비었고, **루프가 0회 돌아** 항상
`✅ No raw fetch mutation regressions detected · exit 0` 이었다.

⚠️ 세션 초반 백로그 항목 **"csrf-raw-fetch 전면 스캔"** 의 성격이 이걸로 확정된다:
   *스캔을 아직 안 돌린 것이 아니라, 스캔이 존재한 적이 없다.*

## 기준선 — 9건

```
app/admin/users/page.tsx:1674
app/dashboard/pricing/page.tsx:101
app/dashboard/purchase-orders/new/page.tsx:105
app/pricing/_components/pricing-assistant.tsx:31
app/pricing/page.tsx:214
app/pricing/page.tsx:261
app/protocol/bom/page.tsx:175
components/safety/MsdsBulkRegisterModal.tsx:60
components/safety/MsdsBulkRegisterModal.tsx:86
```

🔑 **`purchase-orders/new/page.tsx:105` 는 경로 C 의 `/api/orders/draft` 호출부다.**
   ⑪ 트랙에서 "발주 생성 화면이 PurchaseRecord 만 만든다" 로 측정한 그 경로가
   **CSRF 토큰 없이 POST** 하고 있다. 403 가능성 — 두 트랙이 같은 줄에서 만난다.

⚠️ 세션 초반에 고친 CSRF 403 블로커(`e0518824` csrfFetch 승계)와 **같은 형태가 9곳 더** 있다.

## 착수 시 선행 판정

```
1  9건 각각이 실제 403 을 내는가 — 정적 판독이다. 프로덕션 실측 필요
   (csrfFetch 미사용 = 즉시 403 인지, 일부 엔드포인트는 CSRF 면제인지)
2  일괄 치환 vs 개별 — csrfFetch 는 시그니처가 fetch 와 같아 치환이 기계적이나,
   🛑 9곳을 한 배치로 묶지 않는다(§11.75 와 같은 규율)
3  purchase-orders/new 는 ⑪ 트랙과 겹친다 — 어느 트랙에서 고칠지 먼저 정한다
```

## 프로브 3축 (러너 = bash · ripgrep 15.2.0)

```
① 없는 경로        → exit 2  "스캔 대상 부족 — 0개 (기대 2000+)"   ✅
② 정당한 0건       → exit 0  "✅ No raw fetch mutation regressions"  ✅ 오탐 0
③ -P 제거          → exit 2                                        ✅ 엔진 결함이 통과 안 됨
```

③이 이 스크립트 고유 축이다 — 다른 스크립트엔 lookbehind 가 없다.

## 관련

- `CARD_gate-script-silent-fail.md` — 왜 눈이 멀어 있었나
- `baselines/csrf-raw-fetch-2026-08-19.txt` — 기준선 원본
- `e0518824` — 세션 초반에 고친 같은 형태 1건
