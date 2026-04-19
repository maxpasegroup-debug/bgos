-- bgos_scale_v1 — Additional DB indexes for scalability
-- Adds standalone and composite indexes used by paginated queries
-- and batch active-subscription counts.

-- SalesHierarchySubscription: standalone ownerUserId index
CREATE INDEX IF NOT EXISTS "sales_subscriptions_ownerUserId_idx"
  ON "sales_subscriptions"("ownerUserId");

-- SalesHierarchyEarning: standalone userId index
CREATE INDEX IF NOT EXISTS "sales_hierarchy_earnings_userId_idx"
  ON "sales_hierarchy_earnings"("userId");

-- PromotionTracker: standalone userId index
CREATE INDEX IF NOT EXISTS "promotion_tracker_userId_idx"
  ON "promotion_tracker"("userId");

-- UserCompany: (companyId, createdAt) composite index
CREATE INDEX IF NOT EXISTS "UserCompany_companyId_createdAt_idx"
  ON "UserCompany"("companyId", "createdAt");
