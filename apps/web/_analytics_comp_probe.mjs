/**
 * §analytics-tabs — 지출 분석 탭 개선 시안 **렌더 실측** 프로브 (축 B 게이트 입력 도출기)
 *
 * 도출 이력 — 2026-08-16 · 컨테이너(Linux) · Chromium 1194 · playwright-core 1.49.1
 *   시안  C:/Users/young/Desktop/지출분석 탭 개선 (단독).html
 *   sha256 8edc9f9b21eb37933bcd38a061d55422d1a9a3780daeff4ceb93f11d95aa0a4e (22,741,557 bytes)
 *   실측  텍스트노드 40 (뷰포트 390/1440/1920/3840 전부 동일) · #dc-root 요소 65 · pageError 0
 *   계상  UI 24 + labels[0] 3 + annotation 10 + doc_header 3 = 40
 *
 * 산출: src/__tests__/fixtures/analytics-tabs-comp.render.json
 *       = 축 B(fixture ↔ 시안 실렌더) 대조의 **actual 측**.
 *
 * 🛑 이 프로브는 테스트가 부르지 않는다. **선도출 전용**이다.
 *    vitest 런타임에 22.7MB 시안을 렌더하면 게이트가 브라우저 가용성에 종속된다.
 *    시안 파일이 바뀌면(sha256 변경) 이 프로브를 다시 돌려 .render.json 을 갱신한다.
 *
 * 🛑 모집단 주의 — .render.json 에 명시해 내보낸다. 안 적으면 다음 세션이 81 을 불일치로 읽는다:
 *      #dc-root 서브트리(자기 자신 포함) = 65 요소   ← 시안 모집단
 *      document 전체                     = 81 요소   ← 번들러 로딩 UI 16 혼입. 대조 금지
 *
 * 🛑 border-width 는 **authored(specified) 문자열**로 뽑는다.
 *    Chromium 이 computed 를 정수 device px 로 스냅한다 (authored 2.5px → computed 2px).
 *    computed 로 검사하면 영구 RED. (fixture ._측정층 참조)
 *
 * 축 분리는 DOM 구조로 한다. 추측 아님:
 *   doc_header           #dc-root section > 첫 자식 (배지 + 제목 + 부제)
 *   section_badge        섹션 > children[0] 의 첫 텍스트노드 ('1a' '1b' '1c')  → annotation_excluded
 *   eyebrow (labels[0])  섹션 > children[0] 의 둘째 텍스트노드                 → 시안 자체 라벨
 *   annotation_excluded  frame 서브트리에서 computed border-style 이 dashed 인 박스
 *   ui_text              frame 서브트리 텍스트 − annotation
 *
 * 사용 (컨테이너):
 *   node _analytics_comp_probe.mjs --file "<시안.html>" --out analytics-tabs-comp.render.json \
 *        [--chrome /opt/pw-browsers/chromium-1194/chrome-linux/chrome]
 * ⚠️ `playwright install` 금지. 로컬에 이미 있는 Chromium 경로를 --chrome 으로 넘길 것.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
// playwright(레포) / playwright-core(격리 컨테이너) 둘 다 수용
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('playwright-core')); }

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FILE = arg('--file');
const OUT = arg('--out', 'analytics-tabs-comp.render.json');
const CHROME = arg('--chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const DERIVED_AT = arg('--derived-at', new Date().toISOString().slice(0, 10));
const DEVICE_PATH = arg('--device-path', '');
if (!FILE) throw new Error('--file <시안.html> 필요');

const VIEWPORTS = [390, 1440, 1920, 3840];
const NAMES = ['1a', '1b', '1c'];

let PW_VERSION = 'unknown';
for (const m of ['playwright/package.json', 'playwright-core/package.json']) {
  try { PW_VERSION = JSON.parse(fs.readFileSync(import.meta.resolve
    ? new URL(import.meta.resolve(m)).pathname : m, 'utf8')).version; break; } catch { /* noop */ }
}

const bytes = fs.statSync(FILE).size;
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(FILE)).digest('hex');

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});

const viewports = {};
let detail = null;

