import { redirect } from "next/navigation";
import { WorkflowManageClient } from "@/components/onboarding-workflow/WorkflowManageClient";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function OnboardingWorkflowManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUserFromHeaders();
  const { id } = await params;
  if (!user) {
    redirect(`/login?from=${encodeURIComponent(`/onboarding/manage/${id}`)}`);
  }
  return <WorkflowManageClient />;
}
