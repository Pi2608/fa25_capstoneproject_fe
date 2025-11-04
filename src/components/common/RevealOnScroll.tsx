"use client";

import { useEffect } from "react";

export default function RevealOnScroll() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target as Element);
        }
      });
    }, { threshold: 0.16 });

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <style jsx global>{`
      [data-reveal]{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
      [data-reveal].in{opacity:1;transform:none}
    `}</style>
  );
}
