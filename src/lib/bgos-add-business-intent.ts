/**
 * Client-only: “Add New Business” from the header sets this before navigating to
 * `/onboarding` so the page can show the create form for already-activated users.
 * The flag is removed when onboarding commits to that flow (see onboarding page).
 */

export const BGOS_ADD_BUSINESS_INTENT_KEY = "bgos:add-business";

export function prepareAddBusinessNavigation(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(BGOS_ADD_BUSINESS_INTENT_KEY, "1");
}
