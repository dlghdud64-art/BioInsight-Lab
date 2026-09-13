/**
 * §quote-scan-public-storage B (2026-09-13) · Vercel Blob access 단일 출처.
 *
 * 🛑 **access 는 파일이 아니라 스토어 단위다.** Vercel 문서: "Private storage requires a private
 *   Blob store" · 스토어의 access 는 생성 후 바꿀 수 없다. prod 스토어는 public 이다
 *   (2026-09-13 실측: 저장된 blob 6건의 호스트가 전부 `.public.`).
 *   → P0-b1·P0-b2 가 put 을 `"private"` 로 바꿨는데, public 스토어에서는 업로드가 거부되고
 *     호출부의 graceful 경로가 **조용히 건너뛰었다**(OcrJob·발주서 저장 0 · 화면 오류 없음).
 *
 * 그래서 업로드 access 는 **스토어 모드를 따르는 상수 하나**로 둔다. 파일마다 리터럴을 쓰면
 *   다음 사람이 한 곳만 바꿔 같은 사고를 낸다.
 *
 * 보호는 두 겹이다(호영님 B 판정 2026-09-13):
 *   ① 추측 불가 키 · 저장 키에 randomUUID. 파일 해시·발주번호처럼 **남이 가진 값으로 조립되는 키 금지**.
 *   ② 프록시 전용 노출 · blob URL 을 응답·DOM 에 싣지 않는다. 열람은 인증·조직 대조·감사를 거치는
 *      프록시 라우트(`/api/ocr/jobs/[jobId]/image` · `/api/orders/[id]/po-document`)가 한다.
 *
 * 🔑 private 스토어 전환(A)은 **실고객 견적서가 들어오기 전 런칭 체크리스트 항목**이다.
 *   전환할 때: private 스토어 생성·연결 → 아래 상수를 "private" 로 → 기존 blob 이관.
 *   읽기 쪽은 `blobReadAccess()` 가 URL 호스트로 판정하므로 이관 중 섞여 있어도 코드 변경이 없다.
 */

export type BlobAccess = "public" | "private";

/** 업로드 access · **prod 스토어 모드와 같아야 한다.** 스토어를 바꾸기 전에 이 값만 바꾸면 업로드가 끊긴다. */
export const BLOB_UPLOAD_ACCESS: BlobAccess = "public";

/**
 * 저장된 blob 위치를 읽을 때의 access.
 *   URL 이면 호스트(`<store>.private.blob…` / `<store>.public.blob…`)로 판정한다.
 *   경로(pathname)만 있으면 호스트가 없으므로 현재 업로드 access 를 쓴다.
 */
export function blobReadAccess(urlOrPathname: string): BlobAccess {
  let hostname: string;
  try {
    hostname = new URL(urlOrPathname).hostname;
  } catch {
    return BLOB_UPLOAD_ACCESS;
  }
  if (hostname.endsWith(".private.blob.vercel-storage.com")) return "private";
  if (hostname.endsWith(".public.blob.vercel-storage.com")) return "public";
  return BLOB_UPLOAD_ACCESS;
}
