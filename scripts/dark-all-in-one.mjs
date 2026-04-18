/**
 * All-in-one dark: conversion script
 * 1. Remove dark: prefix (dark:bg-slate-900 → bg-slate-900)
 * 2. Remove light counterpart when dark equivalent exists in same class string
 * 3. Deduplicate identical classes
 *
 * ONLY processes the specific 31 target files.
 */
import { readFileSync, writeFileSync } from 'fs';

const files = [
  'apps/web/src/components/ai/inventory-ai-assistant-panel.tsx',
  'apps/web/src/components/ai/order-ai-assistant-panel.tsx',
  'apps/web/src/components/ai/quote-ai-assistant-panel.tsx',
  'apps/web/src/app/dashboard/reports/page.tsx',
  'apps/web/src/app/dashboard/analytics/_components/team-analytics-view.tsx',
  'apps/web/src/app/dashboard/analytics/page.tsx',
  'apps/web/src/app/dashboard/analytics/monthly/page.tsx',
  'apps/web/src/app/dashboard/budget/[id]/page.tsx',
  'apps/web/src/app/dashboard/budget/[id]/loading.tsx',
  'apps/web/src/app/dashboard/budget/page.tsx',
  'apps/web/src/app/dashboard/budget/details/[id]/page.tsx',
  'apps/web/src/app/dashboard/analytics/category/page.tsx',
  'apps/web/src/app/dashboard/organizations/[id]/page.tsx',
  'apps/web/src/app/dashboard/organizations/page.tsx',
  'apps/web/src/app/dashboard/purchases/page.tsx',
  'apps/web/src/app/dashboard/billing/page.tsx',
  'apps/web/src/app/dashboard/settings/plans/page.tsx',
  'apps/web/src/app/dashboard/settings/page.tsx',
  'apps/web/src/app/dashboard/pricing/page.tsx',
  'apps/web/src/app/dashboard/audit/page.tsx',
  'apps/web/src/app/dashboard/safety/page.tsx',
  'apps/web/src/app/dashboard/inventory/page.tsx',
  'apps/web/src/app/_components/dashboard-sidebar.tsx',
  'apps/web/src/components/dashboard/executive-dashboard.tsx',
  'apps/web/src/components/inventory/GlobalQRScannerModal.tsx',
  'apps/web/src/app/_components/features-showcase-section.tsx',
  'apps/web/src/app/_components/page-header.tsx',
  'apps/web/src/components/inventory/import-wizard.tsx',
  'apps/web/src/components/inventory/InventoryQRCode.tsx',
  'apps/web/src/components/inventory/InventoryTable.tsx',
  'apps/web/src/components/bioinsight-logo.tsx',
];

