/**
 * Human-readable job role for document vault UI (matches BGOS “Boss” wording).
 */
export function formatDocumentUploaderRole(role: string): string {
  if (role === "ADMIN") return "Boss";
  if (!role) return "—";
  return role
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
