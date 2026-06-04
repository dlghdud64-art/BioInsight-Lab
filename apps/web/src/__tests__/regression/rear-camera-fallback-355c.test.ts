import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const UTIL = "src/lib/utils/get-rear-camera-stream.ts";
const MODAL = "src/components/inventory/LabelScannerModal.tsx";

describe("§11.355-C — 후면 카메라 4단계 fallback util", () => {
  it("getRearCameraStream export", () => {
    const src = read(UTIL);
    expect(src).toMatch(/export async function getRearCameraStream\(\)/);
  });

  it("4단계 fallback 모두 존재: exact env → env → enumerate label → video true", () => {
    const src = read(UTIL);
    expect(src).toMatch(/facingMode:\s*\{\s*exact:\s*"environment"\s*\}/); // 1차
    expect(src).toMatch(/facingMode:\s*"environment"/); // 2차
    expect(src).toMatch(/enumerateDevices\(\)/); // 3차
    expect(src).toMatch(/back\|rear\|environment\|후면/); // 3차 후면 label
    expect(src).toMatch(/deviceId:\s*\{\s*exact:\s*rear\.deviceId\s*\}/); // 3차 deviceId
    expect(src).toMatch(/getUserMedia\(\{\s*video:\s*true/); // 4차 최후
  });

  it("3차는 videoinput 만 대상", () => {
    const src = read(UTIL);
    expect(src).toMatch(/d\.kind === "videoinput"/);
  });

  describe("LabelScannerModal 적용", () => {
    it("getRearCameraStream import + 호출", () => {
      const src = read(MODAL);
      expect(src).toMatch(
        /import \{ getRearCameraStream \} from "@\/lib\/utils\/get-rear-camera-stream"/
      );
      expect(src).toMatch(/stream = await getRearCameraStream\(\)/);
    });

    it("기존 단일 getUserMedia(facingMode environment) 직접 호출 제거", () => {
      const src = read(MODAL);
      // 카메라 라이브 획득부에서 직접 facingMode environment 단일 호출이 사라짐.
      expect(src).not.toMatch(
        /getUserMedia\(\{\s*video:\s*\{\s*facingMode:\s*"environment"\s*\},/
      );
    });

    it("권한 거부 시 파일 업로드 안내 catch 보존", () => {
      const src = read(MODAL);
      expect(src).toMatch(/카메라를 사용할 수 없습니다\. 파일 업로드로 진행하세요\./);
    });
  });
});
