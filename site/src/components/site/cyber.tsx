import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Pointer-tracked glowing borders for the library bento, after 21st.dev
 * "Cybernetic Bento Grid" (dhileepkumargm). One delegated listener on the grid writes
 * --mx/--my into whichever cell the pointer is over; the CSS draws the spotlight and the
 * masked border ring at that point. No per-cell listeners, nothing on the server.
 */
export function GlowGrid({ children, className = "bento" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const onMove = (e: MouseEvent) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>(".bento__cell");
      if (!cell) return;
      const r = cell.getBoundingClientRect();
      cell.style.setProperty("--mx", `${e.clientX - r.left}px`);
      cell.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    grid.addEventListener("mousemove", onMove, { passive: true });
    return () => grid.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Counts a number up from zero on mount. Renders the final value on the server. */
export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const [n, setN] = useState(value);
  const nf = new Intl.NumberFormat("en-US");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{nf.format(n)}</>;
}

/** Types a command out on mount; the full text renders on the server so nothing is hidden. */
export function Typed({ text, speed = 28, delay = 200 }: { text: string; speed?: number; delay?: number }) {
  const [shown, setShown] = useState(text);
  const [done, setDone] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let timer = 0;
    setShown("");
    setDone(false);
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          window.clearInterval(timer);
          setDone(true);
        }
      }, speed);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [text, speed, delay]);
  return (
    <>
      {shown}
      <span className="cursor-blink" aria-hidden="true" style={done ? undefined : { animation: "none" }} />
    </>
  );
}
