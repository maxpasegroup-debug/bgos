-- Expand CRM pipeline + track lead updates

CREATE TYPE "LeadStatus_new" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SITE_VISIT_SCHEDULED',
  'SITE_VISIT_COMPLETED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST'
);

ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING (
  CASE "status"::text
    WHEN 'NEW' THEN 'NEW'::"LeadStatus_new"
    WHEN 'CONTACTED' THEN 'CONTACTED'::"LeadStatus_new"
    WHEN 'QUALIFIED' THEN 'QUALIFIED'::"LeadStatus_new"
    WHEN 'VISIT' THEN 'SITE_VISIT_SCHEDULED'::"LeadStatus_new"
    WHEN 'PROPOSAL' THEN 'PROPOSAL_SENT'::"LeadStatus_new"
    WHEN 'NEGOTIATION' THEN 'NEGOTIATION'::"LeadStatus_new"
    WHEN 'WON' THEN 'WON'::"LeadStatus_new"
    WHEN 'LOST' THEN 'LOST'::"LeadStatus_new"
    ELSE 'NEW'::"LeadStatus_new"
  END
);

ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW'::"LeadStatus_new";

DROP TYPE "LeadStatus";

ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";

ALTER TABLE "Lead" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
