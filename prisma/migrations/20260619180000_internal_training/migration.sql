-- Migration: 20260619180000_internal_training
-- Adds InternalTrainingMaterial for bgos_training_system_v2.

CREATE TYPE "TrainingMaterialType" AS ENUM ('PDF', 'VIDEO', 'SCRIPT');
CREATE TYPE "TrainingRoleScope"    AS ENUM ('ALL', 'BDE', 'BDM', 'RSM');

CREATE TABLE "internal_training_material" (
    "id"          TEXT        NOT NULL,
    "companyId"   TEXT        NOT NULL,
    "title"       TEXT        NOT NULL,
    "description" TEXT,
    "type"        "TrainingMaterialType" NOT NULL,
    "fileUrl"     TEXT        NOT NULL,
    "fileName"    TEXT,
    "roleScope"   "TrainingRoleScope" NOT NULL DEFAULT 'ALL',
    "uploadedBy"  TEXT        NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_training_material_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "internal_training_material_companyId_idx"
    ON "internal_training_material"("companyId");

CREATE INDEX "internal_training_material_uploadedBy_idx"
    ON "internal_training_material"("uploadedBy");

ALTER TABLE "internal_training_material"
    ADD CONSTRAINT "internal_training_material_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
