/**
 * Bulk dark: pattern converter
 * Removes dark: prefix and cleans up light-mode counterpart classes
 */
import { readFileSync, writeFileSync } from 'fs';

const files = [
  'apps/web/src/components/ai/inventory-ai-assistant-panel.tsx',
  'apps/web/src/components/bioinsight-logo.tsx',
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
];

// Map of light classes to remove when dark counterpart exists
// Key = utility prefix (bg-, text-, border-, etc.)
// These light classes should be removed when a dark: counterpart with same prefix exists nearby
const LIGHT_TO_DARK_MAP = {
  // backgrounds
  'bg-white': 'bg-slate-900',
  'bg-gray-50': 'bg-slate-900',
  'bg-gray-100': 'bg-slate-800',
  'bg-slate-50': 'bg-slate-900',
  'bg-slate-100': 'bg-slate-800',
  'bg-slate-200': 'bg-slate-800',
  'bg-red-50': 'bg-red-950/30',
  'bg-amber-50': 'bg-amber-950/30',
  'bg-orange-50': 'bg-orange-950/20',
  'bg-blue-50': 'bg-blue-950/20',
  'bg-emerald-50': 'bg-emerald-900/20',
  'bg-green-50': 'bg-green-900/20',
  'bg-green-100': 'bg-green-900/30',
  'bg-purple-50': 'bg-purple-900/20',
  'bg-yellow-50': 'bg-yellow-900/20',
  'bg-indigo-50': 'bg-indigo-900/20',
  'bg-pink-50': 'bg-pink-900/20',
  'bg-teal-50': 'bg-teal-900/20',
  'bg-cyan-50': 'bg-cyan-900/20',
  // text
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
  'text-slate-500': 'text-slate-400',
  // borders
  'border-gray-100': 'border-slate-800',
  'border-gray-200': 'border-slate-800',
  'border-gray-300': 'border-slate-700',
  'border-slate-100': 'border-slate-800',
  'border-slate-200': 'border-slate-800',
  'border-slate-300': 'border-slate-700',
  // ring/divide
  'divide-gray-200': 'divide-slate-800',
  'divide-slate-200': 'divide-slate-800',
  'ring-gray-200': 'ring-slate-800',
  // hover light
  'hover:bg-gray-50': 'hover:bg-slate-800',
  'hover:bg-gray-100': 'hover:bg-slate-800',
  'hover:bg-slate-50': 'hover:bg-slate-800',
  'hover:bg-slate-100': 'hover:bg-slate-800',
};

