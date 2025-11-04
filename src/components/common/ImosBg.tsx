"use client";

import { useEffect, useRef } from "react";

export default function ImosBg() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const state = { x: 0.5, y: 0.35, tx: 0.5, ty: 0.35, raf: 0 as number | 0 };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      state.tx = (e.clientX - r.left) / r.width;
      state.ty = (e.clientY - r.top) / r.height;
      if (!state.raf) tick();
    };

    const tick = () => {
      state.x += (state.tx - state.x) * 0.08;
      state.y += (state.ty - state.y) * 0.08;
      el.style.setProperty("--mx", state.x.toFixed(4));
      el.style.setProperty("--my", state.y.toFixed(4));
      state.raf = Math.abs(state.tx - state.x) < 1e-3 && Math.abs(state.ty - state.y) < 1e-3
        ? 0
        : requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (state.raf) cancelAnimationFrame(state.raf);
    };
  }, []);

  return (
    <>
      <div ref={ref} className="imos-bg fixed inset-0 -z-30 pointer-events-none" />
      <style jsx global>{`
        .imos-bg{
          --mx:.5; --my:.35;
          background:
            radial-gradient(900px 520px at calc(var(--mx)*100%) calc(var(--my)*100%), rgba(16,185,129,.30), transparent 60%),
            radial-gradient(700px 420px at calc((1 - var(--mx))*90%) calc(var(--my)*85%), rgba(56,189,248,.18), transparent 60%),
            radial-gradient(1100px 620px at 50% 20%, rgba(34,197,94,.16), transparent 65%),
            #070b0b;
        }
        /* lớp grid mờ + overlay */
        .imos-bg::before{
          content:"";
          position:absolute; inset:0;
          background-image:
            linear-gradient(to bottom, rgba(0,0,0,.28), transparent 22%),
            radial-gradient(2px 2px at 20px 20px, rgba(255,255,255,.035) 1px, transparent 1px);
          background-size: 100% 100%, 40px 40px;
          mix-blend-mode: overlay;
        }
        .imos-bg::after{
          content:"";
          position:absolute; inset:0;
          box-shadow: inset 0 0 220px rgba(0,0,0,.55);
        }

        @media (prefers-reduced-motion: reduce){
          .imos-bg{ background:
            radial-gradient(900px 520px at 50% 35%, rgba(16,185,129,.28), transparent 60%),
            radial-gradient(700px 420px at 70% 70%, rgba(56,189,248,.18), transparent 60%),
            radial-gradient(1100px 620px at 50% 20%, rgba(34,197,94,.16), transparent 65%),
            #070b0b;
          }
        }
      `}</style>
    </>
  );
}
