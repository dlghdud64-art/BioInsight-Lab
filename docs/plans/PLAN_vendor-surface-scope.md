# §vendor-surface-scope — 벤더 표면 링크 ↔ 실재 페이지 대조

작성: 2026-08-10
상태: **목록만.** 고치지 않는다(호영님 2026-08-10 지시). 표지 등재 목적.
발원: §route-duplication 사례1 처리 후 잔존 확인

---

## 0. 이번에 처리한 것 (미생성)

| 대상 | 처리 |
|---|---|
| `vendor-sidebar.tsx` | **삭제.** 유일한 소비처였던 포털 상세 화면이 §route-duplication 으로 폐기되며 고아가 됐다. `My Products`·`Settings`·`Logout` 세 링크를 함께 데려갔다 |
| `/vendor` 의 로그아웃 버튼 | **제거.** `/vendor/logout` 은 페이지도 라우트도 없다(404) |

⚠️ **내가 넣은 죽은 링크였다.** 폐기 커밋에서 `/vendor` 를 안내 화면으로 교체할 때
기존 화면의 로그아웃 버튼을 그대로 옮겨 왔는데, 그 대상이 존재하지 않는 경로였다.
"진입 경로도 같이 제거" 지시를 절반만 지킨 셈이다.

**sentinel**: `vendor-portal-rfq-retired.test.ts` R5 — 문자열 목록이 아니라 **구조 검사**다.
소스의 정적 `/vendor/...` 링크를 모아 대응 `page.tsx` 존재를 확인한다. 새 링크를
만들면서 화면을 안 만들면 자동 RED. corrupt→RED 실증 완료.

> R5 첫 작성본은 `src/app/api` 의 `routePath: '/vendor/billing'` 을 UI 링크로 오인해
> 오탐 2건을 냈다(`/vendor/billing`, `/vendor/premium`). API 디렉터리 제외 +
> `href=`/`push(`/`redirect(` 문맥 요구로 좁혔다.

## 1. 대조표 (2026-08-10 실측)

### 1-1. 화면

| 경로 | page.tsx | 상태 |
|---|---|---|
| `/vendor` | ✅ | 토큰 경로 안내 (§route-duplication 으로 교체) |
| `/vendor/[token]` | ✅ | **canonical 견적 회신 화면.** DB 기반 |
| `/vendor/dashboard` | ✅ | `/vendor` 리다이렉트 (mock 폐기) |
| `/vendor/login` | ✅ | 매직링크 요청 폼 — **아래 §2 참조** |
| ~~`/vendor/requests/[id]`~~ | ❌ | 폐기됨 |
| `/vendor/products` | ❌ | 사이드바가 가리켰으나 화면 없음 → 링크 제거로 해소 |
| `/vendor/settings` | ❌ | 동일 |
| `/vendor/logout` | ❌ | 동일. **로그아웃 수단 자체가 없다** |

### 1-2. API

| 라우트 | 구현 |
|---|---|
| `vendor/info` | DB |
| `vendor/insights` | DB |
| `vendor/quotes` | DB |
| `vendor/quotes/[quoteId]/response` | DB |
| `vendor/billing` | DB |
| `vendor/premium` | DB |
| `vendor/auth/send-link` | **스텁** — §2 |
| ~~`vendor/requests`~~ ~~`vendor/requests/[id]`~~ ~~`vendor/requests/[id]/respond`~~ ~~`vendor/stats`~~ | 폐기됨 |

## 2. ⚠️ 이번 실측에서 새로 드러난 것 — 벤더 로그인이 동작하지 않는다

`/api/vendor/auth/send-link` 는 **placeholder success** 다.

```ts
// TODO: Implement actual logic
// 1. Generate magic link token
// 2. Store token in DB with expiry (24h)
// 3. Send email with link
console.log("Sending login link to:", email);
return NextResponse.json({ success: true, message: "Login link sent" });
```

토큰 생성도, DB 저장도, 메일 발송도 없다. 그런데 `/vendor/login` 화면은 **보냈다고
알린다.**

### 함의

- **어떤 벤더도 포털에 로그인할 수 없다.** 링크가 영영 오지 않는다.
- 따라서 `/vendor`, `/vendor/dashboard`, 삭제한 사이드바는 **실제 벤더에게 도달
  불가능한 표면**이었다. 포털 전체가 mock 이었던 이유가 여기서 설명된다.
- 피해 성격은 `vendor/requests/[id]/respond` 와 같은 **양방향 정보 단절**이다:
  벤더는 메일함을 계속 확인하고, 운영자는 벤더가 로그인 시도했는지조차 모른다.
  자기교정 경로가 없다.

### 처리

**이번에는 고치지 않는다**(지시: 목록만). §placeholder-success-audit 에 등재하되,
피해 성격이 자기교정 불가 클래스라 **우선순위 재판단이 필요하다** — 판단은 호영님.

## 3. 등재 목록 (고치지 않음)

| # | 항목 | 클래스 |
|---|---|---|
| 1 | `vendor/auth/send-link` 매직링크 미구현 + 성공 반환 | placeholder success / 양방향 단절 |
| 2 | `/vendor/products` 화면 부재 | 기능 미구현 (링크는 제거됨) |
| 3 | `/vendor/settings` 화면 부재 | 동일 |
| 4 | `/vendor/logout` 부재 — 로그아웃 수단 없음 | 동일 |
| 5 | `/vendor/dashboard` 가 리다이렉트만 하는 빈 라우트 | 정리 대상(진입 경로 정리 후 삭제 가능) |

**전수 조사는 하지 않는다.** 벤더 표면에 한정한 대조표이며, 다른 도메인의
같은 클래스(링크 ↔ 화면 불일치)는 R5 sentinel 을 확장해 기계 검출할 수 있다.

## 4. 후속

- §vendor-portal-identity — 벤더 계정 체계가 서면 §2 를 포함해 포털을 새로 설계한다.
  **지금 것을 되살리는 트랙이 아니다.**
