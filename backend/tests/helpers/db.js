const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetDb() {
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const names = tables.map(t => t.tablename).filter(name => name !== '_prisma_migrations');
  if (!names.length) return;
  const quoted = names.map(name => `"public"."${name}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE;`);
}

module.exports = { prisma, resetDb };
