"use client";
import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";

export default function PageEnter({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-fade]",
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: "power2.out" }
      );
    }, scope);
    return () => ctx.revert();
  }, []);

  return <div ref={scope}>{children}</div>;
}
