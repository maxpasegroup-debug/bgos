-- Remap roles before enum change
UPDATE "UserCompany"
SET "jobRole" = 'BDM'
WHERE "jobRole" IN (
  'SALES_HEAD','SALES_EXECUTIVE',
  'TELECALLER','CHANNEL_PARTNER',
  'MICRO_FRANCHISE'
);

UPDATE "UserCompany"
SET "jobRole" = 'TECH_EXECUTIVE'
WHERE "jobRole" IN (
  'SITE_ENGINEER','INSTALLATION_TEAM',
  'SERVICE_TEAM','PRO'
);

UPDATE "UserCompany"
SET "jobRole" = 'MANAGER'
WHERE "jobRole" IN (
  'ACCOUNTANT','HR_MANAGER',
  'OPERATIONS_HEAD','INVENTORY_MANAGER',
  'LCO'
);

-- PART 2: Prisma diff SQL

-- AlterEnum
BEGIN;
ALTER TABLE "internal_leaderboard" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);
ALTER TABLE "UserCompany" ALTER COLUMN "jobRole" DROP DEFAULT;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'MANAGER', 'BDM', 'TECH_HEAD', 'TECH_EXECUTIVE');
ALTER TABLE "UserCompany" ALTER COLUMN "jobRole" TYPE "UserRole_new" USING ("jobRole"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ChannelPartner" DROP CONSTRAINT "ChannelPartner_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ChannelPartner" DROP CONSTRAINT "ChannelPartner_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_leadId_fkey";

-- DropForeignKey
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "CommissionTransaction" DROP CONSTRAINT "CommissionTransaction_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CommissionTransaction" DROP CONSTRAINT "CommissionTransaction_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_launchChannelPartnerId_fkey";

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_microFranchisePartnerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerComplaint" DROP CONSTRAINT "CustomerComplaint_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerComplaint" DROP CONSTRAINT "CustomerComplaint_leadId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerPortalUser" DROP CONSTRAINT "CustomerPortalUser_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerPortalUser" DROP CONSTRAINT "CustomerPortalUser_leadId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeePip" DROP CONSTRAINT "EmployeePip_companyId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeePip" DROP CONSTRAINT "EmployeePip_userId_fkey";

-- DropForeignKey
ALTER TABLE "InternalEmployeeDailyTarget" DROP CONSTRAINT "InternalEmployeeDailyTarget_companyId_fkey";

-- DropForeignKey
ALTER TABLE "LcoLoan" DROP CONSTRAINT "LcoLoan_companyId_fkey";

-- DropForeignKey
ALTER TABLE "LcoLoan" DROP CONSTRAINT "LcoLoan_leadId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "MicroFranchiseAlert" DROP CONSTRAINT "MicroFranchiseAlert_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "MicroFranchiseApplication" DROP CONSTRAINT "MicroFranchiseApplication_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "MicroFranchiseApplication" DROP CONSTRAINT "MicroFranchiseApplication_referredById_fkey";

-- DropForeignKey
ALTER TABLE "MicroFranchisePartner" DROP CONSTRAINT "MicroFranchisePartner_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "MicroFranchisePartner" DROP CONSTRAINT "MicroFranchisePartner_commissionPlanId_fkey";

-- DropForeignKey
ALTER TABLE "MicroFranchisePartner" DROP CONSTRAINT "MicroFranchisePartner_userId_fkey";

-- DropForeignKey
ALTER TABLE "SalesExecutiveMonthlyTarget" DROP CONSTRAINT "SalesExecutiveMonthlyTarget_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesExecutiveMonthlyTarget" DROP CONSTRAINT "SalesExecutiveMonthlyTarget_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserCompany" DROP CONSTRAINT "UserCompany_parentUserId_fkey";

-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "bde_missions" DROP CONSTRAINT "bde_missions_userId_fkey";

-- DropForeignKey
ALTER TABLE "bde_onboarding" DROP CONSTRAINT "bde_onboarding_userId_fkey";

-- DropForeignKey
ALTER TABLE "bde_prospects" DROP CONSTRAINT "bde_prospects_missionId_fkey";

-- DropForeignKey
ALTER TABLE "bde_prospects" DROP CONSTRAINT "bde_prospects_userId_fkey";

-- DropForeignKey
ALTER TABLE "bde_prospects" DROP CONSTRAINT "bde_prospects_userMissionId_fkey";

-- DropForeignKey
ALTER TABLE "bde_rewards" DROP CONSTRAINT "bde_rewards_userId_fkey";

-- DropForeignKey
ALTER TABLE "bde_streaks" DROP CONSTRAINT "bde_streaks_userId_fkey";

-- DropForeignKey
ALTER TABLE "bde_tasks" DROP CONSTRAINT "bde_tasks_missionId_fkey";

-- DropForeignKey
ALTER TABLE "bde_tasks" DROP CONSTRAINT "bde_tasks_userId_fkey";

-- DropForeignKey
ALTER TABLE "bde_wallet_transactions" DROP CONSTRAINT "bde_wallet_transactions_userId_fkey";

-- DropForeignKey
ALTER TABLE "bde_wallets" DROP CONSTRAINT "bde_wallets_userId_fkey";

-- DropForeignKey
ALTER TABLE "bde_withdraw_requests" DROP CONSTRAINT "bde_withdraw_requests_userId_fkey";

-- DropForeignKey
ALTER TABLE "internal_fraud_log" DROP CONSTRAINT "internal_fraud_log_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_companyId_fkey";

-- DropForeignKey
ALTER TABLE "network_commissions" DROP CONSTRAINT "network_commissions_companyId_fkey";

-- DropForeignKey
ALTER TABLE "network_commissions" DROP CONSTRAINT "network_commissions_sourceUserId_fkey";

-- DropForeignKey
ALTER TABLE "network_commissions" DROP CONSTRAINT "network_commissions_userId_fkey";

-- DropForeignKey
ALTER TABLE "performance_metrics" DROP CONSTRAINT "performance_metrics_companyId_fkey";

-- DropForeignKey
ALTER TABLE "performance_metrics" DROP CONSTRAINT "performance_metrics_userId_fkey";

-- DropForeignKey
ALTER TABLE "promotion_tracker" DROP CONSTRAINT "promotion_tracker_companyId_fkey";

-- DropForeignKey
ALTER TABLE "promotion_tracker" DROP CONSTRAINT "promotion_tracker_userId_fkey";

-- DropForeignKey
ALTER TABLE "sales_booster_automation_flows" DROP CONSTRAINT "sales_booster_automation_flows_companyId_fkey";

-- DropForeignKey
ALTER TABLE "sales_booster_campaigns" DROP CONSTRAINT "sales_booster_campaigns_companyId_fkey";

-- DropForeignKey
ALTER TABLE "sales_booster_connections" DROP CONSTRAINT "sales_booster_connections_companyId_fkey";

-- DropForeignKey
ALTER TABLE "sales_booster_messages" DROP CONSTRAINT "sales_booster_messages_companyId_fkey";

-- DropForeignKey
ALTER TABLE "sales_hierarchy_earnings" DROP CONSTRAINT "sales_hierarchy_earnings_companyId_fkey";

-- DropForeignKey
ALTER TABLE "sales_hierarchy_earnings" DROP CONSTRAINT "sales_hierarchy_earnings_sourceUserId_fkey";

-- DropForeignKey
ALTER TABLE "sales_hierarchy_earnings" DROP CONSTRAINT "sales_hierarchy_earnings_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "sales_hierarchy_earnings" DROP CONSTRAINT "sales_hierarchy_earnings_userId_fkey";

-- DropForeignKey
ALTER TABLE "sales_network_targets" DROP CONSTRAINT "sales_network_targets_companyId_fkey";

-- DropForeignKey
ALTER TABLE "sales_subscriptions" DROP CONSTRAINT "sales_subscriptions_companyId_fkey";

-- DropForeignKey
ALTER TABLE "sales_subscriptions" DROP CONSTRAINT "sales_subscriptions_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "user_missions" DROP CONSTRAINT "user_missions_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_tasks" DROP CONSTRAINT "user_tasks_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_tasks" DROP CONSTRAINT "user_tasks_userMissionId_fkey";

-- DropIndex
DROP INDEX "Company_launchChannelPartnerId_idx";

-- DropIndex
DROP INDEX "Company_microFranchisePartnerId_idx";

-- DropIndex
DROP INDEX "Lead_partnerId_idx";

-- DropIndex
DROP INDEX "UserCompany_companyId_salesNetworkRole_idx";

-- DropIndex
DROP INDEX "UserCompany_parentUserId_idx";

-- DropIndex
DROP INDEX "internal_fraud_log_subscriptionId_idx";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "launchChannelPartnerId",
DROP COLUMN "microFranchisePartnerId";

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "partnerId";

-- AlterTable
ALTER TABLE "UserCompany" DROP COLUMN "activeSubscriptionsCount",
DROP COLUMN "bdeSlotLimit",
DROP COLUMN "benefitLevel",
DROP COLUMN "parentUserId",
DROP COLUMN "recurringCap",
DROP COLUMN "region",
DROP COLUMN "salesNetworkRole",
DROP COLUMN "totalPoints";

-- AlterTable
ALTER TABLE "internal_fraud_log" DROP COLUMN "subscriptionId";

-- AlterTable
ALTER TABLE "internal_leaderboard" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);

