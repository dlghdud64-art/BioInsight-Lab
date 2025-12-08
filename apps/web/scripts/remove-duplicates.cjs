const fs = require('fs');
const path = require('path');

// 중복 제거 함수
function removeDuplicates(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // export function 또는 export async function 패턴 찾기
    const exportIndices = [];
    lines.forEach((line, index) => {
      if (line.match(/^export\s+(async\s+)?function\s+\w+/) || 
          line.match(/^export\s+default\s+function/)) {
        exportIndices.push(index);
      }
    });
    
    // 중복이 없으면 스킵
    if (exportIndices.length <= 1) {
      return false;
    }
    
    // 첫 번째 함수의 끝을 찾기
    let firstEndIndex = findFunctionEnd(lines, exportIndices[0]);
    
    // 첫 번째 함수 이후의 모든 내용을 제거하고 첫 번째 함수만 남김
    const newLines = lines.slice(0, firstEndIndex + 1);
    
    // 파일 끝에 빈 줄이 있으면 제거
    while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
      newLines.pop();
    }
    
    const newContent = newLines.join('\n');
    
    // 내용이 변경되었으면 파일 저장
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// 함수의 끝을 찾는 함수 (중괄호 매칭)
function findFunctionEnd(lines, startIndex) {
  let braceCount = 0;
  let inFunction = false;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // 함수 시작 라인에서 중괄호 찾기
    if (line.includes('{')) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      inFunction = true;
    } else if (inFunction) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
    }
    
    // 중괄호가 모두 닫혔고, 다음 export가 나오면 여기서 끝
    if (inFunction && braceCount === 0) {
      // 다음 라인이 export로 시작하는지 확인
      if (i + 1 < lines.length && lines[i + 1].match(/^export\s+(async\s+)?function/)) {
        return i;
      }
      // 또는 빈 줄 다음에 export가 나오는지 확인
      if (i + 2 < lines.length && 
          lines[i + 1].trim() === '' && 
          lines[i + 2].match(/^export\s+(async\s+)?function/)) {
        return i;
      }
      // 또는 import가 다시 나오면 (중복된 import 제거를 위해)
      if (i + 1 < lines.length && lines[i + 1].match(/^import\s+/)) {
        return i;
      }
    }
  }
  
  // 함수 끝을 찾지 못했으면 마지막 라인 반환
  return lines.length - 1;
}

// 재귀적으로 파일 찾기
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // node_modules, .next 등은 제외
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
    if (removeDuplicates(file)) {
      fixedCount++;
      fixedFiles.push(path.relative(srcDir, file));
      console.log(`Fixed: ${path.relative(srcDir, file)}`);
    }
  });
  
  console.log(`\nFixed ${fixedCount} files:`);
  fixedFiles.forEach(f => console.log(`  - ${f}`));
}

main();

