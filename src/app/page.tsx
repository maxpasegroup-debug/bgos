import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] px-6 text-white">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">BGOS</h1>
        <p className="mt-4 text-base text-white/70">
          Built for smarter business operations. Manage teams, sales, and growth from a single
          platform.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-400"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:border-white/40"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
