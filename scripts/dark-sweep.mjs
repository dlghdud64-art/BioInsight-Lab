/**
 * Full sweep: convert ALL remaining light-mode classes in ALL tsx/ts files
 * Excludes QR code color objects and non-CSS contexts
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const srcDir = 'apps/web/src';

function getAllFiles(dir) {
  const results = [];
  try {
    for (const item of readdirSync(dir)) {
      const full = join(dir, item);
      try {
        const stat = statSync(full);
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== '.next' && item !== '__tests__') {
          results.push(...getAllFiles(full));
        } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
          results.push(full);
        }
      } catch {}
    }
  } catch {}
  return results;
}

const REPLACEMENTS = [
  // Backgrounds
  [/\bbg-white\b/g, 'bg-slate-900'],
  [/\bbg-gray-50\b/g, 'bg-slate-900'],
  [/\bbg-gray-100\b/g, 'bg-slate-800'],
  [/\bbg-gray-200\b/g, 'bg-slate-800'],
  [/\bbg-slate-50\b/g, 'bg-slate-900'],
  [/\bbg-slate-100\b/g, 'bg-slate-800'],
  // Text
  [/\btext-gray-900\b/g, 'text-slate-100'],
  [/\btext-gray-800\b/g, 'text-slate-200'],
  [/\btext-gray-700\b/g, 'text-slate-300'],
  [/\btext-gray-600\b/g, 'text-slate-400'],
  [/\btext-gray-500\b/g, 'text-slate-400'],
  [/\btext-slate-900\b/g, 'text-slate-100'],
  [/\btext-slate-800\b/g, 'text-slate-200'],
  [/\btext-slate-700\b/g, 'text-slate-300'],
  [/\btext-slate-600\b/g, 'text-slate-400'],
  // Borders
  [/\bborder-gray-100\b/g, 'border-slate-800'],
  [/\bborder-gray-200\b/g, 'border-slate-800'],
  [/\bborder-gray-300\b/g, 'border-slate-700'],
  [/\bborder-slate-100\b/g, 'border-slate-800'],
  [/\bborder-slate-200\b/g, 'border-slate-800'],
  [/\bborder-slate-300\b/g, 'border-slate-700'],
  // Divide
  [/\bdivide-gray-200\b/g, 'divide-slate-800'],
  [/\bdivide-gray-100\b/g, 'divide-slate-800'],
  [/\bdivide-slate-200\b/g, 'divide-slate-800'],
  // Hover backgrounds
  [/\bhover:bg-gray-50\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-gray-100\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-slate-50\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-slate-100\b/g, 'hover:bg-slate-800'],
  [/\bhover:bg-white\b/g, 'hover:bg-slate-800'],
  // Shadow
  [/\bshadow-sm\b/g, 'shadow-none'],
  // Colored accents (600 → 400 for dark readability)
  [/\btext-red-600\b/g, 'text-red-400'],
  [/\btext-blue-600\b/g, 'text-blue-400'],
  [/\btext-green-600\b/g, 'text-green-400'],
  [/\btext-amber-600\b/g, 'text-amber-400'],
  [/\btext-emerald-600\b/g, 'text-emerald-400'],
  [/\btext-purple-600\b/g, 'text-purple-400'],
  [/\btext-orange-600\b/g, 'text-orange-400'],
  [/\btext-indigo-600\b/g, 'text-indigo-400'],
  [/\btext-teal-600\b/g, 'text-teal-400'],
  [/\btext-pink-600\b/g, 'text-pink-400'],
  [/\btext-violet-600\b/g, 'text-violet-400'],
  [/\btext-cyan-600\b/g, 'text-cyan-400'],
  [/\btext-yellow-600\b/g, 'text-yellow-400'],
  // Colored borders (light → dark)
  [/\bborder-red-100\b/g, 'border-red-800'],
  [/\bborder-red-200\b/g, 'border-red-800'],
  [/\bborder-amber-100\b/g, 'border-amber-800'],
  [/\bborder-amber-200\b/g, 'border-amber-800'],
  [/\bborder-blue-100\b/g, 'border-blue-800'],
  [/\bborder-blue-200\b/g, 'border-blue-800'],
  [/\bborder-green-100\b/g, 'border-green-800'],
  [/\bborder-green-200\b/g, 'border-green-800'],
  [/\bborder-emerald-200\b/g, 'border-emerald-800'],
  [/\bborder-purple-200\b/g, 'border-purple-800'],
  [/\bborder-indigo-200\b/g, 'border-indigo-800'],
  [/\bborder-orange-200\b/g, 'border-orange-800'],
  // Colored backgrounds (light → dark)
  [/\bbg-red-50\b/g, 'bg-red-950/30'],
  [/\bbg-red-100\b/g, 'bg-red-900/40'],
  [/\bbg-amber-50\b/g, 'bg-amber-950/30'],
  [/\bbg-amber-100\b/g, 'bg-amber-900/40'],
  [/\bbg-blue-50\b/g, 'bg-blue-950/20'],
  [/\bbg-blue-100\b/g, 'bg-blue-900/30'],
  [/\bbg-green-50\b/g, 'bg-green-900/20'],
  [/\bbg-green-100\b/g, 'bg-green-900/30'],
  [/\bbg-emerald-50\b/g, 'bg-emerald-900/20'],
  [/\bbg-emerald-100\b/g, 'bg-emerald-900/40'],
  [/\bbg-purple-50\b/g, 'bg-purple-900/20'],
  [/\bbg-purple-100\b/g, 'bg-purple-900/30'],
  [/\bbg-yellow-50\b/g, 'bg-yellow-900/20'],
  [/\bbg-yellow-100\b/g, 'bg-yellow-900/40'],
  [/\bbg-indigo-50\b/g, 'bg-indigo-900/20'],
  [/\bbg-orange-50\b/g, 'bg-orange-950/20'],
  [/\bbg-orange-100\b/g, 'bg-orange-900/40'],
  [/\bbg-teal-50\b/g, 'bg-teal-900/20'],
  [/\bbg-cyan-50\b/g, 'bg-cyan-900/20'],
  [/\bbg-pink-50\b/g, 'bg-pink-900/20'],
  [/\bbg-violet-50\b/g, 'bg-violet-900/20'],
  // Ring
  [/\bring-gray-200\b/g, 'ring-slate-700'],
  [/\bring-gray-300\b/g, 'ring-slate-700'],
  // shadow-md, shadow-lg → shadow-none
  [/\bshadow-md\b/g, 'shadow-none'],
  [/\bshadow-lg\b/g, 'shadow-none'],
  // white/95 backdrop variants
  [/\bbg-white\/95\b/g, 'bg-slate-950/95'],
  [/\bbg-white\/80\b/g, 'bg-slate-950/80'],
  [/\bbg-white\/90\b/g, 'bg-slate-950/90'],
  [/\bbg-gray-50\/80\b/g, 'bg-slate-900/80'],
  // Also remaining dark: CSS patterns (shouldn't be many)
  // Handle stat-card-fixed in globals.css separately
];

const files = getAllFiles(srcDir);
let changed = 0;
let totalReplacements = 0;

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf8');
  const original = content;
  let fileReplacements = 0;

  // Process line by line to skip QR code / non-CSS contexts
  const lines = content.split('\n');
  const processed = lines.map(line => {
    // Skip lines with QR code color objects
    if (line.includes('QRCode.') || (line.includes('color:') && line.includes('dark:') && line.includes('"#'))) {
      return line;
    }
    // Skip import statements
    if (line.trimStart().startsWith('import ')) return line;
    // Skip comment-only lines with dark: references
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return line;

    let result = line;
    for (const [pattern, replacement] of REPLACEMENTS) {
      const before = result;
      result = result.replace(pattern, replacement);
      if (result !== before) {
        fileReplacements += (before.match(pattern) || []).length;
      }
    }
    return result;
  });

  content = processed.join('\n');
  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    changed++;
    totalReplacements += fileReplacements;
    if (fileReplacements > 5) {
      console.log(`✅ ${filePath} (${fileReplacements} replacements)`);
    }
  }
}

console.log(`\n📊 ${changed} files changed, ${totalReplacements} total replacements`);
