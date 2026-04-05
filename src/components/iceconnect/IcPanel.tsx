export function IcPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400/90">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