for (const w of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 2400 } });
  const page = await ctx.newPage();
  let pageErrors = 0, consoleErrors = 0;
  page.on('pageerror', () => { pageErrors += 1; });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors += 1; });

  await page.goto(pathToFileURL(path.resolve(FILE)).href, { waitUntil: 'load', timeout: 180000 });
  // 번들러 셸("Unpacking") 소멸 대기 — 정적 추출은 언팩 **전** 을 센다.
  await page.waitForFunction(() => !/Unpacking/.test(document.body.innerText), null,
    { timeout: 180000, polling: 500 });
  await page.waitForTimeout(6000);

  const out = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const nodesOf = (root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const a = []; let n;
      while ((n = w.nextNode())) if (norm(n.nodeValue)) a.push(n);
      return a;
    };
    const texts = (root) => nodesOf(root).map((n) => norm(n.nodeValue));

    const root = document.getElementById('dc-root');
    if (!root) throw new Error('#dc-root 없음 — 모집단 앵커 소실');
    const section = root.querySelector('section');
    const [head, row] = Array.from(section.children);

    const per = Array.from(row.children).map((sw) => {
      const cap = sw.children[0];         // 배지 + eyebrow
      const frame = sw.children[1];       // 프레임(폰/데스크톱) + 주석 박스
      const capT = texts(cap);

      const annoBoxes = Array.from(frame.querySelectorAll('*'))
        .filter((e) => getComputedStyle(e).borderStyle.split(' ')[0] === 'dashed');
      const annoNodes = new Set(annoBoxes.flatMap((b) => nodesOf(b)));
      const frameNodes = nodesOf(frame);

      // 🛑 토큰 3축(colors/radius/font_sizes)의 모집단 = **섹션 래퍼 서브트리**(배지 + eyebrow + 프레임 + 주석).
      //    프레임만 재면 섹션 배지의 radius 7px / font 11px / 배지색(1a #dc2626 · 1b #16a34a · 1c #1d4ed8)을 놓친다.
      const els = [sw, ...Array.from(sw.querySelectorAll('*'))];
      // 🛑 authored(specified) 값으로 잰다. computed 는 미지정 요소가 상속 16px / 0px 로 잡혀 모집단이 오염된다.
      const radius = new Set(), fsize = new Set();
      for (const e of els) {
        if (e.style.borderRadius) radius.add(parseFloat(e.style.borderRadius));
        if (e.style.fontSize) fsize.add(parseFloat(e.style.fontSize));
      }
      // colors — inline style 선언 색 토큰. 🛑 computed 아님(미지정 요소가 #000 으로 잡혀 모집단이 달라진다).
      const styleStrings = els.map((e) => e.getAttribute('style') || '').join(' ');

      // authored(specified) border-width — computed 스냅 회피용
      const authoredBorders = els
        .map((e) => ({
          tag: e.tagName,
          text: norm(e.textContent).slice(0, 24),
          authored_border_bottom_width: e.style.borderBottomWidth || '',
          authored_border_bottom: e.style.borderBottom || '',
          computed_border_bottom_width: getComputedStyle(e).borderBottomWidth,
          authored_border_radius: e.style.borderRadius || '',
          authored_padding: e.style.padding || '',
          authored_background: e.style.background || '',
        }))
        .filter((r) => r.authored_border_bottom_width || r.authored_border_bottom);

      return {
        section_badge: capT[0],
        eyebrow: capT[1],
        ui: frameNodes.filter((n) => !annoNodes.has(n)).map((n) => norm(n.nodeValue)),
        annotation_box: annoBoxes.flatMap((b) => texts(b)),
        element_count: els.length,
        radius: [...radius].sort((a, b) => a - b),
        font_sizes: [...fsize].sort((a, b) => a - b),
        styleStrings,
        authoredBorders,
        tab_row_spans: (() => {
          // 탭 행 = '종합 현황' 을 직접 담은 요소의 부모
          const t = Array.from(frame.querySelectorAll('*'))
            .find((e) => norm(e.textContent) === '종합 현황' && e.children.length === 0);
          if (!t) return null;
          return Array.from(t.parentElement.children).map((e) => ({
            tag: e.tagName,
            text: norm(e.textContent),
            authored_style: e.getAttribute('style') || '',
            authored_border_bottom_width: e.style.borderBottomWidth || '',
            authored_border_radius: e.style.borderRadius || '',
            authored_padding: e.style.padding || '',
            authored_background: e.style.background || '',
            computed_border_bottom_width: getComputedStyle(e).borderBottomWidth,
            computed_border_radius: getComputedStyle(e).borderTopLeftRadius,
          }));
        })(),
      };
    });

    return {
      doc_header: texts(head),
      text_nodes: texts(root),
      per,
      text_node_total: texts(root).length,
      element_count_root: root.querySelectorAll('*').length + 1,
      element_count_body: document.body.querySelectorAll('*').length,
      element_count_document: document.querySelectorAll('*').length,
    };
  });

  viewports[String(w)] = {
    viewport: `${w}x2400`,
    text_nodes: out.text_node_total,
    elements: out.element_count_root,
    element_count_document: out.element_count_document,
    pageError: pageErrors,
    consoleError: consoleErrors,
  };
  console.log(w, 'textNodes=', out.text_node_total, 'els(#dc-root)=', out.element_count_root,
    'els(document)=', out.element_count_document, 'pageErr=', pageErrors);
  if (w === 1440) detail = out;
  await ctx.close();
}
await browser.close();

