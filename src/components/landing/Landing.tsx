"use client";

import { Header } from "./Header";
import { Hero } from "./Hero";
import { WhatIsBgos } from "./WhatIsBgos";
import { BusinessShowers } from "./BusinessShowers";
import { Features } from "./Features";
import { PeaceOfMind } from "./PeaceOfMind";
import { Cta } from "./Cta";
import { Footer } from "./Footer";
import { CursorGlow } from "./CursorGlow";
import { ParallaxGlows } from "./ParallaxGlows";

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-black via-[#0B0F19] to-black">
      <ParallaxGlows />
      <div
        className="pointer-events-none fixed inset-0 z-[25] bg-noise opacity-[0.028] mix-blend-overlay"
        aria-hidden
      />
      <CursorGlow />
      <Header />
      <main className="relative z-10 flex flex-col">
        <Hero />
        <WhatIsBgos />
        <BusinessShowers />
        <Features />
        <PeaceOfMind />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
