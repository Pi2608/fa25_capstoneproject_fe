"use client";

import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type HeroSelectors = {
  title: string | string[];
  subtitle?: string | string[];
  cta?: string | string[];
};

type StaggerConfig = {
  container: string;
  card: string;
  start?: string;
};

export interface UseGsapHomeScrollOptions {
  reduce?: boolean;
  heroSelectors?: HeroSelectors;     
  fadeSelector?: string;              
  fadeStart?: string;                
  stagger?: StaggerConfig;           
}

export function useGsapHomeScroll(options: UseGsapHomeScrollOptions) {
  const { reduce, heroSelectors, fadeSelector, fadeStart, stagger } = options;

  useLayoutEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const effectiveReduce = prefersReduced || reduce;
    const durationBase = effectiveReduce ? 0 : 0.9;
    const durationScroll = effectiveReduce ? 0 : 0.7;

    const base = {
      ease: "power2.out",
      duration: durationBase,
    } as const;

    const ctx = gsap.context(() => {
      // 1) Hero intro (optional)
      if (heroSelectors) {
        const { title, subtitle, cta } = heroSelectors;

        const toArr = (sel?: string | string[]) =>
          typeof sel === "string" ? [sel] : sel ?? [];

        const titleArr = toArr(title);
        const subArr = toArr(subtitle);
        const ctaArr = toArr(cta);

        const allTargets = [...titleArr, ...subArr, ...ctaArr];

        if (allTargets.length > 0) {
          gsap.set(allTargets, { autoAlpha: 0, y: 20 });

          const tl = gsap.timeline();
          const [titleSel] = titleArr;
          const [subSel] = subArr;
          const [ctaSel] = ctaArr;

          if (titleSel) {
            tl.to(titleSel, { autoAlpha: 1, y: 0, ...base });
          }
          if (subSel) {
            tl.to(subSel, { autoAlpha: 1, y: 0, ...base }, "<0.08");
          }
          if (ctaSel) {
            tl.to(ctaSel, { autoAlpha: 1, y: 0, ...base }, "<0.08");
          }
        }
      }

      // 2) Các block fade-in (optional)
      if (fadeSelector) {
        gsap.utils.toArray<HTMLElement>(fadeSelector).forEach((el, index) => {
          gsap.set(el, { autoAlpha: 0, y: 20 });

          ScrollTrigger.create({
            trigger: el,
            start: fadeStart ?? "top 85%",
            onEnter: () =>
              gsap.to(el, {
                autoAlpha: 1,
                y: 0,
                duration: durationScroll,
                ease: "power2.out",
                delay: index * 0.03,
              }),
          });
        });
      }

      // 3) Stagger card list (optional)
      if (stagger) {
        const { container, card, start } = stagger;

        gsap.utils.toArray<HTMLElement>(container).forEach((wrap) => {
          const cards = wrap.querySelectorAll<HTMLElement>(card);
          if (!cards.length) return;

          gsap.set(cards, { autoAlpha: 0, y: 18 });

          ScrollTrigger.create({
            trigger: wrap,
            start: start ?? "top 80%",
            onEnter: () =>
              gsap.to(cards, {
                autoAlpha: 1,
                y: 0,
                stagger: 0.08,
                duration: durationScroll,
                ease: "power2.out",
              }),
          });
        });
      }
    });

    return () => {
      ctx.revert();
    };
  }, [
    reduce,
    heroSelectors?.title,
    heroSelectors?.subtitle,
    heroSelectors?.cta,
    fadeSelector,
    fadeStart,
    stagger?.container,
    stagger?.card,
    stagger?.start,
  ]);
}
