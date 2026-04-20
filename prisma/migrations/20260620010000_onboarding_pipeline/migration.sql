-- Sales controlled onboarding pipeline (RSM -> BDM -> BDE -> Tech)

CREATE TYPE "OnboardingPipelineSourceType" AS ENUM ('INBOUND', 'BDE', 'BDM', 'RSM');
CREATE TYPE "OnboardingPipelineStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'SENT_TO_TECH', 'COMPLETED');

CREATE TABLE "onboarding_pipeline" (
  "id" TEXT NOT NULL,
  "company_id" TEXT,
  "company_name" TEXT NOT NULL,
  "source_type" "OnboardingPipelineSourceType" NOT NULL,
  "source_user_id" TEXT,
  "assigned_rsm_id" TEXT,
  "assigned_bdm_id" TEXT,
  "assigned_bde_id" TEXT,
  "status" "OnboardingPipelineStatus" NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "onboarding_pipeline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "onboarding_pipeline_company_id_idx" ON "onboarding_pipeline"("company_id");
CREATE INDEX "onboarding_pipeline_status_created_at_idx" ON "onboarding_pipeline"("status", "created_at");
CREATE INDEX "onboarding_pipeline_assigned_rsm_id_status_created_at_idx" ON "onboarding_pipeline"("assigned_rsm_id", "status", "created_at");
CREATE INDEX "onboarding_pipeline_assigned_bdm_id_status_created_at_idx" ON "onboarding_pipeline"("assigned_bdm_id", "status", "created_at");
CREATE INDEX "onboarding_pipeline_assigned_bde_id_status_created_at_idx" ON "onboarding_pipeline"("assigned_bde_id", "status", "created_at");

ALTER TABLE "onboarding_pipeline"
  ADD CONSTRAINT "onboarding_pipeline_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "onboarding_pipeline"
  ADD CONSTRAINT "onboarding_pipeline_source_user_id_fkey"
  FOREIGN KEY ("source_user_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "onboarding_pipeline"
  ADD CONSTRAINT "onboarding_pipeline_assigned_rsm_id_fkey"
  FOREIGN KEY ("assigned_rsm_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "onboarding_pipeline"
  ADD CONSTRAINT "onboarding_pipeline_assigned_bdm_id_fkey"
  FOREIGN KEY ("assigned_bdm_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "onboarding_pipeline"
  ADD CONSTRAINT "onboarding_pipeline_assigned_bde_id_fkey"
  FOREIGN KEY ("assigned_bde_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