function getUtilityPrefix(cls) {
  // Extract prefix like 'bg-', 'text-', 'border-', 'hover:bg-', etc.
  const match = cls.match(/^((?:hover:|focus:|active:|group-hover:)*(?:bg|text|border|ring|divide|shadow|from|to|via|fill|stroke|outline|decoration|accent|caret|placeholder)-)/);
  return match ? match[1] : null;
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Step 1: Handle paired patterns - find "light-class dark:dark-class" and replace
  // Pattern: a light class followed (possibly with other classes in between) by dark: variant
  // We process className strings

  // Simple approach:
  // 1. For each dark:X class, remove the dark: prefix to get X
  // 2. Check if there's a corresponding light class with the same utility prefix, remove it

  // First pass: collect all dark: classes and their positions
  // Replace dark: prefixed classes - remove the prefix
  // Also remove the light counterpart if it exists as a separate token

  // Strategy: Process each "className" or "class" attribute value
  // But since these are in JSX template literals and cn() calls,
  // let's use a token-based approach on the whole file

  // Step 1: Find all dark:X patterns and build replacement map
  const darkPattern = /\bdark:(\S+)/g;
  let match;
  const darkClasses = new Set();
  while ((match = darkPattern.exec(content)) !== null) {
    darkClasses.add(match[1]); // the class without dark: prefix
  }

  // Step 2: For each dark class, find its light counterpart that should be removed
  const lightClassesToRemove = new Set();
  for (const darkCls of darkClasses) {
    const prefix = getUtilityPrefix(darkCls);
    if (!prefix) continue;

    // Find light classes in LIGHT_TO_DARK_MAP that have the same prefix
    for (const [lightCls] of Object.entries(LIGHT_TO_DARK_MAP)) {
      const lightPrefix = getUtilityPrefix(lightCls);
      if (lightPrefix === prefix) {
        lightClassesToRemove.add(lightCls);
      }
    }
  }

  // Step 3: Remove "dark:" prefix from all dark: classes
  content = content.replace(/\bdark:(\S+)/g, '$1');

  // Step 4: Remove light counterpart classes that now have dark duplicates
  // We need to be careful to only remove them when they're in class contexts
  // Remove light classes that are followed or preceded by their dark equivalent
  for (const lightCls of lightClassesToRemove) {
    // Remove the light class as a standalone token in class strings
    // Match as a word boundary token in class strings
    const escaped = lightCls.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    // Remove with trailing space, leading space, or as only class
    const regex = new RegExp(`\\b${escaped}\\b\\s*`, 'g');

    // Only remove if the file actually has both the light class AND the dark equivalent
    if (content.includes(lightCls)) {
      const prefix = getUtilityPrefix(lightCls);
      // Check if there's a dark-equivalent class with the same prefix
      let hasDarkEquiv = false;
      for (const darkCls of darkClasses) {
        if (getUtilityPrefix(darkCls) === prefix) {
          hasDarkEquiv = true;
          break;
        }
      }
      if (hasDarkEquiv) {
        // Remove the light class, being careful about context
        // Only remove in string/template literal contexts
        content = content.replace(new RegExp(`(["'\`\\s])${escaped}(\\s)`, 'g'), '$1$2');
        content = content.replace(new RegExp(`(\\s)${escaped}(["'\`])`, 'g'), '$1$2');
        content = content.replace(new RegExp(`(["'\`])${escaped}(["'\`])`, 'g'), '$1$2');
      }
    }
  }

  // Step 5: Clean up any double spaces
  content = content.replace(/  +/g, ' ');
  // Clean up spaces before quotes
  content = content.replace(/ "/g, '"');
  content = content.replace(/" /g, '"'); // be careful with this one

  // Actually, let's be more conservative with space cleanup
  // Revert the aggressive space cleanup and just handle double spaces in class strings
  content = readFileSync(filePath, 'utf8');

  // Simpler approach: just do two passes
  // Pass 1: Replace "lightCls dark:darkCls" pairs with just "darkCls"
  for (const [lightCls, defaultDark] of Object.entries(LIGHT_TO_DARK_MAP)) {
    const escaped = lightCls.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    // Pattern: lightCls followed by space and dark:something-with-same-prefix
    const prefix = getUtilityPrefix(lightCls) || '';
    const prefixEscaped = prefix.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    if (prefix) {
      // Match lightCls followed (possibly with other classes) by dark:prefix...
      // Simple case: directly adjacent
      const directPattern = new RegExp(`\\b${escaped}\\s+dark:${prefixEscaped}(\\S+)`, 'g');
      content = content.replace(directPattern, `${prefix}$1`);
    }
  }

  // Pass 2: Remove any remaining dark: prefixes (standalone dark: classes without light counterpart)
  content = content.replace(/\bdark:([\w\[\]\/\.\-\(\)%:]+)/g, '$1');

  // Pass 3: Clean double spaces within strings
  content = content.replace(/(["'`])([^"'`]*)\1/g, (match) => {
    return match.replace(/  +/g, ' ');
  });

  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf8');
    // Verify no dark: remaining
    const remaining = (content.match(/\bdark:/g) || []).length;
    console.log(`✅ ${filePath} — converted (${remaining} dark: remaining)`);
    return { file: filePath, remaining };
  } else {
    console.log(`⏭️  ${filePath} — no changes`);
    return { file: filePath, remaining: 0 };
  }
}

let totalRemaining = 0;
const results = [];

for (const file of files) {
  try {
    const result = processFile(file);
    totalRemaining += result.remaining;
    results.push(result);
  } catch (err) {
    console.error(`❌ ${file}: ${err.message}`);
  }
}

console.log(`\n📊 Total dark: remaining: ${totalRemaining}`);
if (totalRemaining > 0) {
  console.log('Files with remaining dark: patterns:');
  for (const r of results) {
    if (r.remaining > 0) console.log(`  ${r.file}: ${r.remaining}`);
  }
}