// Light classes → dark equivalents
const LIGHT_TO_DARK = {
  'bg-white': 'bg-slate-900',
  'bg-gray-50': 'bg-slate-900',
  'bg-gray-100': 'bg-slate-800',
  'bg-gray-200': 'bg-slate-800',
  'bg-slate-50': 'bg-slate-900',
  'bg-slate-100': 'bg-slate-800',
  'bg-slate-200': 'bg-slate-800',
  'bg-red-50': 'bg-red-950/30',
  'bg-red-100': 'bg-red-900/40',
  'bg-amber-50': 'bg-amber-950/30',
  'bg-amber-100': 'bg-amber-900/40',
  'bg-orange-50': 'bg-orange-950/20',
  'bg-orange-100': 'bg-orange-900/40',
  'bg-blue-50': 'bg-blue-950/20',
  'bg-blue-100': 'bg-blue-900/30',
  'bg-emerald-50': 'bg-emerald-900/20',
  'bg-emerald-100': 'bg-emerald-900/40',
  'bg-green-50': 'bg-green-900/20',
  'bg-green-100': 'bg-green-900/30',
  'bg-purple-50': 'bg-purple-900/20',
  'bg-purple-100': 'bg-purple-900/30',
  'bg-yellow-50': 'bg-yellow-900/20',
  'bg-yellow-100': 'bg-yellow-900/40',
  'bg-indigo-50': 'bg-indigo-900/20',
  'bg-indigo-100': 'bg-indigo-900/30',
  'bg-pink-50': 'bg-pink-900/20',
  'bg-teal-50': 'bg-teal-900/20',
  'bg-cyan-50': 'bg-cyan-900/20',
  'bg-violet-50': 'bg-violet-900/20',
  // Text
  'text-gray-900': 'text-slate-100',
  'text-gray-800': 'text-slate-200',
  'text-gray-700': 'text-slate-300',
  'text-gray-600': 'text-slate-400',
  'text-gray-500': 'text-slate-400',
  'text-gray-400': 'text-slate-500',
  'text-slate-900': 'text-slate-100',
  'text-slate-800': 'text-slate-200',
  'text-slate-700': 'text-slate-300',
  'text-slate-600': 'text-slate-400',
  'text-red-700': 'text-red-300',
  'text-red-800': 'text-red-300',
  'text-amber-700': 'text-amber-300',
  'text-amber-800': 'text-amber-300',
  'text-orange-700': 'text-orange-300',
  'text-orange-800': 'text-orange-300',
  'text-blue-700': 'text-blue-300',
  'text-blue-800': 'text-blue-300',
  'text-green-700': 'text-green-300',
  'text-green-800': 'text-green-300',
  'text-emerald-700': 'text-emerald-300',
  'text-emerald-800': 'text-emerald-300',
  'text-purple-700': 'text-purple-300',
  'text-purple-800': 'text-purple-300',
  'text-indigo-700': 'text-indigo-300',
  'text-yellow-700': 'text-yellow-300',
  'text-teal-700': 'text-teal-300',
  'text-pink-700': 'text-pink-300',
  'text-violet-700': 'text-violet-300',
  'text-cyan-700': 'text-cyan-300',
  // text-X00 → 400 (for readability on dark)
  'text-red-600': 'text-red-400',
  'text-amber-600': 'text-amber-400',
  'text-orange-600': 'text-orange-400',
  'text-blue-600': 'text-blue-400',
  'text-green-600': 'text-green-400',
  'text-emerald-600': 'text-emerald-400',
  'text-purple-600': 'text-purple-400',
  'text-indigo-600': 'text-indigo-400',
  'text-teal-600': 'text-teal-400',
  'text-pink-600': 'text-pink-400',
  'text-violet-600': 'text-violet-400',
  'text-cyan-600': 'text-cyan-400',
  'text-yellow-600': 'text-yellow-400',
  // Borders
  'border-gray-100': 'border-slate-800',
  'border-gray-200': 'border-slate-800',
  'border-gray-300': 'border-slate-700',
  'border-slate-100': 'border-slate-800',
  'border-slate-200': 'border-slate-800',
  'border-slate-300': 'border-slate-700',
  'border-red-100': 'border-red-800',
  'border-red-200': 'border-red-800',
  'border-amber-100': 'border-amber-800',
  'border-amber-200': 'border-amber-800',
  'border-orange-100': 'border-orange-800',
  'border-orange-200': 'border-orange-800',
  'border-blue-100': 'border-blue-800',
  'border-blue-200': 'border-blue-800',
  'border-green-200': 'border-green-800',
  'border-emerald-200': 'border-emerald-800',
  'border-purple-200': 'border-purple-800',
  'border-yellow-200': 'border-yellow-800',
  'border-indigo-200': 'border-indigo-800',
  // Divide
  'divide-gray-200': 'divide-slate-800',
  'divide-slate-200': 'divide-slate-800',
  // Hover
  'hover:bg-gray-50': 'hover:bg-slate-800',
  'hover:bg-gray-100': 'hover:bg-slate-800',
  'hover:bg-slate-50': 'hover:bg-slate-800',
  'hover:bg-slate-100': 'hover:bg-slate-800',
  'hover:bg-white': 'hover:bg-slate-800',
  'hover:bg-amber-50': 'hover:bg-amber-950/30',
  'hover:bg-blue-50': 'hover:bg-blue-950/20',
  'hover:bg-red-50': 'hover:bg-red-950/30',
  // Ring
  'ring-gray-200': 'ring-slate-800',
  'ring-gray-300': 'ring-slate-700',
  // Shadow
  'shadow-sm': 'shadow-none',
  'shadow-md': 'shadow-none',
};

function processClassString(str) {
  // Don't process strings with template expressions
  if (str.includes('${')) return str;

  let tokens = str.split(/\s+/).filter(Boolean);
  const result = [];

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];

    // Step 1: If it's a dark: prefixed class, remove the prefix
    if (token.startsWith('dark:')) {
      const darkValue = token.slice(5);
      // Check if previous token is the light counterpart
      if (result.length > 0) {
        const prev = result[result.length - 1];
        const prevPrefix = getUtilityPrefix(prev);
        const darkPrefix = getUtilityPrefix(darkValue);
        if (prevPrefix && prevPrefix === darkPrefix) {
          // Remove the light counterpart
          result.pop();
        }
      }
      token = darkValue;
    }

    result.push(token);
  }

  // Step 2: Convert remaining light classes
  const finalResult = [];
  for (const token of result) {
    if (LIGHT_TO_DARK[token]) {
      // Only convert if there isn't already a dark equivalent in the result
      const darkEquiv = LIGHT_TO_DARK[token];
      if (!result.includes(darkEquiv) && !finalResult.includes(darkEquiv)) {
        finalResult.push(darkEquiv);
      } else {
        // Dark equivalent already exists, skip this light class
        continue;
      }
    } else {
      finalResult.push(token);
    }
  }

  // Step 3: Deduplicate exact matches
  const seen = new Set();
  const deduped = [];
  for (const token of finalResult) {
    if (!seen.has(token)) {
      seen.add(token);
      deduped.push(token);
    }
  }

  return deduped.join(' ');
}

