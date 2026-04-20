# Dead/Legacy Cleanup Manifest

Conservative delete set chosen with all checks:

1. No internal route references in `src/**`
2. Not referenced in `src/middleware.ts`
3. Not part of canonical runtime surfaces:
   - `/bgos-boss`
   - `/solar-boss`
   - `/iceconnect/*`
4. Excluded critical systems (auth, payment, onboarding, nexa, wallet, missions)

## Files to delete

- `src/app/bgos/automation/page.tsx` — legacy BGOS surface, no internal references
- `src/app/bgos/control/clients/[companyId]/page.tsx` — duplicate legacy control page, no internal references
- `src/app/bgos/control/home/page.tsx` — legacy control entry, no internal references
- `src/app/bgos/control/micro-franchise/offers/page.tsx` — legacy duplicate page, no internal references
- `src/app/bgos/control/offers-incentives/page.tsx` — legacy duplicate page, no internal references
- `src/app/bgos/control/sales-booster/page.tsx` — legacy duplicate page, no internal references
- `src/app/bgos/control/tech-requests/page.tsx` — legacy duplicate page, no internal references
- `src/app/bgos/documents/page.tsx` — legacy duplicate page, no internal references
- `src/app/bgos/leads/[id]/page.tsx` — legacy detail page, no internal references
- `src/app/bgos/money/invoices/[id]/page.tsx` — legacy invoice detail page, no internal references
- `src/app/sales-booster/dashboard/page.tsx` — duplicate sales-booster dashboard surface, no internal references
