/**
 * dedupe-react.js
 *
 * 모노레포 환경(npm workspaces)에서 Vercel이 react-dom을
 * apps/web/node_modules 에 별도 설치해 root/node_modules/react 와
 * 서로 다른 React 인스턴스를 만드는 문제를 해결한다.
 *
 * styled-jsx (root) 가 root/react 의 useContext 를 호출할 때
 * react-dom-server (apps/web) 이 초기화한 것은 apps/web/react 쪽이라
 * null 참조 에러 → /404, /500 prerender 실패.
 *
 * 이 스크립트는 postinstall 단계에서 apps/web 내부의 react, react-dom,
 * styled-jsx 중 root 에 동일 버전이 있는 경우 nested 복사본을 제거해
 * Node.js 모듈 resolution 이 root 로 fallback 되도록 강제한다.
 */

const fs = require("fs");
const path = require("path");

const LOCAL_NODE_MODULES = path.resolve(__dirname, "..", "node_modules");
const ROOT_NODE_MODULES = path.resolve(__dirname, "..", "..", "..", "node_modules");

const PACKAGES_TO_DEDUPE = ["react", "react-dom", "styled-jsx"];

function readVersion(pkgPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgPath, "package.json"), "utf8"));
    return pkg.version;
  } catch {
    return null;
  }
}

function rmrf(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  } catch (e) {
    console.warn(`[dedupe-react] 삭제 실패: ${target} — ${e.message}`);
    return false;
  }
}

let removed = 0;
for (const pkg of PACKAGES_TO_DEDUPE) {
  const localPath = path.join(LOCAL_NODE_MODULES, pkg);
  const rootPath = path.join(ROOT_NODE_MODULES, pkg);

  if (!fs.existsSync(localPath)) continue; // local 에 없으면 문제 없음
  if (!fs.existsSync(rootPath)) {
    console.log(`[dedupe-react] ${pkg}: root 에 없음 — 건너뜀 (local 유지)`);
    continue;
  }

  const localVer = readVersion(localPath);
  const rootVer = readVersion(rootPath);

  if (localVer === rootVer) {
    if (rmrf(localPath)) {
      console.log(`[dedupe-react] ${pkg}@${localVer}: local 복사본 제거 → root fallback`);
      removed++;
    }
  } else {
    console.log(`[dedupe-react] ${pkg}: 버전 불일치 (local=${localVer}, root=${rootVer}) — 수동 확인 필요`);
  }
}

console.log(`[dedupe-react] 완료: ${removed}개 중복 제거`);