-- DropTable
DROP TABLE "BonusCampaign";

-- DropTable
DROP TABLE "ChannelPartner";

-- DropTable
DROP TABLE "Commission";

-- DropTable
DROP TABLE "CommissionPlan";

-- DropTable
DROP TABLE "CommissionRule";

-- DropTable
DROP TABLE "CommissionTransaction";

-- DropTable
DROP TABLE "CustomerComplaint";

-- DropTable
DROP TABLE "CustomerPortalUser";

-- DropTable
DROP TABLE "EmployeePip";

-- DropTable
DROP TABLE "InternalEmployeeDailyTarget";

-- DropTable
DROP TABLE "LaunchChannelPartner";

-- DropTable
DROP TABLE "LcoLoan";

-- DropTable
DROP TABLE "MegaPrizeCampaign";

-- DropTable
DROP TABLE "MicroFranchiseAlert";

-- DropTable
DROP TABLE "MicroFranchiseApplication";

-- DropTable
DROP TABLE "MicroFranchisePartner";

-- DropTable
DROP TABLE "OfferAnnouncement";

-- DropTable
DROP TABLE "SalesExecutiveMonthlyTarget";

-- DropTable
DROP TABLE "TargetCampaign";

-- DropTable
DROP TABLE "Wallet";

-- DropTable
DROP TABLE "bde_missions";

