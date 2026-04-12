/**
 * Final dark: conversion - direct regex on file content
 * Two-pass approach:
 * Pass 1: Replace "light-class dark:dark-class" pairs → "dark-class"
 * Pass 2: Remove any remaining "dark:" prefixes
 * Pass 3: Convert remaining standalone light classes → dark equivalents
 */
import { readFileSync, writeFileSync } from 'fs';

const files = [
  'apps/web/src/components/ai/quote-ai-assistant-panel.tsx',
  'apps/web/src/app/dashboard/reports/page.tsx',
  'apps/web/src/app/dashboard/analytics/_components/team-analytics-view.tsx',
  'apps/web/src/app/dashboard/analytics/page.tsx',
  'apps/web/src/app/dashboard/budget/details/[id]/page.tsx',
  'apps/web/src/app/dashboard/organizations/[id]/page.tsx',
  'apps/web/src/app/dashboard/organizations/page.tsx',
  'apps/web/src/app/dashboard/purchases/page.tsx',
  'apps/web/src/app/dashboard/settings/plans/page.tsx',
  'apps/web/src/app/dashboard/settings/page.tsx',
  'apps/web/src/app/dashboard/safety/page.tsx',
  'apps/web/src/components/inventory/InventoryTable.tsx',
  'apps/web/src/components/inventory/GlobalQRScannerModal.tsx',
  'apps/web/src/components/inventory/import-wizard.tsx',
  'apps/web/src/app/_components/dashboard-sidebar.tsx',
  'apps/web/src/components/bioinsight-logo.tsx',
  'apps/web/src/app/dashboard/budget/page.tsx',
];

