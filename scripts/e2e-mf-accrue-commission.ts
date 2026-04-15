/**
 * Server-side commission accrual check (run from repo root: npx tsx scripts/e2e-mf-accrue-commission.ts).
 * Env: E2E_MF_COMPANY_ID (required), E2E_MF_PAYMENT_REF (optional), E2E_MF_AMOUNT_PAISE (default 1200000).
 */
import { prisma } from "../src/lib/prisma";
import { accrueMicroFranchiseCommission } from "../src/lib/micro-franchise-commission";

async function main() {
  const companyId = process.env.E2E_MF_COMPANY_ID?.trim();
  if (!companyId) {
    console.error("FAIL: set E2E_MF_COMPANY_ID");
    process.exit(1);
  }
  const paymentRef = (process.env.E2E_MF_PAYMENT_REF?.trim() || `e2e-mf-${Date.now()}`).slice(0, 200);
  const amountPaise = Number(process.env.E2E_MF_AMOUNT_PAISE || "1200000");

  const co = await prisma.company.findUnique({
    where: { id: companyId },
    select: { microFranchisePartnerId: true, name: true },
  });
  if (!co?.microFranchisePartnerId) {
    console.error("FAIL: company has no microFranchisePartnerId — referral not linked");
    process.exit(1);
  }

  const { credited } = await accrueMicroFranchiseCommission({
    companyId,
    amountPaise,
    paymentRef,
  });

  const tx1 = await prisma.commissionTransaction.findUnique({
    where: { paymentRef },
    select: { id: true, amount: true, status: true },
  });
  const w1 = await prisma.wallet.findUnique({
    where: { partnerId: co.microFranchisePartnerId },
    select: { pending: true, totalEarned: true },
  });

  if (!tx1) {
    console.error("FAIL: no commission row (check plan % / amountPaise)", { credited, w1 });
    process.exit(1);
  }

  console.log("PASS: commission accrual", {
    company: co.name,
    credited,
    walletPending: w1?.pending,
    transaction: tx1,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
