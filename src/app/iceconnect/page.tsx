import { redirect } from "next/navigation";

/** Middleware redirects authenticated users from /iceconnect to their role home. */
export default function IceconnectRootPage() {
  redirect("/login");
}
