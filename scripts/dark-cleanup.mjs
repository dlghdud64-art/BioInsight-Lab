/**
 * Second pass: clean up residual light-mode classes in converted files
 */
import { readFileSync, writeFileSync } from 'fs';

const files = [
  'apps/web/src/app/dashboard/organizations/[id]/page.tsx',
  'apps/web/src/app/dashboard/settings/plans/page.tsx',
  'apps/web/src/app/dashboard/reports/page.tsx',
  'apps/web/src/components/inventory/InventoryTable.tsx',
  'apps/web/src/app/dashboard/budget/[id]/loading.tsx',
  // Also check other converted files for any light residuals
  'apps/web/src/app/dashboard/analytics/page.tsx',
  'apps/web/src/app/dashboard/analytics/_components/team-analytics-view.tsx',
  'apps/web/src/app/dashboard/organizations/page.tsx',
  'apps/web/src/app/dashboard/purchases/page.tsx',
  'apps/web/src/app/dashboard/billing/page.tsx',
  'apps/web/src/app/dashboard/settings/page.tsx',
  'apps/web/src/app/dashboard/pricing/page.tsx',
  'apps/web/src/app/dashboard/audit/page.tsx',
  'apps/web/src/app/dashboard/safety/page.tsx',
  'apps/web/src/app/dashboard/budget/[id]/page.tsx',
  'apps/web/src/app/dashboard/budget/details/[id]/page.tsx',
  'apps/web/src/app/dashboard/budget/page.tsx',
  'apps/web/src/app/dashboard/analytics/category/page.tsx',
  'apps/web/src/app/dashboard/analytics/monthly/page.tsx',
  'apps/web/src/components/ai/quote-ai-assistant-panel.tsx',
  'apps/web/src/components/ai/order-ai-assistant-panel.tsx',
  'apps/web/src/components/ai/inventory-ai-assistant-panel.tsx',
  'apps/web/src/components/inventory/GlobalQRScannerModal.tsx',
  'apps/web/src/components/inventory/import-wizard.tsx',
  'apps/web/src/components/dashboard/executive-dashboard.tsx',
  'apps/web/src/app/_components/dashboard-sidebar.tsx',
  'apps/web/src/app/_components/features-showcase-section.tsx',
  'apps/web/src/app/_components/page-header.tsx',
];

// Replacements: light class → dark equivalent
const replacements = [
  // Backgrounds
  [/\bbg-white\b/g, 'bg-slate-900'],
  [/\bbg-gray-50\b/g, 'bg-slate-900'],
  [/\bbg-gray-100\b/g, 'bg-slate-800'],
  [/\bbg-gray-200\b/g, 'bg-slate-800'],
  [/\bbg-slate-50\b/g, 'bg-slate-900'],
  [/\bbg-slate-100\b/g, 'bg-slate-800'],
  [/\bbg-red-50\b/g, 'bg-red-950/30'],
  [/\bbg-amber-50\b/g, 'bg-amber-950/30'],
  [/\bbg-orange-50\b/g, 'bg-orange-950/20'],
  [/\bbg-blue-50\b/g, 'bg-blue-950/20'],
  [/\bbg-emerald-50\b/g, 'bg-emerald-900/20'],
  [/\bbg-green-50\b/g, 'bg-green-900/20'],
  [/\bbg-green-100\b/g, 'bg-green-900/30'],
  [/\bbg-purple-50\b/g, 'bg-purple-900/20'],
  [/\bbg-yellow-50\b/g, 'bg-yellow-900/20'],
  [/\bbg-indigo-50\b/g, 'bg-indigo-900/20'],
  [/\bbg-pink-50\b/g, 'bg-pink-900/20'],
  [/\bbg-teal-50\b/g, 'bg-teal-900/20'],
  [/\bbg-cyan-50\b/g, 'bg-cyan-900/20'],
  [/\bbg-violet-50\b/g, 'bg-violet-900/20'],

  // Text colors
  [/\btext-gray-900\b/g, 'text-slate-100'],
  [/\btext-gray-800\b/g, 'text-slate-200'],
  [/\btext-gray-700\b/g, 'text-slate-300'],
  [/\btext-gray-600\b/g, 'text-slate-400'],
  [/\btext-gray-500\b/g, 'text-slate-400'],
  [/\btext-gray-400\b/g, 'text-slate-500'],
  [/\btext-slate-900\b/g, 'text-slate-100'],
  [/\btext-slate-800\b/g, 'text-slate-200'],
  [/\btext-slate-700\b/g, 'text-slate-300'],
  [/\btext-slate-600\b/g, 'text-slate-400'],

  // Border colors
  [/\bborder-gray-100\b/g, 'border-slate-800'],
  [/\bborder-gray-200\b/g, 'border-slate-800'],
  [/\bborder-gray-300\b/g, 'border-slate-700'],
  [/\bborder-slate-100\b/g, 'border-slate-800'],
  [/\bborder-slate-200\b/g, 'border-slate-800'],
  [/\bborder-slate-300\b/g, 'border-slate-700'],

  // Divide
  [/\bdivide-gray-100\b/g, 'divide-slate-800'],
  [/\bdivide-gray-200\b/g, 'divide-slate-800'],
  [/\bdivide-slate-200\b/g, 'divide-slate-800'],

  // Hover states
  [/\bhover:bg-gray-50\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-gray-100\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-slate-50\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-slate-100\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-white\b/g, 'hover:bg-slate-800'],

  // Ring/shadow
  [/\bring-gray-200\b/g, 'ring-slate-800'],
  [/\bring-gray-300\b/g, 'ring-slate-700'],
  [/\bshadow-sm\b/g, 'shadow-none'],

  // Specific accent colors (600 → 400 for dark bg readability)
  [/\btext-red-600\b/g, 'text-red-400'],
  [/\btext-amber-600\b/g, 'text-amber-400'],
  [/\btext-orange-600\b/g, 'text-orange-400'],
  [/\btext-blue-600\b/g, 'text-blue-400'],
  [/\btext-green-600\b/g, 'text-green-400'],
  [/\btext-emerald-600\b/g, 'text-emerald-400'],
  [/\btext-purple-600\b/g, 'text-purple-400'],
  [/\btext-indigo-600\b/g, 'text-indigo-400'],
  [/\btext-teal-600\b/g, 'text-teal-400'],
  [/\btext-pink-600\b/g, 'text-pink-400'],
  [/\btext-violet-600\b/g, 'text-violet-400'],
  [/\btext-cyan-600\b/g, 'text-cyan-400'],
  [/\btext-yellow-600\b/g, 'text-yellow-400'],
];

let totalChanges = 0;

for (const filePath of files) {
  try {
    let content = readFileSync(filePath, 'utf8');
    const original = content;
    let fileChanges = 0;

    for (const [pattern, replacement] of replacements) {
      const before = content;
      content = content.replace(pattern, replacement);
      if (content !== before) {
        const count = (before.match(pattern) || []).length;
        fileChanges += count;
      }
    }

    if (content !== original) {
      writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${filePath} — ${fileChanges} replacements`);
      totalChanges += fileChanges;
    }
  } catch (err) {
    // File might not exist, skip
  }
}

console.log(`\n📊 Total: ${totalChanges} light-mode classes converted`);
