"use client";

import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { sectionDivider, sectionY } from "./spacing";

export function TrustSection() {
  return (
    <SectionReveal className={`${sectionDivider} ${sectionY}`}>
      <Container>
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built for Real Business Owners
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
            Designed for teams who want clarity, control, and growth.
          </p>
        </div>
      </Container>
    </SectionReveal>
  );
}