function getUtilityPrefix(cls) {
  const m = cls.match(/^((?:hover:|focus:|active:|group-hover:)*(?:bg|text|border|ring|divide|shadow|from|to|via|fill|stroke|outline|decoration|accent|caret|placeholder)-)/);
  return m ? m[1] : null;
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const original = content;

  // Process double-quoted strings containing Tailwind classes
  content = content.replace(/"([^"]+)"/g, (match, inner) => {
    if (!inner.includes('dark:') && !Object.keys(LIGHT_TO_DARK).some(k => inner.includes(k))) {
      return match;
    }
    // Skip non-class strings (URLs, imports, etc.)
    if (inner.startsWith('http') || inner.startsWith('/') || inner.startsWith('@') || inner.includes('node_modules')) {
      return match;
    }
    // Must look like a class string (has at least one Tailwind-like class)
    if (!/\b(?:bg-|text-|border-|flex|grid|p-|m-|w-|h-|rounded|shadow|ring|hover:|dark:)/.test(inner)) {
      return match;
    }
    const cleaned = processClassString(inner);
    return `"${cleaned}"`;
  });

  // Process single-quoted strings
  content = content.replace(/'([^']+)'/g, (match, inner) => {
    if (!inner.includes('dark:') && !Object.keys(LIGHT_TO_DARK).some(k => inner.includes(k))) {
      return match;
    }
    if (inner.startsWith('http') || inner.startsWith('/') || inner.startsWith('@') || inner.includes('node_modules')) {
      return match;
    }
    if (!/\b(?:bg-|text-|border-|flex|grid|p-|m-|w-|h-|rounded|shadow|ring|hover:|dark:)/.test(inner)) {
      return match;
    }
    const cleaned = processClassString(inner);
    return `'${cleaned}'`;
  });

  // Process backtick strings (template literals without ${})
  content = content.replace(/`([^`]+)`/g, (match, inner) => {
    if (inner.includes('${')) return match;
    if (!inner.includes('dark:') && !Object.keys(LIGHT_TO_DARK).some(k => inner.includes(k))) {
      return match;
    }
    if (inner.startsWith('http') || inner.startsWith('/') || inner.startsWith('@')) {
      return match;
    }
    if (!/\b(?:bg-|text-|border-|flex|grid|p-|m-|w-|h-|rounded|shadow|ring|hover:|dark:)/.test(inner)) {
      return match;
    }
    const cleaned = processClassString(inner);
    return `\`${cleaned}\``;
  });

  // Handle template literals with ${} - process each static segment
  // Match: `static part ${expr} static part`
  content = content.replace(/`((?:[^`\\]|\\.)*)`/g, (match) => {
    if (!match.includes('dark:') && !Object.keys(LIGHT_TO_DARK).some(k => match.includes(k))) {
      return match;
    }
    // Split by ${...} expressions, process static parts only
    let result = match;
    // Process segments between ${}
    result = result.replace(/((?:^`|}))((?:(?!\$\{)[^`])*)(?=\$\{|`$)/g, (seg, prefix, classStr) => {
      if (!classStr || classStr.length < 3) return seg;
      if (!/\b(?:bg-|text-|border-|dark:)/.test(classStr)) return seg;
      const cleaned = processClassString(classStr);
      return prefix + cleaned;
    });
    return result;
  });

  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    const remainingDark = (content.match(/\bdark:(?!.*(?:#|color))/g) || []).length;
    // More accurate: count dark: that look like CSS classes
    const darkCssCount = (content.match(/\bdark:[\w\[\]\/\.\-]+/g) || []).length;
    console.log(`✅ ${filePath} (${darkCssCount} dark: CSS remaining)`);
    return true;
  }
  return false;
}

let changed = 0;
for (const f of files) {
  try {
    if (processFile(f)) changed++;
  } catch (err) {
    console.error(`❌ ${f}: ${err.message}`);
  }
}
console.log(`\n📊 ${changed}/${files.length} files processed`);
