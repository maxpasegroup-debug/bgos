import { redirect } from "next/navigation";
import { BGOS_ONBOARDING_ENTRY } from "@/lib/system-readiness";

type Sp = Record<string, string | string[] | undefined>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Sp> | Sp;
}) {
  const sp = await Promise.resolve(searchParams);
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === "string" && val.length > 0) q.set(key, val);
    else if (Array.isArray(val) && typeof val[0] === "string" && val[0].length > 0) q.set(key, val[0]);
  }
  const tail = q.toString();
  redirect(tail ? `${BGOS_ONBOARDING_ENTRY}?${tail}` : BGOS_ONBOARDING_ENTRY);
}
