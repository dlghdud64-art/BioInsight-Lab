/**
 * §reorder-handoff — 재발주 견적 핸드오프 시안 fixture 도출 프로브
 *
 * 산출: src/__tests__/fixtures/reorder-handoff-comp.json 의 **실측 필드**
 *       (labels / doc_labels / annotation_excluded / attr_labels / colors / radius / font_sizes)
 *
 * 🛑 이 프로브는 **클라우드 컨테이너(Linux)** 에서 돌린 것이다. 호영님 Windows 에서
 *    그대로 돌지 않는다 — `--chrome` 로 로컬 Chrome/Chromium 경로를 넘겨야 한다.
 *    (도출 당시: /opt/pw-browsers/chromium-1194/chrome-linux/chrome · Playwright 1.56.0)
 *
 * 축 분리는 **DOM 구조**로 한다. 추측 아님:
 *   doc_label            화면 배지 행   position:absolute (top:-26px)
 *   ui_text              phone frame    width:390px; border-radius:24px; box-shadow
 *   annotation_excluded  해설 카드      phone frame 의 형제 (margin-top:10px)
 *   attr_label           placeholder/aria-label/title/alt/value — 텍스트노드 축에 안 잡힘
 *
 * 사용:
 *   node _reorder_comp_probe.mjs --file "<시안.html>" --out out.json [--chrome <path>]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : d;
};
const FILE = arg('--file');
const OUT = arg('--out', 'reorder-comp-render.json');
const CHROME = arg('--chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
if (!FILE) throw new Error('--file <시안.html> 필요');

const VIEWPORTS = [390, 1440, 1920, 3840];
const NAMES = ['1a', '1b', '1c', '1d'];

const browser = await chromium.launch({ executablePath: CHROME });
const rep = { source: path.basename(FILE), viewports: [], pageErrors: 0, consoleErrors: 0 };

for (const w of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 2400 } });
  const page = await ctx.newPage();
  page.on('pageerror', () => { rep.pageErrors += 1; });
  page.on('console', (m) => { if (m.type() === 'error') rep.consoleErrors += 1; });

  await page.goto(pathToFileURL(path.resolve(FILE)).href, { waitUntil: 'load', timeout: 180000 });
  // 언팩 대기 — 번들러 셸("Unpacking") 소멸까지. 정적 추출은 언팩 **전** 을 센다.
  await page.waitForFunction(() => !/Unpacking/.test(document.body.innerText), null,
    { timeout: 180000, polling: 500 });
  await page.waitForTimeout(6000);

  const out = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const texts = (root) => {
      if (!root) return [];
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const a = []; let n;
      while ((n = w.nextNode())) { const t = norm(n.nodeValue); if (t) a.push(t); }
      return a;
    };
    const screens = Array.from(document.querySelector('section').children);
    const per = screens.map((sw) => {
      const kids = Array.from(sw.children);
      const badge = kids.find((k) => getComputedStyle(k).position === 'absolute');
      const rest = kids.filter((k) => k !== badge);
      const frame = rest[0];
      const anno = rest[1];
      const els = [frame, ...Array.from(frame.querySelectorAll('*'))];
      const radius = {}, fsize = {}, fvn = {};
      for (const e of els) {
        const c = getComputedStyle(e);
        radius[c.borderTopLeftRadius] = (radius[c.borderTopLeftRadius] || 0) + 1;
        fsize[c.fontSize] = (fsize[c.fontSize] || 0) + 1;
        fvn[c.fontVariantNumeric] = (fvn[c.fontVariantNumeric] || 0) + 1;
      }
      const attrs = [];
      for (const e of els) {
        for (const a of ['placeholder', 'aria-label', 'title', 'alt', 'value']) {
          const v = e.getAttribute(a);
          if (v && v.trim()) attrs.push({ tag: e.tagName, attr: a, value: v.trim() });
        }
      }
      return {
        doc_labels: texts(badge),
        ui: texts(frame),
        annotation_excluded: texts(anno),
        attrs,
        element_count: els.length,
        styleStrings: els.map((e) => e.getAttribute('style') || '').join(' '),
        radius, fsize, fvn,
      };
    });
    const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let total = 0, n;
    while ((n = w2.nextNode())) if (norm(n.nodeValue)) total += 1;
    return {
      per,
      text_node_total: total,
      element_count_body: document.body.querySelectorAll('*').length,
      element_count_document: document.querySelectorAll('*').length,
    };
  });

  rep.viewports.push({
    vp: `${w}x2400`,
    text_node_total: out.text_node_total,
    element_count_body: out.element_count_body,
    element_count_document: out.element_count_document,
  });
  if (w === 1440) rep.detail = out;
  await ctx.close();
}
await browser.close();

// colors — phone frame 이하 inline style 선언 색 토큰. rgb()→hex 정규화.
// 🛑 렌더 computed 가 아니다. computed 는 미지정 요소가 #000000 으로 잡혀 모집단이 다르다.
const hex = (r, g, b) => '#' + [r, g, b].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
const sections = {};
rep.detail.per.forEach((s, i) => {
  const toks = [];
  for (const m of s.styleStrings.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g)) {
    const h = hex(m[1], m[2], m[3]);
    toks.push(m[4] !== undefined && Number(m[4]) < 1 ? `${h}@${m[4]}` : h);
  }
  for (const m of s.styleStrings.matchAll(/#[0-9a-fA-F]{6}\b/g)) toks.push(m[0].toLowerCase());
  const colors = {};
  for (const t of toks) colors[t] = (colors[t] || 0) + 1;
  sections[NAMES[i]] = {
    label_count: s.ui.length,
    element_count: s.element_count,
    labels: s.ui,
    doc_labels: s.doc_labels,
    annotation_excluded: s.annotation_excluded,
    annotation_excluded_count: s.annotation_excluded.length,
    attr_labels: s.attrs,
    colors: Object.fromEntries(Object.entries(colors).sort((a, b) => b[1] - a[1])),
    colors_items: Object.keys(colors).length,
    colors_sum: toks.length,
    radius: [...new Set(Object.keys(s.radius).map((r) => parseFloat(r)))].sort((a, b) => a - b),
    font_sizes: [...new Set(Object.keys(s.fsize).map((f) => parseFloat(f)))].sort((a, b) => a - b),
    font_variant_numeric: s.fvn,
  };
});

const result = {
  source: rep.source,
  viewports: rep.viewports,
  pageErrors: rep.pageErrors,
  consoleErrors: rep.consoleErrors,
  text_node_total: rep.detail.text_node_total,
  element_count_body: rep.detail.element_count_body,
  element_count_document: rep.detail.element_count_document,
  ui_text_total: Object.values(sections).reduce((n, s) => n + s.label_count, 0),
  doc_label_total: Object.values(sections).reduce((n, s) => n + s.doc_labels.length, 0),
  annotation_excluded_total: Object.values(sections).reduce((n, s) => n + s.annotation_excluded_count, 0),
  attr_label_total: Object.values(sections).reduce((n, s) => n + s.attr_labels.length, 0),
  sections,
};
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  viewports: rep.viewports,
  pageErrors: rep.pageErrors,
  ui_text_total: result.ui_text_total,
  doc_label_total: result.doc_label_total,
  annotation_excluded_total: result.annotation_excluded_total,
  attr_label_total: result.attr_label_total,
}, null, 2));
