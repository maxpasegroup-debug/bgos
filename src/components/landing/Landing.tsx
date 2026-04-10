"use client";

import { Header } from "./Header";
import { Hero } from "./Hero";
import { WhatIsBgos } from "./WhatIsBgos";
import { BusinessShowers } from "./BusinessShowers";
import { SalesBoosterHighlight } from "./SalesBoosterHighlight";
import { Features } from "./Features";
import { PricingSection } from "./PricingSection";
import { TrustSection } from "./TrustSection";
import { Cta } from "./Cta";
import { Footer } from "./Footer";
import { CursorGlow } from "./CursorGlow";
import { ParallaxGlows } from "./ParallaxGlows";

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0F14] text-slate-100">
      <ParallaxGlows />
      <div
        className="pointer-events-none fixed inset-0 z-[25] bg-noise opacity-[0.03] mix-blend-overlay"
        aria-hidden
      />
      <CursorGlow />
      <Header />
      <main className="relative z-10 flex flex-col">
        <Hero />
        <BusinessShowers />
        <WhatIsBgos />
        <SalesBoosterHighlight />
        <Features />
        <PricingSection />
        <TrustSection />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
