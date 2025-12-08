const fs = require('fs');
const path = require('path');

// UTF-8 인코딩 문제가 있는 파일을 찾고 수정
function fixEncoding(filePath) {
  try {
    // 파일을 바이너리로 읽기
    const buffer = fs.readFileSync(filePath);
    
    // UTF-8로 디코딩 시도
    let content;
    try {
      content = buffer.toString('utf8');
      
      // 잘못된 바이트 시퀀스가 있는지 확인
      if (content.includes('')) {
        // 잘못된 인코딩이 있으면 수정 시도
        // Windows-1252나 다른 인코딩으로 시도
        try {
          content = buffer.toString('latin1');
          // 한글이 깨진 경우를 감지
          if (content.match(/[가-힣]/)) {
            // 이미 올바른 인코딩인 경우
            return false;
          }
        } catch (e) {
          // 실패하면 원본 반환
        }
      }
      
      // 파일을 UTF-8로 다시 저장
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    } catch (e) {
      console.error(`Error processing ${filePath}:`, e.message);
      return false;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
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
  const srcDir = path.join(__dirname, '../src');
  const files = findFiles(srcDir);
  
  console.log(`Found ${files.length} TypeScript files`);
  
  let fixedCount = 0;
  const fixedFiles = [];
  
  files.forEach(file => {
    if (fixEncoding(file)) {
      fixedCount++;
      fixedFiles.push(path.relative(srcDir, file));
      console.log(`Fixed: ${path.relative(srcDir, file)}`);
    }
  });
  
  console.log(`\nFixed ${fixedCount} files`);
}

main();

