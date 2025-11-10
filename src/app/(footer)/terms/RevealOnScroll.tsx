"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function RevealOnScroll() {
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const els = gsap.utils.toArray<HTMLElement>("[data-reveal]");

    els.forEach((el, i) => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 16, scale: 0.98 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: reduce ? 0 : 0.5,
          ease: "power2.out",
          delay: reduce ? 0 : Math.min(i * 0.03, 0.2),
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
      gsap.globalTimeline.clear();
    };
  }, []);

  return null;
}
