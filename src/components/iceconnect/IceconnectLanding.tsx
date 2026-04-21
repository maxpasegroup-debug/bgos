import Link from "next/link";

export function IceconnectLanding() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#020617_0%,#0f172a_42%,#111827_100%)] px-6 py-14 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 0% 50%, rgba(56,189,248,0.08), transparent 55%), radial-gradient(ellipse 50% 45% at 100% 20%, rgba(129,140,248,0.09), transparent 50%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-[80vh] w-full max-w-5xl flex-col justify-center gap-10 lg:flex-row lg:items-center lg:justify-between">
        <section className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300/85">
            ICECONNECT
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Field Execution
            <span className="block bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-transparent">
              That Actually Compounds
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65">
            The employee workspace for sales, service, installation, and operations teams. Keep execution aligned, move leads faster, and stay accountable in real time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/iceconnect/login"
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-semibold text-[#1c0a02] shadow-[0_0_28px_rgba(251,146,60,0.28)] transition hover:brightness-105"
            >
              Employee Login
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-white/20 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
            >
              Talk to Team
            </Link>
          </div>
        </section>

        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
            Built for Teams
          </p>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            <li>Sales and lead execution dashboards</li>
            <li>Service and installation tracking</li>
            <li>Role-based workflow routing</li>
            <li>Mobile-first field operations</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
