const fs = require('fs');
const path = require('path');

// UI 컴포넌트 파일들의 중복을 일괄 제거
function fixUIComponent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // export 문이 여러 개인지 확인
    const exportIndices = [];
    lines.forEach((line, index) => {
      if (line.match(/^export\s+\{/)) {
        exportIndices.push(index);
      }
    });
    
    // export가 여러 개면 첫 번째 export까지만 남기기
    if (exportIndices.length > 1) {
      // 첫 번째 export 블록의 끝 찾기
      let firstExportEnd = exportIndices[0];
      for (let i = firstExportEnd; i < lines.length; i++) {
        if (lines[i].trim() === '};') {
          firstExportEnd = i;
          break;
        }
      }
      
      // 첫 번째 export 이후의 모든 내용 제거
      const newLines = lines.slice(0, firstExportEnd + 1);
      
      // 파일 끝 빈 줄 제거
      while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
        newLines.pop();
      }
      
      const newContent = newLines.join('\n');
      fs.writeFileSync(filePath, newContent, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
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
  const uiDir = path.join(__dirname, '../src/components/ui');
  const files = findFiles(uiDir);
  
  console.log(`Found ${files.length} UI component files`);
  
  let fixedCount = 0;
  const fixedFiles = [];
  
  files.forEach(file => {
    if (fixUIComponent(file)) {
      fixedCount++;
      fixedFiles.push(path.relative(uiDir, file));
      console.log(`Fixed: ${path.relative(uiDir, file)}`);
    }
  });
  
  console.log(`\nFixed ${fixedCount} files`);
}

main();

