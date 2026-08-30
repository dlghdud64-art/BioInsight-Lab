import { PrismaClient } from '@prisma/client';
import { assertScriptDbTarget } from "./lib/db-target";
import * as dotenv from "dotenv";
import * as path from "path";

// §prisma-target-helper — 게이트가 process.env 를 읽으므로 **먼저** 로드한다.
//   순서는 기존 스크립트(make-admin·backfill·import-catno)와 같다:
//   .env.local 을 먼저 읽어 우선하게 한다(Next 의 로드 순서 · db-guard.ts 와 동축).
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });



// §prisma-target-helper — 접속 전 대상 확정. Prisma 클라이언트를 만들기 **전에** 부른다.
//   대상을 말하지 않은 채 접속이 열리면 이 게이트가 없는 것과 같다.
//   출력: [db-target] ref=<ref> mode=<test|prod>
assertScriptDbTarget();

const prisma = new PrismaClient();

async function main() {
  console.log('Creating test quote...');
  
  // userId와 guestKey가 null인 공개 quote 생성
  const quote = await prisma.quote.create({
    data: {
      userId: null,
      guestKey: null,
      title: '테스트 견적 요청서',
      description: '안녕하세요.\n\n아래 품목 2건에 대한 견적을 요청드립니다.',
      status: 'PENDING',
      version: 1,
      isSnapshot: false,
    },
  });

  console.log('Quote created:', quote.id);

  // QuoteListItem 2개 생성
  await prisma.quoteListItem.createMany({
    data: [
      {
        quoteId: quote.id,
        productId: null,
        name: 'FBS Premium',
        vendor: 'Gibco',
        brand: 'Gibco',
        lineNumber: 1,
        quantity: 2,
        unitPrice: 390000,
        currency: 'KRW',
        lineTotal: 780000,
        notes: '고품질 FBS',
      },
      {
        quoteId: quote.id,
        productId: null,
        name: 'PBS Buffer 10x',
        vendor: 'Thermo Fisher',
        brand: 'Thermo Fisher',
        lineNumber: 2,
        quantity: 1,
        unitPrice: 25000,
        currency: 'KRW',
        lineTotal: 25000,
        notes: '',
      },
    ],
  });

  console.log('Items created!');
  console.log(`\n✅ Success! Visit: http://localhost:3000/test/quote?quoteId=${quote.id}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

