import { PrismaClient } from '@prisma/client';

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

