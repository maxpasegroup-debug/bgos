-- Prisma @updatedAt: no database default (application sets on write)
ALTER TABLE "Lead" ALTER COLUMN "updatedAt" DROP DEFAULT;
