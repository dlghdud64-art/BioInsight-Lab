#!/usr/bin/env node
/**
 * LabAxis Agent Board — Production Auth State Capture
 *
 * 사용법:
 *   node apps/web/scripts/capture-auth-state.mjs
 *
 * 결과:
 *   labaxis-storage-state.json (현재 디렉토리에 저장)
 *
 * 이 파일을 GitHub secret LABAXIS_STORAGE_STATE_JSON 에 등록하면
 * Agent Board가 인증 없이 /dashboard/quotes 에 직접 접근할 수 있습니다.
 *
 * 등록 방법:
 *   cat labaxis-storage-state.json | gh secret set LABAXIS_STORAGE_STATE_JSON
 *   또는
 *   GitHub → Repo Settings → Secrets → LABAXIS_STORAGE_STATE_JSON 값으로 붙여넣기
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { resolve } from "path";

const TARGET_URL = "https://www.labaxis.co.kr";
const SIGNIN_PATH = "/auth/signin";
const OUT_FILE = resolve(process.cwd(), "labaxis-storage-state.json");
const TIMEOUT_MS = 3 * 60 * 1000; // 3분 (Google OAuth 로그인 시간)

async function main() {
  console.log("=== LabAxis Production Auth State Capture ===");
  console.log(`대상 URL: ${TARGET_URL}`);
  console.log(`출력 파일: ${OUT_FILE}`);
  console.log("");
  console.log("브라우저가 열립니다. Google 계정으로 로그인하세요.");
  console.log("대시보드로 이동되면 자동으로 state가 캡처됩니다.");
  console.log("");

  const browser = await chromium.launch({
    headless: false, // 사용자가 직접 로그인해야 함
    slowMo: 50,
  });

  const context = await browser.newContext({
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });

  const page = await context.newPage();

  try {
    // 로그인 페이지로 이동
    await page.goto(`${TARGET_URL}${SIGNIN_PATH}`, { waitUntil: "networkidle" });
    console.log("로그인 페이지 열림. 로그인을 완료하세요...");

    // 대시보드 또는 /app/ 로 이동할 때까지 대기
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/dashboard") ||
        url.pathname.startsWith("/app/"),
      { timeout: TIMEOUT_MS }
    );

    console.log(`✅ 로그인 성공: ${page.url()}`);

    // Auth.js v5 쿠키 확인
    const cookies = await context.cookies();
    const authCookie = cookies.find(
      (c) =>
        c.name === "__Secure-authjs.session-token" ||
        c.name === "authjs.session-token" ||
        c.name === "next-auth.session-token"
    );

    if (authCookie) {
      console.log(`✅ Auth 쿠키 발견: ${authCookie.name} (domain: ${authCookie.domain})`);
    } else {
      console.warn("⚠️  Auth 쿠키를 찾을 수 없습니다. 로그인이 완료됐는지 확인하세요.");
      const cookieNames = cookies.map((c) => c.name).join(", ");
      console.warn(`   현재 쿠키: ${cookieNames || "(없음)"}`);
    }

    // storage state 저장
    await context.storageState({ path: OUT_FILE });
    console.log("");
    console.log(`✅ Storage state 저장 완료: ${OUT_FILE}`);
    console.log("");
    console.log("─".repeat(60));
    console.log("다음 명령으로 GitHub secret을 등록하세요:");
    console.log("");
    console.log("  # GitHub CLI 사용 (권장)");
    console.log("  cat labaxis-storage-state.json | gh secret set LABAXIS_STORAGE_STATE_JSON");
    console.log("");
    console.log("  # 또는 GitHub 웹 UI");
    console.log("  Repo → Settings → Secrets → Actions → LABAXIS_STORAGE_STATE_JSON");
    console.log("─".repeat(60));
  } catch (err) {
    if (err.message?.includes("Timeout")) {
      console.error(`❌ 타임아웃: ${TIMEOUT_MS / 1000}초 안에 로그인이 완료되지 않았습니다.`);
    } else {
      console.error("❌ 오류:", err.message);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
