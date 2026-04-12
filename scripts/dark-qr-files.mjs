/**
 * Light-mode class conversion for files with QR code "dark:" references
 * Only converts Tailwind light classes, NOT JS object keys
 */
import { readFileSync, writeFileSync } from 'fs';

const files = [
  'apps/web/src/app/dashboard/inventory/page.tsx',
  'apps/web/src/components/inventory/InventoryQRCode.tsx',
];

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
  [/\bshadow-sm\b/g, 'shadow-none'],
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
];

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf8');
  const original = content;

  // Process line by line to skip QR code lines
  const lines = content.split('\n');
  const processed = lines.map(line => {
    // Skip lines with QR code dark: references
    if (line.includes('QRCode.') || line.includes('color: {')) return line;

    let result = line;
    for (const [pattern, replacement] of LIGHT_STANDALONE) {
      result = result.replace(pattern, replacement);
    }
    return result;
  });

  content = processed.join('\n');
  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filePath}`);
  }
}
