-- AlterEnum: add ENTERPRISE (PostgreSQL: new value cannot be used in same txn as RENAME in older PG; single ADD VALUE is fine)
ALTER TYPE "CompanyPlan" ADD VALUE 'ENTERPRISE';
