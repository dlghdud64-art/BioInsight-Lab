/**
 * §11.355-C #rear-camera-fallback — 후면 카메라 스트림 공통 획득 util.
 *
 * 문제: getUserMedia({ facingMode: "environment" }) 단일 시도는 일부 기기/
 *   브라우저에서 후면을 못 잡거나 전면으로 떨어진다. 라벨/QR 스캔은 후면이
 *   필수이므로 단계적 fallback 으로 후면 획득 성공률을 높인다.
 *
 * 단계:
 *   1차 exact environment      — iOS Safari / Android Chrome 후면 강제.
 *   2차 environment (loose)     — 구형/호환 브라우저.
 *   3차 enumerateDevices label  — 후면 라벨(back/rear/environment/후면) deviceId 직접.
 *   4차 video:true (최후)        — 카메라라도 띄움(전면 가능, 실패보다 나음).
 *
 * 주의: enumerateDevices 의 label 은 카메라 권한 부여 전엔 빈 문자열이다.
 *   1·2차에서 권한 prompt 가 먼저 일어나므로 3차 시점엔 label 이 채워진다.
 *   권한 자체가 거부되면 모든 단계가 throw → 호출부가 catch 하여 파일 업로드
 *   fallback 으로 안내한다 (기존 동작 보존).
 */
export async function getRearCameraStream(): Promise<MediaStream> {
  const md = navigator.mediaDevices;

  // 1차: exact environment
  try {
    return await md.getUserMedia({
      video: { facingMode: { exact: "environment" } },
      audio: false,
    });
  } catch {
    /* 다음 단계로 */
  }

  // 2차: environment (loose)
  try {
    return await md.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
  } catch {
    /* 다음 단계로 */
  }

  // 3차: enumerateDevices 에서 후면 label deviceId 직접 지정
  try {
    const devices = await md.enumerateDevices();
    const rear = devices.find(
      (d) =>
        d.kind === "videoinput" &&
        /back|rear|environment|후면/i.test(d.label),
    );
    if (rear?.deviceId) {
      return await md.getUserMedia({
        video: { deviceId: { exact: rear.deviceId } },
        audio: false,
      });
    }
  } catch {
    /* 다음 단계로 */
  }

  // 4차 최후: 기본 카메라 (전면 가능 — 완전 실패보다 나음)
  return await md.getUserMedia({ video: true, audio: false });
}