-- DropTable
DROP TABLE "bde_onboarding";

-- DropTable
DROP TABLE "bde_prospects";

-- DropTable
DROP TABLE "bde_rewards";

-- DropTable
DROP TABLE "bde_streaks";

-- DropTable
DROP TABLE "bde_tasks";

-- DropTable
DROP TABLE "bde_wallet_transactions";

-- DropTable
DROP TABLE "bde_wallets";

-- DropTable
DROP TABLE "bde_withdraw_requests";

-- DropTable
DROP TABLE "inventory";

-- DropTable
DROP TABLE "network_commissions";

-- DropTable
DROP TABLE "performance_metrics";

-- DropTable
DROP TABLE "promotion_tracker";

-- DropTable
DROP TABLE "sales_booster_automation_flows";

-- DropTable
DROP TABLE "sales_booster_campaigns";

-- DropTable
DROP TABLE "sales_booster_connections";

-- DropTable
DROP TABLE "sales_booster_messages";

-- DropTable
DROP TABLE "sales_hierarchy_earnings";

-- DropTable
DROP TABLE "sales_network_targets";

-- DropTable
DROP TABLE "sales_subscriptions";

-- DropTable
DROP TABLE "user_missions";

-- DropTable
DROP TABLE "user_tasks";

-- DropEnum
DROP TYPE "BdeProspectPipelineStage";

-- DropEnum
DROP TYPE "BdeRewardStatus";

-- DropEnum
DROP TYPE "BdeTaskStatus";

-- DropEnum
DROP TYPE "BdeWalletTransactionType";

-- DropEnum
DROP TYPE "BdeWithdrawRequestStatus";

-- DropEnum
DROP TYPE "EarningPayoutStatus";

-- DropEnum
DROP TYPE "NetworkCommissionType";

-- DropEnum
DROP TYPE "SalesBenefitLevel";

-- DropEnum
DROP TYPE "SalesHierarchyPlan";

-- DropEnum
DROP TYPE "SalesHierarchySubscriptionStatus";

-- DropEnum
DROP TYPE "SalesNetworkRole";

-- DropEnum
DROP TYPE "UserMissionStatus";

-- DropEnum
DROP TYPE "UserMissionType";

-- DropEnum
DROP TYPE "UserTaskStatus";
