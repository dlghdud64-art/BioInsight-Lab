/**
 * Third pass: remove duplicate/conflicting classes left by dark: removal
 * Handles cases like "bg-red-100 bg-red-900/40" → "bg-red-900/40"
 * and "text-red-400 text-red-400" → "text-red-400"
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const srcDir = 'apps/web/src';

function getAllTsxFiles(dir) {
  const results = [];
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const full = join(dir, item);
      try {
        const stat = statSync(full);
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== '.next') {
          results.push(...getAllTsxFiles(full));
        } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
          results.push(full);
        }
      } catch {}
    }
  } catch {}
  return results;
}

// Light classes that should be removed when a dark equivalent exists in same string
const LIGHT_CLASSES_TO_REMOVE = [
  'bg-white', 'bg-gray-50', 'bg-gray-100', 'bg-gray-200',
  'bg-slate-50', 'bg-slate-100', 'bg-slate-200',
  'bg-red-50', 'bg-red-100', 'bg-amber-50', 'bg-amber-100',
  'bg-orange-50', 'bg-orange-100', 'bg-blue-50', 'bg-blue-100',
  'bg-emerald-50', 'bg-emerald-100', 'bg-green-50', 'bg-green-100',
  'bg-purple-50', 'bg-purple-100', 'bg-yellow-50', 'bg-yellow-100',
  'bg-indigo-50', 'bg-indigo-100', 'bg-pink-50', 'bg-pink-100',
  'bg-teal-50', 'bg-teal-100', 'bg-cyan-50', 'bg-cyan-100',
  'bg-violet-50', 'bg-violet-100',
  'text-gray-900', 'text-gray-800', 'text-gray-700', 'text-gray-600', 'text-gray-500',
  'text-slate-900', 'text-slate-800', 'text-slate-700', 'text-slate-600',
  'text-red-700', 'text-red-800', 'text-amber-700', 'text-amber-800',
  'text-orange-700', 'text-orange-800', 'text-blue-700', 'text-blue-800',
  'text-green-700', 'text-green-800', 'text-emerald-700', 'text-emerald-800',
  'text-purple-700', 'text-purple-800', 'text-indigo-700', 'text-indigo-800',
  'text-yellow-700', 'text-yellow-800', 'text-teal-700',
  'text-pink-700', 'text-violet-700', 'text-cyan-700',
  'border-red-200', 'border-amber-200', 'border-orange-200', 'border-blue-200',
  'border-green-200', 'border-emerald-200', 'border-purple-200', 'border-yellow-200',
  'border-indigo-200', 'border-pink-200', 'border-teal-200', 'border-violet-200',
  'border-gray-100', 'border-gray-200', 'border-gray-300',
  'border-slate-100', 'border-slate-200', 'border-slate-300',
  'border-red-100', 'border-amber-100',
  'hover:bg-amber-50', 'hover:bg-blue-50', 'hover:bg-red-50',
  'hover:bg-gray-50', 'hover:bg-gray-100', 'hover:bg-slate-50', 'hover:bg-slate-100',
  'shadow-sm',
];

function getPrefix(cls) {
  // Get the utility prefix (e.g., 'bg-', 'text-', 'border-')
  // Handle pseudo-class prefixes like 'hover:'
  const m = cls.match(/^((?:hover:|focus:|active:)*)(bg|text|border|ring|divide|shadow|from|to|via)-/);
  return m ? m[0].replace(/[^a-z:-]/g, '') : null;
}

function cleanClassString(str) {
  // Split into tokens
  const tokens = str.split(/\s+/);
  const seen = new Set();
  const result = [];

  // First pass: identify which dark equivalents exist
  const darkEquivPrefixes = new Set();
  for (const token of tokens) {
    // If this token is a dark equivalent (slate-800, slate-900, etc.), note its prefix
    if (/(?:slate-[789]|950|900\/|800\/)/.test(token) || /(?:-300|-400|-500)$/.test(token)) {
      const prefix = getPrefix(token);
      if (prefix) darkEquivPrefixes.add(prefix);
    }
  }

  for (const token of tokens) {
    if (!token) continue;

    // Remove exact duplicates
    if (seen.has(token)) continue;
    seen.add(token);

    // Check if this is a light class that should be removed
    if (LIGHT_CLASSES_TO_REMOVE.includes(token)) {
      const prefix = getPrefix(token);
      // Check if there's a dark equivalent with the same prefix in the same string
      const hasDarkEquiv = tokens.some(t => {
        if (t === token) return false;
        const tPrefix = getPrefix(t);
        return tPrefix === prefix && !LIGHT_CLASSES_TO_REMOVE.includes(t);
      });
      if (hasDarkEquiv) {
        continue; // Skip this light class
      }
    }

    result.push(token);
  }

  return result.join(' ');
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const original = content;

  // Process className strings (both static and in cn() calls)
  // Match quoted strings that contain Tailwind classes
  content = content.replace(/"([^"]*(?:bg-|text-|border-)[^"]*)"/g, (match, inner) => {
    const cleaned = cleanClassString(inner);
    return `"${cleaned}"`;
  });

  content = content.replace(/'([^']*(?:bg-|text-|border-)[^']*)'/g, (match, inner) => {
    const cleaned = cleanClassString(inner);
    return `'${cleaned}'`;
  });

  content = content.replace(/`([^`]*(?:bg-|text-|border-)[^`]*)`/g, (match, inner) => {
    // Skip template literals with ${} expressions for safety
    if (inner.includes('${')) return match;
    const cleaned = cleanClassString(inner);
    return `\`${cleaned}\``;
  });

  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

const files = getAllTsxFiles(srcDir);
let changed = 0;
for (const f of files) {
  if (processFile(f)) {
    changed++;
    console.log(`✅ ${f}`);
  }
}
console.log(`\n📊 ${changed} files cleaned of duplicate classes`);
