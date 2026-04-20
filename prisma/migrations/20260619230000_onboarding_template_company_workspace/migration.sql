-- Onboarding template (mirrors dashboardType) + company tenant routing + limit defaults

ALTER TABLE "onboarding_requests" ADD COLUMN "template" "OnboardingRequestDashboardType";
UPDATE "onboarding_requests" SET "template" = "dashboardType" WHERE "template" IS NULL;
ALTER TABLE "onboarding_requests" ALTER COLUMN "template" SET NOT NULL;

ALTER TABLE "Company" ADD COLUMN "workspaceDomain" "EmployeeDomain" NOT NULL DEFAULT 'SOLAR';
ALTER TABLE "Company" ADD COLUMN "dashboardTemplate" "OnboardingRequestDashboardType" NOT NULL DEFAULT 'SOLAR';

ALTER TABLE "company_limits" ALTER COLUMN "maxUsers" SET DEFAULT 5;
ALTER TABLE "company_limits" ALTER COLUMN "maxLeads" SET DEFAULT 200;
ALTER TABLE "company_limits" ALTER COLUMN "maxProjects" SET DEFAULT 50;