// colors — rgb()/#hex 토큰 계상. 3자리 shorthand 는 6자리로 확장 (이 시안은 shorthand 를 쓴다).
const hex = (r, g, b) => '#' + [r, g, b].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
const colorsOf = (styleStrings) => {
  const toks = [];
  for (const m of styleStrings.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g)) {
    const h = hex(m[1], m[2], m[3]);
    toks.push(m[4] !== undefined && Number(m[4]) < 1 ? `${h}@${m[4]}` : h);
  }
  for (const m of styleStrings.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const v = m[1];
    toks.push('#' + (v.length === 3 ? v.split('').map((c) => c + c).join('') : v).toLowerCase());
  }
  const c = {};
  for (const t of toks) c[t] = (c[t] || 0) + 1;
  return { colors: Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1])), sum: toks.length };
};

const sections = {};
detail.per.forEach((s, i) => {
  const { colors, sum } = colorsOf(s.styleStrings);
  sections[NAMES[i]] = {
    section_badge: s.section_badge,
    eyebrow: s.eyebrow,
    ui: s.ui,
    ui_count: s.ui.length,
    annotation_box: s.annotation_box,
    annotation_excluded_count: 1 + s.annotation_box.length, // 섹션 배지 1 + 주석 박스 n
    element_count: s.element_count,
    radius: s.radius,
    font_sizes: s.font_sizes,
    colors,
    colors_items: Object.keys(colors).length,
    colors_sum: sum,
    authored_borders: s.authoredBorders,
    tab_row: s.tab_row_spans,
  };
});

const uiTotal = Object.values(sections).reduce((n, s) => n + s.ui_count, 0);
const eyebrowTotal = Object.values(sections).filter((s) => s.eyebrow).length;
const annoTotal = Object.values(sections).reduce((n, s) => n + s.annotation_excluded_count, 0);
const docHeaderTotal = detail.doc_header.length;

const result = {
  _생성: '_analytics_comp_probe.mjs — 선도출 산출물. 테스트 런타임에 렌더하지 않는다.',
  _축: '축 B(fixture ↔ 시안 실렌더)의 **actual** 측. 축 C(fixture ↔ 제품 화면)는 미배선.',
  source: path.basename(FILE),
  source_path: DEVICE_PATH || path.resolve(FILE),
  source_sha256: sha256,
  source_bytes: bytes,
  derived_at: DERIVED_AT,
  engine: {
    browser: 'Chromium 141 (playwright chromium-1194 번들)',
    executable: CHROME,
    playwright_core: PW_VERSION,
    host: 'cloud container (Linux x64)',
    device_scale_factor: 1,
  },
  extraction: {
    load: "file:// · waitUntil 'load' (timeout 180s)",
    settle: "document.body.innerText 에서 'Unpacking' 소멸 대기 + 6000ms",
    walker: 'TreeWalker(NodeFilter.SHOW_TEXT)',
    normalize: "nodeValue.replace(/\\s+/g,' ').trim()",
    exclude: '정규화 후 빈 문자열 제외',
    border_width: "authored(element.style.*) 문자열. 🛑 computed 아님 — Chromium 이 2.5px → 2px 로 스냅한다",
    colors: 'inline style 선언 토큰. 3자리 shorthand → 6자리 확장. computed 아님(모집단 상이)',
    radius_font: '섹션 래퍼 + 전 자손 요소의 **authored** style.borderRadius / style.fontSize. 텍스트노드 부모만 재지 않는다(컨테이너 radius 누락 방지)',
    token_population: '토큰 3축 모집단 = 섹션 래퍼 서브트리(배지 + eyebrow + 프레임 + 주석). 프레임만 재면 배지 토큰(radius 7 · font 11 · 배지색)을 놓친다',
  },
  population: {
    '🛑': '모집단을 섞지 말 것. 아래 두 수는 다른 집합이다.',
    text_nodes: '#dc-root 서브트리 전수 — 40',
    elements: '#dc-root 서브트리 (자기 자신 포함) — 65   ← 시안 모집단. fixture ._앵커.render_element_count 와 대조하는 값',
    _document_주의: `document 전체 — ${detail.element_count_document}. 번들러 로딩 UI ${detail.element_count_document - detail.element_count_root} 요소 혼입. **65 와 대조 금지**`,
    element_count_document: detail.element_count_document,
    element_count_body: detail.element_count_body,
    element_count_root: detail.element_count_root,
  },
  viewports_tested: [390, 1440, 1920, 3840],
  viewports,
  page_errors: Object.values(viewports).reduce((n, v) => n + v.pageError, 0),
  console_errors: Object.values(viewports).reduce((n, v) => n + v.consoleError, 0),
  text_node_total: detail.text_node_total,
  text_nodes: detail.text_nodes,
  counts: {
    ui_text: uiTotal,
    eyebrow_labels0: eyebrowTotal,
    annotation_excluded: annoTotal,
    doc_header_excluded: docHeaderTotal,
    sum: uiTotal + eyebrowTotal + annoTotal + docHeaderTotal,
    _주의: '합계만 대조하면 축이 안 잡힌다. 4항 각각 개별 단언할 것.',
  },
  doc_header: detail.doc_header,
  sections,
};
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ counts: result.counts, viewports, sha256 }, null, 2));
