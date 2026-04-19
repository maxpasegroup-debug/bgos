-- Migration: 20260619190000_internal_leaderboard
-- Adds InternalLeaderboard for bgos_competition_engine_v2.

CREATE TABLE "internal_leaderboard" (
    "userId"    TEXT             NOT NULL,
    "companyId" TEXT             NOT NULL,
    "score"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank"      INTEGER          NOT NULL DEFAULT 0,
    "userName"  TEXT,
    "role"      "SalesNetworkRole",
    "updatedAt" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_leaderboard_pkey" PRIMARY KEY ("userId")
);

-- Hot-path index: WHERE companyId = ? ORDER BY rank ASC LIMIT 50
CREATE INDEX "internal_leaderboard_companyId_rank_idx"
    ON "internal_leaderboard"("companyId", "rank");

ALTER TABLE "internal_leaderboard"
    ADD CONSTRAINT "internal_leaderboard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
