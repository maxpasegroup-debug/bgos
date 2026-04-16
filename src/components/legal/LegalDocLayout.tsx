import Link from "next/link";
import type { ReactNode } from "react";

export function LegalDocLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0B0F14] px-6 py-14 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-amber-300/90 hover:underline">
          ← Back to BGOS
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/55">
          MIB- make it beautiful LLP ·{" "}
          <a href="mailto:hello@bgos.online" className="text-amber-300/90 hover:underline">
            hello@bgos.online
          </a>
        </p>
        <article className="mt-10 space-y-6 text-sm leading-relaxed text-white/75 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
          {children}
        </article>
      </div>
    </main>
  );
}
