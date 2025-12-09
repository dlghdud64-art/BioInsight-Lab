const fs = require('fs');
const path = require('path');

// 모든 문제를 일괄 수정하는 스크립트
function fixAllIssues(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 1. UTF-8 인코딩 문제 수정 (잘못된 바이트 시퀀스 제거)
    const originalContent = content;
    
    // 잘못된 바이트 시퀀스 패턴 찾기 및 제거
    content = content.replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    
    if (content !== originalContent) {
      modified = true;
    }
    
    // 2. 중복 export 제거
    const lines = content.split('\n');
    const exportIndices = [];
    
    lines.forEach((line, index) => {
      if (line.match(/^export\s+(async\s+)?function\s+\w+/) || 
          line.match(/^export\s+default\s+function/) ||
          line.match(/^export\s+const\s+\{[^}]*\}/) ||
          line.match(/^export\s+const\s+\w+\s*=/)) {
        exportIndices.push(index);
      }
    });
    
    // 중복이 있으면 첫 번째만 남기기
    if (exportIndices.length > 1) {
      const firstEndIndex = findFunctionEnd(lines, exportIndices[0]);
      const newLines = lines.slice(0, firstEndIndex + 1);
      
      // 파일 끝 빈 줄 제거
      while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
        newLines.pop();
      }
      
      content = newLines.join('\n');
      modified = true;
    }
    
    // 3. 중복 import 제거
    const importLines = [];
    const seenImports = new Set();
    let inImports = true;
    
    lines.forEach((line, index) => {
      if (line.match(/^import\s+/)) {
        if (!seenImports.has(line.trim())) {
          importLines.push(line);
          seenImports.add(line.trim());
        } else {
          modified = true;
        }
      } else if (line.trim() !== '' && !line.match(/^\/\//) && !line.match(/^\/\*/)) {
        inImports = false;
        if (!inImports || !line.match(/^import\s+/)) {
          importLines.push(line);
        }
      } else {
        importLines.push(line);
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// 함수의 끝을 찾는 함수
function findFunctionEnd(lines, startIndex) {
  let braceCount = 0;
  let inFunction = false;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('{')) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      inFunction = true;
    } else if (inFunction) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
    }
    
    if (inFunction && braceCount === 0) {
      if (i + 1 < lines.length && (
          lines[i + 1].match(/^export\s+(async\s+)?function/) ||
          lines[i + 1].match(/^export\s+const\s+\{[^}]*\}/) ||
          lines[i + 1].match(/^export\s+const\s+\w+\s*=/))) {
        return i;
      }
      if (i + 2 < lines.length && 
          lines[i + 1].trim() === '' && (
          lines[i + 2].match(/^export\s+(async\s+)?function/) ||
          lines[i + 2].match(/^export\s+const\s+\{[^}]*\}/) ||
          lines[i + 2].match(/^export\s+const\s+\w+\s*=/))) {
        return i;
      }
      if (i + 1 < lines.length && lines[i + 1].match(/^import\s+/)) {
        return i;
      }
    }
  }
  
  return lines.length - 1;
}

// 재귀적으로 파일 찾기
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
        findFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// 메인 실행
function main() {
  const srcDir = path.join(__dirname, '../src');
  const files = findFiles(srcDir);
  
  console.log(`Found ${files.length} TypeScript files`);
  
  let fixedCount = 0;
  const fixedFiles = [];
  
  files.forEach(file => {
    if (fixAllIssues(file)) {
      fixedCount++;
      fixedFiles.push(path.relative(srcDir, file));
      console.log(`Fixed: ${path.relative(srcDir, file)}`);
    }
  });
  
  console.log(`\nFixed ${fixedCount} files`);
}

main();


