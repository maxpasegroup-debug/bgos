import Link from "next/link";
import { redirect } from "next/navigation";

type Mode = "send_form" | "fill_for_client";

export default async function OnboardingIndustryPage({
  params,
  searchParams,
}: {
  params: Promise<{ industry: string }>;
  searchParams: Promise<{ submissionId?: string; token?: string; mode?: string }>;
}) {
  const { industry } = await params;
  const q = await searchParams;
  const mode = (q.mode ?? "").trim() as Mode;
  const submissionId = (q.submissionId ?? "").trim();
  const token = (q.token ?? "").trim();

  if (industry !== "solar" && industry !== "custom") {
    redirect("/onboarding");
  }

  if (mode === "send_form" && token) {
    redirect(`/onboarding/fill/${encodeURIComponent(token)}`);
  }
  if (mode === "fill_for_client" && submissionId) {
    redirect(`/onboarding/manage/${encodeURIComponent(submissionId)}`);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">
        Onboarding: {industry === "solar" ? "Solar" : "Custom"}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        The onboarding session is ready. Continue with one of the options.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {token ? (
          <Link
            href={`/onboarding/fill/${encodeURIComponent(token)}`}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Open Client Form
          </Link>
        ) : null}
        {submissionId ? (
          <Link
            href={`/onboarding/manage/${encodeURIComponent(submissionId)}`}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800"
          >
            Fill on Behalf
          </Link>
        ) : null}
      </div>
    </main>
  );
}