// Pass 1: Paired replacements - lightClass followed by dark:darkClass
// Handle patterns like: bg-white dark:bg-slate-900 → bg-slate-900
// The light and dark classes share the same utility prefix
const PAIRED_PATTERNS = [
  // bg-*
  [/\bbg-white\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-gray-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-gray-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-gray-200\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-slate-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-slate-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-slate-200\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-red-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-red-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-amber-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-amber-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-orange-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-orange-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-blue-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-blue-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-emerald-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-emerald-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-green-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-green-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-purple-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-purple-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-yellow-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-yellow-100\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-indigo-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-violet-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-teal-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-cyan-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  [/\bbg-pink-50\s+dark:bg-([\w\-\/\[\]]+)/g, 'bg-$1'],
  // text-*
  [/\btext-gray-900\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-gray-800\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-gray-700\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-gray-600\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-gray-500\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-gray-400\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-slate-900\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-slate-800\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-slate-700\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-slate-600\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-slate-500\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-red-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-amber-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-orange-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-blue-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-green-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-emerald-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-purple-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-indigo-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-teal-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-pink-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-yellow-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-violet-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-cyan-\d+\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  [/\btext-white\s+dark:text-([\w\-\/\[\]]+)/g, 'text-$1'],
  // border-*
  [/\bborder-gray-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-slate-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-red-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-amber-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-orange-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-blue-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-green-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-emerald-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-purple-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-indigo-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  [/\bborder-yellow-\d+\s+dark:border-([\w\-\/\[\]]+)/g, 'border-$1'],
  // divide-*
  [/\bdivide-gray-\d+\s+dark:divide-([\w\-\/\[\]]+)/g, 'divide-$1'],
  [/\bdivide-slate-\d+\s+dark:divide-([\w\-\/\[\]]+)/g, 'divide-$1'],
  // ring-*
  [/\bring-gray-\d+\s+dark:ring-([\w\-\/\[\]]+)/g, 'ring-$1'],
  [/\bring-slate-\d+\s+dark:ring-([\w\-\/\[\]]+)/g, 'ring-$1'],
  // hover:bg-*
  [/\bhover:bg-[\w-]+\s+dark:hover:bg-([\w\-\/\[\]]+)/g, 'hover:bg-$1'],
  // hover:text-*
  [/\bhover:text-[\w-]+\s+dark:hover:text-([\w\-\/\[\]]+)/g, 'hover:text-$1'],
  // hover:border-*
  [/\bhover:border-[\w-]+\s+dark:hover:border-([\w\-\/\[\]]+)/g, 'hover:border-$1'],
  // focus:ring-*
  [/\bfocus:ring-[\w-]+\s+dark:focus:ring-([\w\-\/\[\]]+)/g, 'focus:ring-$1'],
  // shadow
  [/\bshadow-sm\s+dark:shadow-([\w\-\/\[\]]+)/g, 'shadow-$1'],
  [/\bshadow-md\s+dark:shadow-([\w\-\/\[\]]+)/g, 'shadow-$1'],
  // from/to (gradients)
  [/\bfrom-[\w-]+\s+dark:from-([\w\-\/\[\]]+)/g, 'from-$1'],
  [/\bto-[\w-]+\s+dark:to-([\w\-\/\[\]]+)/g, 'to-$1'],
  [/\bvia-[\w-]+\s+dark:via-([\w\-\/\[\]]+)/g, 'via-$1'],
  // placeholder
  [/\bplaceholder-[\w-]+\s+dark:placeholder-([\w\-\/\[\]]+)/g, 'placeholder-$1'],
  // !important variants
  [/\b!border-l-[\w-]+\s+dark:!border-l-([\w\-\/\[\]]+)/g, '!border-l-$1'],
];

// Pass 2: Remove any remaining standalone dark: prefixes
// dark:X → X
const DARK_PREFIX_PATTERN = /\bdark:([\w\[\]\/\.\-\(\)%:!]+)/g;

// Pass 3: Convert remaining standalone light classes
const LIGHT_STANDALONE = [
  [/\bbg-white\b/g, 'bg-slate-900'],
  [/\bbg-gray-50\b/g, 'bg-slate-900'],
  [/\bbg-gray-100\b/g, 'bg-slate-800'],
  [/\bbg-slate-50\b/g, 'bg-slate-900'],
  [/\bbg-slate-100\b/g, 'bg-slate-800'],
  [/\btext-gray-900\b/g, 'text-slate-100'],
  [/\btext-gray-800\b/g, 'text-slate-200'],
  [/\btext-gray-700\b/g, 'text-slate-300'],
  [/\btext-gray-600\b/g, 'text-slate-400'],
  [/\btext-gray-500\b/g, 'text-slate-400'],
  [/\btext-slate-900\b/g, 'text-slate-100'],
  [/\btext-slate-800\b/g, 'text-slate-200'],
  [/\btext-slate-700\b/g, 'text-slate-300'],
  [/\btext-slate-600\b/g, 'text-slate-400'],
  [/\bborder-gray-200\b/g, 'border-slate-800'],
  [/\bborder-gray-300\b/g, 'border-slate-700'],
  [/\bborder-slate-200\b/g, 'border-slate-800'],
  [/\bborder-slate-300\b/g, 'border-slate-700'],
  [/\bdivide-gray-200\b/g, 'divide-slate-800'],
  [/\bhover:bg-gray-50\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-gray-100\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-slate-50\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-slate-100\b/g, 'hover:bg-slate-800'],
  [/\btext-red-600\b/g, 'text-red-400'],
  [/\btext-blue-600\b/g, 'text-blue-400'],
  [/\btext-green-600\b/g, 'text-green-400'],
  [/\btext-amber-600\b/g, 'text-amber-400'],
  [/\btext-emerald-600\b/g, 'text-emerald-400'],
  [/\btext-purple-600\b/g, 'text-purple-400'],
  [/\btext-orange-600\b/g, 'text-orange-400'],
  [/\btext-indigo-600\b/g, 'text-indigo-400'],
  [/\bshadow-sm\b/g, 'shadow-none'],
];

for (const filePath of files) {
  try {
    let content = readFileSync(filePath, 'utf8');
    const original = content;

    // Pass 1: Replace paired patterns
    for (const [pattern, replacement] of PAIRED_PATTERNS) {
      content = content.replace(pattern, replacement);
    }

    // Pass 2: Remove remaining dark: prefixes
    // But skip non-CSS dark: references (QR code colors, comments, etc.)
    content = content.replace(DARK_PREFIX_PATTERN, (match, cls) => {
      // Keep if it's inside an object key context like { dark: "#..." }
      // Check surrounding context - we're doing whole-file regex so we can't easily check
      // But we can check if the captured class starts with a valid CSS utility
      if (/^[a-z!]/.test(cls) && /^(?:bg-|text-|border-|ring-|shadow-|divide-|hover:|focus:|active:|from-|to-|via-|placeholder-|!border)/.test(cls)) {
        return cls;
      }
      return match; // Keep non-CSS dark: references
    });

    // Pass 3: Convert remaining standalone light classes
    for (const [pattern, replacement] of LIGHT_STANDALONE) {
      content = content.replace(pattern, replacement);
    }

    if (content !== original) {
      writeFileSync(filePath, content, 'utf8');
      const remaining = (content.match(/\bdark:(?:bg-|text-|border-|ring-|shadow-|divide-|hover:|focus:|!)/g) || []).length;
      console.log(`✅ ${filePath} (${remaining} dark: CSS remaining)`);
    }
  } catch (err) {
    console.error(`❌ ${filePath}: ${err.message}`);
  }
}
