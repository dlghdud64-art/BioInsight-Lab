import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'OWNER'`);
  console.log('✅ Added OWNER to OrganizationRole enum');

  // Data migration: first ADMIN by createdAt becomes OWNER for each org
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    const firstAdmin = await prisma.organizationMember.findFirst({
      where: { organizationId: org.id, role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (firstAdmin) {
      await prisma.organizationMember.update({
        where: { id: firstAdmin.id },
        data: { role: 'OWNER' },
      });
      console.log(`✅ Set OWNER for org ${org.id}: member ${firstAdmin.id}`);
    }
  }
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
