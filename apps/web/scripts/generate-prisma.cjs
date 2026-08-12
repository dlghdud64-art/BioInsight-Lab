// Prisma Client 생성 스크립트
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Generating Prisma Client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
  console.log('✅ Prisma Client generated successfully!');
} catch (error) {
  console.error('❌ Failed to generate Prisma Client:', error.message);
  // 오류가 발생해도 계속 진행 (개발 서버가 자동으로 생성 시도)
  console.log('⚠️ Continuing anyway - Prisma Client may be generated on first use');
}


const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Generating Prisma Client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
  console.log('✅ Prisma Client generated successfully!');
} catch (error) {
  console.error('❌ Failed to generate Prisma Client:', error.message);
  // 오류가 발생해도 계속 진행 (개발 서버가 자동으로 생성 시도)
  console.log('⚠️ Continuing anyway - Prisma Client may be generated on first use');
}


const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Generating Prisma Client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
  console.log('✅ Prisma Client generated successfully!');
} catch (error) {
  console.error('❌ Failed to generate Prisma Client:', error.message);
  // 오류가 발생해도 계속 진행 (개발 서버가 자동으로 생성 시도)
  console.log('⚠️ Continuing anyway - Prisma Client may be generated on first use');
}






