export function AccessMismatchError({
  title = "Access mismatch error",
  message = "Your account role does not match this workspace. Please switch to your assigned dashboard.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-rose-300/50 bg-rose-50 p-6 text-center text-rose-900">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-rose-800">{message}</p>
      <p className="mt-4 text-xs text-rose-700">If this looks wrong, contact your administrator.</p>
    </div>
  );
}
